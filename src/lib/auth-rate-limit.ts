import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import prisma from "@/lib/db";

type AuthRateLimitScope =
  | "LOGIN_EMAIL"
  | "LOGIN_IP"
  | "REGISTER_EMAIL"
  | "REGISTER_IP"
  | "ACCOUNT_TOTP_USER";

const POLICIES: Record<AuthRateLimitScope, { limit: number; windowMs: number }> = {
  LOGIN_EMAIL: { limit: 5, windowMs: 15 * 60 * 1000 },
  LOGIN_IP: { limit: 50, windowMs: 15 * 60 * 1000 },
  REGISTER_EMAIL: { limit: 3, windowMs: 60 * 60 * 1000 },
  REGISTER_IP: { limit: 10, windowMs: 60 * 60 * 1000 },
  ACCOUNT_TOTP_USER: { limit: 5, windowMs: 5 * 60 * 1000 },
};

let lastCleanupAt = 0;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication service is not configured");
  return secret;
}

export function hashAuthRateLimitKey(
  scope: AuthRateLimitScope,
  identifier: string
): string {
  return createHmac("sha256", getAuthSecret())
    .update(`${scope}\0${identifier}`)
    .digest("hex");
}

function normalizeIp(value: string | null): string | null {
  const candidate = value?.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate.toLowerCase() : null;
}

export function getTrustedClientIp(request: Request): string | null {
  if (process.env.VERCEL === "1") {
    return normalizeIp(request.headers.get("x-vercel-forwarded-for"));
  }
  if (process.env.AUTH_TRUST_PROXY === "true") {
    return normalizeIp(request.headers.get("x-forwarded-for"));
  }
  return null;
}

async function consumeBucket(
  scope: AuthRateLimitScope,
  identifier: string,
  now: Date
): Promise<boolean> {
  const policy = POLICIES[scope];
  const windowStart = new Date(
    Math.floor(now.getTime() / policy.windowMs) * policy.windowMs
  );
  const expiresAt = new Date(windowStart.getTime() + policy.windowMs);
  const keyHash = hashAuthRateLimitKey(scope, identifier);
  const bucket = await prisma.authRateLimitBucket.upsert({
    where: { scope_keyHash_windowStart: { scope, keyHash, windowStart } },
    create: { scope, keyHash, windowStart, expiresAt, attempts: 1 },
    update: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  if (now.getTime() - lastCleanupAt >= 15 * 60 * 1000) {
    lastCleanupAt = now.getTime();
    void prisma.authRateLimitBucket
      .deleteMany({ where: { expiresAt: { lt: now } } })
      .catch((error: unknown) => console.error("Auth rate-limit cleanup failed:", error));
  }

  return bucket.attempts <= policy.limit;
}

export async function consumeLoginRateLimits(
  email: string,
  request: Request,
  now = new Date()
): Promise<boolean> {
  const ip = getTrustedClientIp(request);
  const ipAllowed = ip ? await consumeBucket("LOGIN_IP", ip, now) : true;
  const emailAllowed = await consumeBucket("LOGIN_EMAIL", email, now);
  return ipAllowed && emailAllowed;
}

export async function consumeRegistrationRateLimits(
  email: string,
  request: Request,
  now = new Date()
): Promise<boolean> {
  const ip = getTrustedClientIp(request);
  const ipAllowed = ip ? await consumeBucket("REGISTER_IP", ip, now) : true;
  const emailAllowed = await consumeBucket("REGISTER_EMAIL", email, now);
  return ipAllowed && emailAllowed;
}

export async function clearLoginEmailRateLimit(email: string): Promise<void> {
  await prisma.authRateLimitBucket.deleteMany({
    where: { scope: "LOGIN_EMAIL", keyHash: hashAuthRateLimitKey("LOGIN_EMAIL", email) },
  });
}

export async function consumeAccountTotpRateLimit(userId: string): Promise<boolean> {
  return consumeBucket("ACCOUNT_TOTP_USER", userId, new Date());
}

export async function clearAccountTotpRateLimit(userId: string): Promise<void> {
  await prisma.authRateLimitBucket.deleteMany({
    where: {
      scope: "ACCOUNT_TOTP_USER",
      keyHash: hashAuthRateLimitKey("ACCOUNT_TOTP_USER", userId),
    },
  });
}
