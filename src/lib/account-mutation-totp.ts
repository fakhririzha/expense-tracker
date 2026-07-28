import { createHmac, randomBytes } from "node:crypto";

import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

import {
  clearAccountTotpRateLimit,
  consumeAccountTotpRateLimit,
} from "@/lib/auth-rate-limit";
import prisma from "@/lib/db";
import { decryptUserField, encryptUserField } from "@/lib/user-encryption";

const TOTP_ISSUER = "FinHealth";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;
const RECOVERY_CODE_COUNT = 10;

export interface AccountMutationConfirmation {
  code: string;
}

export interface AccountMutationTotpStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

interface VerificationResult {
  success: boolean;
  error?: string;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication service is not configured");
  return secret;
}

function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function hashAccountMutationRecoveryCode(code: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`ACCOUNT_MUTATION_RECOVERY\0${normalizeCode(code)}`)
    .digest("hex");
}

export function createAccountMutationTotp(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function generateAccountMutationRecoveryCode(): string {
  return randomBytes(8).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-");
}

function getTotpTimeStep(delta: number): number {
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS) + delta;
}

async function recordInvalidAttempt(userId: string): Promise<VerificationResult> {
  const allowed = await consumeAccountTotpRateLimit(userId);
  return {
    success: false,
    error: allowed
      ? "Invalid confirmation code"
      : "Too many invalid codes. Try again in five minutes.",
  };
}

async function verifyTotpCode(
  userId: string,
  secretEncrypted: string,
  code: string,
  label: string
): Promise<number | null> {
  const secret = await decryptUserField(
    userId,
    "user.accountMutationTotpSecret",
    secretEncrypted
  );
  return createAccountMutationTotp(secret, label).validate({ token: code, window: TOTP_WINDOW });
}

export async function getAccountMutationTotpStatus(
  userId: string
): Promise<AccountMutationTotpStatus> {
  const credential = await prisma.accountMutationTotpCredential.findUnique({
    where: { userId },
    select: {
      enabledAt: true,
      _count: { select: { recoveryCodes: { where: { usedAt: null } } } },
    },
  });

  return {
    enabled: Boolean(credential?.enabledAt),
    recoveryCodesRemaining: credential?.enabledAt
      ? credential._count.recoveryCodes
      : 0,
  };
}

export async function startAccountMutationTotpEnrollment(
  userId: string,
  email: string
): Promise<{ secret: string; provisioningUri: string; qrCodeDataUrl: string }> {
  const existing = await prisma.accountMutationTotpCredential.findUnique({
    where: { userId },
    select: { enabledAt: true },
  });
  if (existing?.enabledAt) {
    throw new Error("Account change protection is already enabled");
  }

  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const secretEncrypted = await encryptUserField(
    userId,
    "user.accountMutationTotpSecret",
    secret
  );
  await prisma.accountMutationTotpCredential.upsert({
    where: { userId },
    create: { userId, secretEncrypted },
    update: { secretEncrypted, enabledAt: null, lastUsedTimeStep: null },
  });

  const provisioningUri = createAccountMutationTotp(secret, email).toString();
  return {
    secret,
    provisioningUri,
    qrCodeDataUrl: await QRCode.toDataURL(provisioningUri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    }),
  };
}

export async function activateAccountMutationTotp(
  userId: string,
  email: string,
  code: string
): Promise<{ recoveryCodes: string[] }> {
  const credential = await prisma.accountMutationTotpCredential.findUnique({
    where: { userId },
    select: { id: true, enabledAt: true, secretEncrypted: true },
  });
  if (!credential || credential.enabledAt) {
    throw new Error("Start TOTP setup before confirming it");
  }

  const token = normalizeCode(code);
  const delta = await verifyTotpCode(userId, credential.secretEncrypted, token, email);
  if (delta === null) {
    const result = await recordInvalidAttempt(userId);
    throw new Error(result.error);
  }

  const recoveryCodes = Array.from(
    { length: RECOVERY_CODE_COUNT },
    generateAccountMutationRecoveryCode
  );
  await prisma.$transaction([
    prisma.accountMutationTotpCredential.update({
      where: { id: credential.id },
      data: { enabledAt: new Date(), lastUsedTimeStep: null },
    }),
    prisma.accountMutationRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        credentialId: credential.id,
        codeHash: hashAccountMutationRecoveryCode(recoveryCode),
      })),
    }),
  ]);
  await clearAccountTotpRateLimit(userId);
  return { recoveryCodes };
}

