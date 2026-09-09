export type PushProvider = "Apple" | "Google" | "Mozilla" | "Microsoft" | "Unknown";
export interface PushTestResult {
  provider: PushProvider;
  providerAccepted: boolean;
  statusCode: number | null;
  failureReason?: string;
}

export function pushProvider(endpoint: string): PushProvider {
  const host = new URL(endpoint).hostname;
  if (host === "web.push.apple.com") return "Apple";
  if (host === "fcm.googleapis.com") return "Google";
  if (host === "updates.push.services.mozilla.com") return "Mozilla";
  if (host === "notify.windows.com" || host.endsWith(".notify.windows.com")) return "Microsoft";
  return "Unknown";
}

const appleReasons = new Set([
  "BadDeviceToken", "Unregistered", "VapidPkHashMismatch", "BadJwtToken",
  "ExpiredProviderToken", "InvalidProviderToken", "TooManyRequests",
  "InternalServerError", "ServiceUnavailable", "BadTtl", "BadUrgency",
]);

const safeErrorCodes = new Set([
  "ERR_INVALID_IP_ADDRESS", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED",
  "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
  "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function pushDiagnostics(value: unknown) {
  const response = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const statusCode = typeof response.statusCode === "number" && Number.isInteger(response.statusCode)
    && response.statusCode >= 100 && response.statusCode <= 599 ? response.statusCode : null;
  let appleReason: string | undefined;
  if (typeof response.body === "string" && response.body.length < 4096) {
    try {
      const body = JSON.parse(response.body);
      if (typeof body?.reason === "string" && appleReasons.has(body.reason)) appleReason = body.reason;
    } catch { /* Never retain arbitrary provider response text. */ }
  }
  const headers = response.headers && typeof response.headers === "object"
    ? response.headers as Record<string, unknown> : {};
  const rawId = headers["apns-id"];
  const apnsId = typeof rawId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId) ? rawId : undefined;
  const mismatch = appleReason === "VapidPkHashMismatch" ||
    (statusCode === 403 && typeof response.body === "string" &&
      response.body.includes("the VAPID public key in the authorization header does not correspond"));
  const permanent = statusCode === 404 || statusCode === 410 || mismatch;
  const errorCode = typeof response.code === "string" && safeErrorCodes.has(response.code) ? response.code : undefined;
  const localFailure = statusCode === null;
  const temporary = statusCode === 429 || (statusCode !== null && statusCode >= 500) ||
    (localFailure && errorCode !== "ERR_INVALID_IP_ADDRESS");
  const failureReason = mismatch ? "Notification key changed. Repair this browser's subscription."
    : permanent ? "Subscription expired. Enable notifications again."
    : localFailure ? "The server could not complete the push request. Check server diagnostics before retrying."
    : temporary ? "Push service temporarily unavailable. Try again later."
    : "Push service rejected the request. Check server push configuration.";
  return { statusCode, appleReason, apnsId, errorCode, permanent, temporary, failureReason };
}
