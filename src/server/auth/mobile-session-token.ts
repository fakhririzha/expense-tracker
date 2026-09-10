import { createHash, randomBytes } from "node:crypto";

export function createMobileSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashMobileSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function isMobileSessionExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt <= now;
}
