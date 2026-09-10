#!/usr/bin/env python3
"""Codex PreToolUse hook for routing large broad reads to a cheap reader agent.

Reads one hook event JSON object from stdin. For Bash calls, detects common file-dump
commands and blocks/warns when a large file would send too much source into the active
model's context. The hook deliberately fails open on parser/runtime errors.

Runtime overrides:
  CODEX_SHUNT=off|observe|warn|enforce
  CODEX_SHUNT_MIN_LINES=<int>
  CODEX_SHUNT_MAX_TARGETED_LINES=<int>
"""

from __future__ import annotations

import glob
import json
import os
import re
import shlex
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

DEFAULT_CONFIG: dict[str, Any] = {
    "mode": "enforce",
    "min_lines": 350,
    "max_targeted_lines": 160,
    "worker_models": ["gpt-5.6-luna"],
    "excluded_dir_names": [
        ".git",
        ".next",
        ".turbo",
        ".vercel",
        "node_modules",
        "dist",
        "build",
        "coverage",
        "vendor",
    ],
    "binary_extensions": [
        ".7z", ".avif", ".bin", ".bmp", ".class", ".dmg", ".eot", ".gif",
        ".gz", ".ico", ".jpeg", ".jpg", ".mov", ".mp3", ".mp4", ".otf",
        ".pdf", ".png", ".tar", ".tgz", ".ttf", ".webm", ".webp", ".woff",
        ".woff2", ".zip",
    ],
    "telemetry_file": "~/.codex/logs/shunt.jsonl",
}

SHELL_SEPARATORS = {";", "&&", "||", "|", "&"}
REDIRECTION_TOKENS = {">", ">>", "<", "<<", "2>", "2>>", "1>", "1>>"}
ENV_ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=.*$")
SED_RANGE = re.compile(r"^(\d+)\s*,\s*(\d+)p$")
SED_SINGLE = re.compile(r"^(\d+)p$")


@dataclass(frozen=True)
class ReadRequest:
    command: str
    raw_path: str
    start_line: int | None = None
    end_line: int | None = None
    count: int | None = None
    from_line: int | None = None


@dataclass(frozen=True)
class Candidate:
    command: str
    path: str
    total_lines: int
    estimated_output_lines: int
    blocked: bool


def _deepcopy_default() -> dict[str, Any]:
    # JSON round-trip is enough for this simple configuration object.
    return json.loads(json.dumps(DEFAULT_CONFIG))


def load_config() -> dict[str, Any]:
    config = _deepcopy_default()
    path = Path(os.environ.get("CODEX_SHUNT_CONFIG", "~/.codex/shunt.json")).expanduser()
    try:
        if path.is_file():
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                config.update(loaded)
    except Exception:
        # Bad optional config must never make Codex unusable.
        pass

    if os.environ.get("CODEX_SHUNT"):
        config["mode"] = os.environ["CODEX_SHUNT"]
    if os.environ.get("CODEX_SHUNT_MIN_LINES"):
        try:
            config["min_lines"] = int(os.environ["CODEX_SHUNT_MIN_LINES"])
        except ValueError:
            pass
    if os.environ.get("CODEX_SHUNT_MAX_TARGETED_LINES"):
        try:
            config["max_targeted_lines"] = int(os.environ["CODEX_SHUNT_MAX_TARGETED_LINES"])
        except ValueError:
            pass

    mode = str(config.get("mode", "enforce")).lower()
    if mode not in {"off", "observe", "warn", "enforce"}:
        mode = "observe"
    config["mode"] = mode
    config["min_lines"] = max(1, int(config.get("min_lines", 350)))
    config["max_targeted_lines"] = max(1, int(config.get("max_targeted_lines", 160)))
    return config


def tokenize_shell(command: str) -> list[str]:
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>")
    lexer.whitespace_split = True
    lexer.commenters = ""
    return list(lexer)


def split_segments(tokens: list[str]) -> list[list[str]]:
    result: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        if token in SHELL_SEPARATORS or (token and set(token) <= set(";&|")):
            if current:
                result.append(current)
                current = []
            continue
        current.append(token)
    if current:
        result.append(current)
    return result


def _strip_wrappers(tokens: list[str]) -> list[str]:
    tokens = list(tokens)
    while tokens and ENV_ASSIGNMENT.match(tokens[0]):
        tokens.pop(0)
    while tokens and Path(tokens[0]).name in {"command", "env", "sudo", "xargs"}:
        tokens.pop(0)
        while tokens and ENV_ASSIGNMENT.match(tokens[0]):
            tokens.pop(0)
    return tokens


