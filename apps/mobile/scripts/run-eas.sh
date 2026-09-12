#!/usr/bin/env bash
set -euo pipefail

# CocoaPods' React Native prepare scripts call `head -n`. XAMPP ships an HTTP
# client named HEAD, and macOS's default case-insensitive filesystem lets that
# shadow the Unix `head` command, which makes `pod install` fail.
sanitized_path=""
IFS=':'
for entry in $PATH; do
  case "$entry" in
    */XAMPP/*|*/xamppfiles/*) continue ;;
  esac
  if [ -z "$sanitized_path" ]; then
    sanitized_path="$entry"
  else
    sanitized_path="$sanitized_path:$entry"
  fi
done
unset IFS

# Keep Homebrew and Unix tools ahead of leftover PATH entries, but do not
# prepend /usr/local/bin: that directory can contain an older Node that would
# shadow nvm.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:${sanitized_path}"

exec pnpm dlx eas-cli@latest "$@"