export async function verifyAccountMutationConfirmation(
  userId: string,
  email: string,
  confirmation: AccountMutationConfirmation | undefined
): Promise<VerificationResult> {
  const credential = await prisma.accountMutationTotpCredential.findUnique({
    where: { userId },
    select: { id: true, enabledAt: true, secretEncrypted: true },
  });
  if (!credential?.enabledAt) return { success: true };

  const code = normalizeCode(confirmation?.code ?? "");
  if (!code) return { success: false, error: "TOTP_REQUIRED" };

  if (/^\d{6}$/.test(code)) {
    const delta = await verifyTotpCode(userId, credential.secretEncrypted, code, email);
    if (delta === null) return recordInvalidAttempt(userId);

    const timeStep = getTotpTimeStep(delta);
    const updated = await prisma.accountMutationTotpCredential.updateMany({
      where: {
        id: credential.id,
        OR: [
          { lastUsedTimeStep: null },
          { lastUsedTimeStep: { lt: timeStep } },
        ],
      },
      data: { lastUsedTimeStep: timeStep },
    });
    if (updated.count === 0) {
      return { success: false, error: "This confirmation code was already used" };
    }
  } else {
    const codeHash = hashAccountMutationRecoveryCode(code);
    const used = await prisma.accountMutationRecoveryCode.updateMany({
      where: { credentialId: credential.id, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) return recordInvalidAttempt(userId);
  }

  await clearAccountTotpRateLimit(userId);
  return { success: true };
}

export async function verifyLiveAccountMutationTotp(
  userId: string,
  email: string,
  code: string
): Promise<VerificationResult> {
  const credential = await prisma.accountMutationTotpCredential.findUnique({
    where: { userId },
    select: { enabledAt: true, secretEncrypted: true },
  });
  if (!credential?.enabledAt) {
    return { success: false, error: "Account change protection is not enabled" };
  }

  const delta = await verifyTotpCode(
    userId,
    credential.secretEncrypted,
    normalizeCode(code),
    email
  );
  if (delta === null) return recordInvalidAttempt(userId);
  await clearAccountTotpRateLimit(userId);
  return { success: true };
}

export async function regenerateAccountMutationRecoveryCodes(
  userId: string
): Promise<{ recoveryCodes: string[] }> {
  const credential = await prisma.accountMutationTotpCredential.findUniqueOrThrow({
    where: { userId },
    select: { id: true, enabledAt: true },
  });
  if (!credential.enabledAt) throw new Error("Account change protection is not enabled");

  const recoveryCodes = Array.from(
    { length: RECOVERY_CODE_COUNT },
    generateAccountMutationRecoveryCode
  );
  await prisma.$transaction([
    prisma.accountMutationRecoveryCode.deleteMany({
      where: { credentialId: credential.id },
    }),
    prisma.accountMutationRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        credentialId: credential.id,
        codeHash: hashAccountMutationRecoveryCode(recoveryCode),
      })),
    }),
  ]);
  return { recoveryCodes };
}

export async function disableAccountMutationTotp(userId: string): Promise<void> {
  await prisma.accountMutationTotpCredential.deleteMany({ where: { userId } });
  await clearAccountTotpRateLimit(userId);
}

export async function cancelAccountMutationTotpEnrollment(userId: string): Promise<void> {
  await prisma.accountMutationTotpCredential.deleteMany({
    where: { userId, enabledAt: null },
  });
}