def _path_args(tokens: Iterable[str]) -> list[str]:
    paths: list[str] = []
    skip_next = False
    for token in tokens:
        if skip_next:
            skip_next = False
            continue
        if token in REDIRECTION_TOKENS or token in {"2>&1", "1>&2"}:
            skip_next = token in REDIRECTION_TOKENS
            continue
        if token == "--":
            continue
        if token.startswith("-"):
            continue
        paths.append(token)
    return paths


def _parse_number_option(tokens: list[str], default: int = 10) -> tuple[int | None, list[str]]:
    """Return (count, remaining possible paths). Supports -n N, -N and --lines=N."""
    count: int | None = default
    remaining: list[str] = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token in {"-n", "--lines"} and i + 1 < len(tokens):
            value = tokens[i + 1]
            if value.startswith("+"):
                # +N is handled separately by tail.
                count = None
                remaining.extend(tokens[i:])
                return count, remaining
            try:
                count = max(0, int(value))
                i += 2
                continue
            except ValueError:
                pass
        if token.startswith("--lines="):
            value = token.split("=", 1)[1]
            if value.startswith("+"):
                count = None
                remaining.append(token)
            else:
                try:
                    count = max(0, int(value))
                except ValueError:
                    pass
            i += 1
            continue
        m = re.fullmatch(r"-(\d+)", token)
        if m:
            count = int(m.group(1))
            i += 1
            continue
        remaining.append(token)
        i += 1
    return count, remaining


def requests_from_segment(segment: list[str]) -> list[ReadRequest]:
    segment = _strip_wrappers(segment)
    if not segment:
        return []

    exe = Path(segment[0]).name
    args = segment[1:]
    requests: list[ReadRequest] = []

    if exe in {"cat", "bat", "batcat", "less", "more", "nl"}:
        for raw in _path_args(args):
            requests.append(ReadRequest(command=exe, raw_path=raw))
        return requests

    if exe == "head":
        count, rest = _parse_number_option(args, default=10)
        for raw in _path_args(rest):
            requests.append(ReadRequest(command=exe, raw_path=raw, count=count or 10))
        return requests

    if exe == "tail":
        # tail -n +N FILE means from N to EOF; tail -n N FILE means last N lines.
        from_line: int | None = None
        count: int | None = 10
        rest: list[str] = []
        i = 0
        while i < len(args):
            token = args[i]
            if token in {"-n", "--lines"} and i + 1 < len(args):
                value = args[i + 1]
                if value.startswith("+") and value[1:].isdigit():
                    from_line = int(value[1:])
                    count = None
                elif value.isdigit():
                    count = int(value)
                i += 2
                continue
            if token.startswith("--lines="):
                value = token.split("=", 1)[1]
                if value.startswith("+") and value[1:].isdigit():
                    from_line = int(value[1:])
                    count = None
                elif value.isdigit():
                    count = int(value)
                i += 1
                continue
            m = re.fullmatch(r"-(\d+)", token)
            if m:
                count = int(m.group(1))
                i += 1
                continue
            rest.append(token)
            i += 1
        for raw in _path_args(rest):
            requests.append(ReadRequest(command=exe, raw_path=raw, count=count, from_line=from_line))
        return requests

    if exe == "sed":
        scripts: list[str] = []
        possible_paths: list[str] = []
        i = 0
        while i < len(args):
            token = args[i]
            if token == "-n":
                i += 1
                continue
            if token in {"-e", "--expression"} and i + 1 < len(args):
                scripts.append(args[i + 1])
                i += 2
                continue
            if token.startswith("-"):
                i += 1
                continue
            if not scripts and (SED_RANGE.match(token) or SED_SINGLE.match(token)):
                scripts.append(token)
            else:
                possible_paths.append(token)
            i += 1

        start: int | None = None
        end: int | None = None
        if scripts:
            m = SED_RANGE.match(scripts[0])
            if m:
                start, end = int(m.group(1)), int(m.group(2))
            else:
                m = SED_SINGLE.match(scripts[0])
                if m:
                    start = end = int(m.group(1))
        for raw in _path_args(possible_paths):
            requests.append(ReadRequest(command=exe, raw_path=raw, start_line=start, end_line=end))
        return requests

    return []


def extract_read_requests(command: str) -> list[ReadRequest]:
    try:
        tokens = tokenize_shell(command)
    except ValueError:
        return []
    requests: list[ReadRequest] = []
    for segment in split_segments(tokens):
        requests.extend(requests_from_segment(segment))
    return requests


def expand_paths(raw_path: str, cwd: Path) -> list[Path]:
    if raw_path in {"-", "/dev/stdin", "/dev/null"}:
        return []
    expanded = os.path.expanduser(raw_path)
    if not os.path.isabs(expanded):
        expanded = str(cwd / expanded)
    if any(ch in expanded for ch in "*?["):
        matches = glob.glob(expanded, recursive=False)
        return [Path(p) for p in matches]
    return [Path(expanded)]


