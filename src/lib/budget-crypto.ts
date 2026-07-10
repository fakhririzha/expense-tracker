import { decryptUserField, encryptUserField } from "@/lib/user-encryption";

type EncryptedBudgetRecord = {
  name: string | null;
  nameEncrypted: string | null;
};

export type DecryptedBudgetRecord<T extends EncryptedBudgetRecord> = Omit<
  T,
  "nameEncrypted"
> & {
  name: string;
};

export async function encryptBudgetName(
  userId: string,
  plaintext: string
): Promise<string> {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error("Budget name is required");
  }

  const encrypted = await encryptUserField(userId, "budget.name", trimmed);
  if (!encrypted) {
    throw new Error("Failed to encrypt budget.name");
  }

  return encrypted;
}

export async function decryptBudgetName(
  userId: string,
  encryptedName: string | null,
  legacyName: string | null
): Promise<string> {
  if (encryptedName) {
    return decryptUserField(userId, "budget.name", encryptedName);
  }

  if (!legacyName?.trim()) {
    throw new Error("Missing budget name");
  }

  return legacyName;
}

export async function decryptBudgetRecord<T extends EncryptedBudgetRecord>(
  userId: string,
  budget: T
): Promise<DecryptedBudgetRecord<T>> {
  return {
    ...budget,
    name: await decryptBudgetName(userId, budget.nameEncrypted, budget.name),
  };
}

export async function decryptBudgetRecords<T extends EncryptedBudgetRecord>(
  userId: string,
  budgets: T[]
): Promise<Array<DecryptedBudgetRecord<T>>> {
  return Promise.all(budgets.map((budget) => decryptBudgetRecord(userId, budget)));
}
