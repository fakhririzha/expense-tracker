import { lookup } from "node:dns";
import { Agent } from "node:https";
import { isIP } from "node:net";

export const MAX_PUSH_ENDPOINT_LENGTH = 2048;
export const MAX_PUSH_USER_AGENT_LENGTH = 512;
export const MAX_ACTIVE_PUSH_SUBSCRIPTIONS = 10;

const ALLOWED_EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

export class UnsafePushEndpointError extends Error {
  constructor(message = "Unsupported push subscription endpoint") {
    super(message);
    this.name = "UnsafePushEndpointError";
  }
}

function isAllowedHost(hostname: string): boolean {
  return (
    ALLOWED_EXACT_HOSTS.has(hostname) ||
    hostname === "notify.windows.com" ||
    hostname.endsWith(".notify.windows.com")
  );
}

export function validatePushEndpoint(endpoint: string): URL {
  if (!endpoint || endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) {
    throw new UnsafePushEndpointError("Invalid push subscription endpoint");
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new UnsafePushEndpointError("Invalid push subscription endpoint");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    url.hash ||
    isIP(hostname) !== 0 ||
    !isAllowedHost(hostname)
  ) {
    throw new UnsafePushEndpointError();
  }

  return url;
}

export function validatePushKey(
  value: string,
  expectedBytes: number,
  maxLength: number
): boolean {
  if (!value || value.length > maxLength || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return false;
  }
  const decoded = Buffer.from(value, "base64url");
  return (
    decoded.length === expectedBytes &&
    decoded.toString("base64url") === value &&
    (expectedBytes !== 65 || decoded[0] === 0x04)
  );
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c, d] = address.split(".").map(Number);
    if ([a, b, c, d].some((part) => !Number.isInteger(part))) return false;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return /^[23][0-9a-f]{3}:/.test(normalized) && !normalized.startsWith("2001:db8:");
  }
  return false;
}

export function createSafePushAgent(): Agent {
  return new Agent({
    keepAlive: false,
    lookup(hostname, _options, callback) {
      lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error, "", 0);
        if (
          addresses.length === 0 ||
          addresses.some(({ address }) => !isPublicIpAddress(address))
        ) {
          return callback(new UnsafePushEndpointError(), "", 0);
        }
        const selected = addresses[0];
        return callback(null, selected.address, selected.family);
      });
    },
  });
}
