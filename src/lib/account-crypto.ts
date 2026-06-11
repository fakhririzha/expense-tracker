import { decryptUserField, encryptUserField } from "@/lib/user-encryption";

type EncryptedAccountRecord = {
  id: string;
  nameEncrypted: string;
  descriptionEncrypted?: string | null;
};

export type DecryptedAccountRecord<T extends EncryptedAccountRecord> = Omit<
  T,
  "nameEncrypted" | "descriptionEncrypted"
> & {
  name: string;
  description: string | null;
};

function assertEncryptedValue(
  value: string | null | undefined,
  fieldLabel: string
): string {
  if (!value) {
    throw new Error(`Missing encrypted value for ${fieldLabel}`);
  }

  return value;
}

export async function encryptAccountName(userId: string, plaintext: string) {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error("Account name is required");
  }

  const encrypted = await encryptUserField(userId, "account.name", trimmed);
  return assertEncryptedValue(encrypted, "account.name");
}

export async function encryptAccountDescription(
  userId: string,
  plaintext: string | null
) {
  if (!plaintext) {
    return null;
  }

  const trimmed = plaintext.trim();
  if (!trimmed) {
    return null;
  }

  const encrypted = await encryptUserField(
    userId,
    "account.description",
    trimmed
  );
  return assertEncryptedValue(encrypted, "account.description");
}

export async function decryptAccountName(
  userId: string,
  encryptedName: string
): Promise<string> {
  return decryptUserField(
    userId,
    "account.name",
    assertEncryptedValue(encryptedName, "account.name")
  );
}

export async function decryptAccountDescription(
  userId: string,
  encryptedDescription: string | null | undefined
): Promise<string | null> {
  if (!encryptedDescription) {
    return null;
  }

  return decryptUserField(
    userId,
    "account.description",
    encryptedDescription
  );
}

export async function decryptAccountRecord<T extends EncryptedAccountRecord>(
  userId: string,
  account: T
): Promise<DecryptedAccountRecord<T>> {
  const [name, description] = await Promise.all([
    decryptAccountName(userId, account.nameEncrypted),
    decryptAccountDescription(userId, account.descriptionEncrypted ?? null),
  ]);

  return {
    ...account,
    name,
    description,
  };
}

export async function decryptAccountRecords<T extends EncryptedAccountRecord>(
  userId: string,
  accounts: T[]
): Promise<Array<DecryptedAccountRecord<T>>> {
  return Promise.all(
    accounts.map((account) => decryptAccountRecord(userId, account))
  );
}

export function sortAccountsByName<T extends { name: string }>(accounts: T[]) {
  return [...accounts].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}