def should_skip_path(path: Path, config: dict[str, Any]) -> bool:
    if not path.is_file():
        return True
    excluded = set(str(x) for x in config.get("excluded_dir_names", []))
    if any(part in excluded for part in path.parts):
        return True
    binary_exts = {str(x).lower() for x in config.get("binary_extensions", [])}
    if path.suffix.lower() in binary_exts:
        return True
    return False


def count_lines(path: Path) -> int:
    total = 0
    last_byte: bytes = b""
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            total += chunk.count(b"\n")
            last_byte = chunk[-1:]
    if path.stat().st_size > 0 and last_byte != b"\n":
        total += 1
    return total


def estimate_output_lines(request: ReadRequest, total_lines: int) -> int:
    if request.start_line is not None and request.end_line is not None:
        start = max(1, request.start_line)
        end = max(start, request.end_line)
        return max(0, min(total_lines, end) - start + 1)
    if request.from_line is not None:
        return max(0, total_lines - max(1, request.from_line) + 1)
    if request.count is not None:
        return min(total_lines, max(0, request.count))
    return total_lines


def analyse_command(command: str, cwd: Path, config: dict[str, Any]) -> list[Candidate]:
    candidates: list[Candidate] = []
    seen: set[tuple[str, str]] = set()
    min_lines = int(config["min_lines"])
    max_targeted = int(config["max_targeted_lines"])

    for request in extract_read_requests(command):
        for path in expand_paths(request.raw_path, cwd):
            try:
                resolved = path.resolve()
                key = (request.command, str(resolved))
                if key in seen or should_skip_path(resolved, config):
                    continue
                seen.add(key)
                total = count_lines(resolved)
                output = estimate_output_lines(request, total)
                blocked = total >= min_lines and output > max_targeted
                candidates.append(
                    Candidate(
                        command=request.command,
                        path=str(resolved),
                        total_lines=total,
                        estimated_output_lines=output,
                        blocked=blocked,
                    )
                )
            except (OSError, ValueError):
                continue
    return candidates


def model_is_worker(model: str, config: dict[str, Any]) -> bool:
    model = model.lower().strip()
    for worker in config.get("worker_models", []):
        worker_s = str(worker).lower().strip()
        if worker_s and (model == worker_s or model.startswith(worker_s + "-")):
            return True
    return False


def telemetry_path(config: dict[str, Any]) -> Path:
    return Path(str(config.get("telemetry_file", "~/.codex/logs/shunt.jsonl"))).expanduser()


def log_event(config: dict[str, Any], event: dict[str, Any]) -> None:
    try:
        path = telemetry_path(config)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
    except Exception:
        pass


def decision_payload(mode: str, blocked: list[Candidate]) -> dict[str, Any] | None:
    if not blocked or mode in {"off", "observe"}:
        return None

    details = ", ".join(
        f"{Path(item.path).name} ({item.total_lines} lines; ~{item.estimated_output_lines} requested)"
        for item in blocked[:5]
    )
    reason = (
        "Large broad source read routed away from the primary context: "
        f"{details}. Spawn the `bulk_reader` agent with the exact question you need answered, "
        "then use targeted symbol/line-range reads for any source the primary agent must inspect directly."
    )

    if mode == "warn":
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": "SHUNT WARNING: " + reason,
            }
        }

    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def process(payload: dict[str, Any], config: dict[str, Any]) -> dict[str, Any] | None:
    mode = str(config.get("mode", "enforce"))
    if mode == "off":
        return None
    if payload.get("hook_event_name") != "PreToolUse":
        return None
    if payload.get("tool_name") != "Bash":
        return None

    model = str(payload.get("model") or "")
    command = str((payload.get("tool_input") or {}).get("command") or "")
    cwd = Path(str(payload.get("cwd") or os.getcwd()))

    if not command:
        return None
    if model_is_worker(model, config):
        log_event(config, {
            "event": "worker_bypass",
            "model": model,
            "command": command[:1200],
            "session_id": payload.get("session_id"),
            "turn_id": payload.get("turn_id"),
        })
        return None

    candidates = analyse_command(command, cwd, config)
    blocked = [c for c in candidates if c.blocked]
    if candidates:
        log_event(config, {
            "event": "read_check",
            "mode": mode,
            "model": model,
            "session_id": payload.get("session_id"),
            "turn_id": payload.get("turn_id"),
            "command": command[:1200],
            "candidates": [asdict(c) for c in candidates],
        })
    return decision_payload(mode, blocked)


def main() -> int:
    config = load_config()
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            return 0
        result = process(payload, config)
        if result is not None:
            sys.stdout.write(json.dumps(result, separators=(",", ":")))
        return 0
    except Exception as exc:
        # Fail open. A broken optimization hook must never block normal Codex usage.
        log_event(config, {"event": "hook_error", "error": repr(exc)})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
