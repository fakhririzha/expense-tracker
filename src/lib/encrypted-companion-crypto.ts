import { decryptUserField, encryptUserField } from "@/lib/user-encryption";

export type EncryptedCompanionField =
  | "recurringRule.name"
  | "recurringRule.description"
  | "savingsGoal.name"
  | "savingsGoal.description"
  | "subscription.name"
  | "subscription.provider"
  | "subscription.description"
  | "subscription.cancellationUrl"
  | "subscription.notes"
  | "personalAsset.name"
  | "personalAsset.notes";

export async function encryptRequiredCompanion(
  userId: string,
  field: EncryptedCompanionField,
  plaintext: string
): Promise<string> {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }

  return encryptUserField(userId, field, trimmed);
}

export async function encryptOptionalCompanion(
  userId: string,
  field: EncryptedCompanionField,
  plaintext: string | null | undefined
): Promise<string | null> {
  const trimmed = plaintext?.trim();
  return trimmed ? encryptUserField(userId, field, trimmed) : null;
}

export async function decryptRequiredCompanion(
  userId: string,
  field: EncryptedCompanionField,
  encrypted: string | null,
  legacy: string | null
): Promise<string> {
  if (encrypted) {
    try {
      return await decryptUserField(userId, field, encrypted);
    } catch {
      // A legacy plaintext value may still be available during rollout.
    }
  }

  const trimmed = legacy?.trim();
  if (!trimmed) {
    throw new Error(`Missing readable value for ${field}`);
  }

  return trimmed;
}

export async function decryptOptionalCompanion(
  userId: string,
  field: EncryptedCompanionField,
  encrypted: string | null,
  legacy: string | null
): Promise<string | null> {
  if (encrypted) {
    try {
      return await decryptUserField(userId, field, encrypted);
    } catch {
      // A legacy plaintext value may still be available during rollout.
    }
  }

  return legacy?.trim() || null;
}
