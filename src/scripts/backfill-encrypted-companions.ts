import "dotenv/config";

import prisma from "../lib/db.ts";
import {
  decryptRequiredCompanion,
  encryptOptionalCompanion,
  encryptRequiredCompanion,
  type EncryptedCompanionField,
} from "../lib/encrypted-companion-crypto.ts";
import { getMasterKey } from "../lib/encryption.ts";
import { decryptUserField } from "../lib/user-encryption.ts";

type TextPair = { plaintext: string | null; encrypted: string | null; field: EncryptedCompanionField; required?: boolean };

async function resolvePair(userId: string, pair: TextPair): Promise<string | null> {
  if (pair.plaintext?.trim()) {
    return pair.required
      ? encryptRequiredCompanion(userId, pair.field, pair.plaintext)
      : encryptOptionalCompanion(userId, pair.field, pair.plaintext);
  }

  if (pair.required) {
    await decryptRequiredCompanion(userId, pair.field, pair.encrypted, null);
  } else if (pair.encrypted) {
    await decryptUserField(userId, pair.field, pair.encrypted);
  }

  return pair.encrypted;
}

async function main() {
  getMasterKey();
  let processed = 0;

  const recurringRules = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; name: string | null; nameEncrypted: string | null; description: string | null; descriptionEncrypted: string | null }>>(
    "SELECT id, userId, name, nameEncrypted, description, descriptionEncrypted FROM RecurringRule"
  );
  for (const row of recurringRules) {
    const [nameEncrypted, descriptionEncrypted] = await Promise.all([
      resolvePair(row.userId, { plaintext: row.name, encrypted: row.nameEncrypted, field: "recurringRule.name", required: true }),
      resolvePair(row.userId, { plaintext: row.description, encrypted: row.descriptionEncrypted, field: "recurringRule.description" }),
    ]);
    await prisma.$executeRawUnsafe("UPDATE RecurringRule SET name = NULL, nameEncrypted = ?, description = NULL, descriptionEncrypted = ? WHERE id = ?", nameEncrypted, descriptionEncrypted, row.id);
    processed += 1;
  }

  const goals = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; name: string | null; nameEncrypted: string | null; description: string | null; descriptionEncrypted: string | null }>>(
    "SELECT id, userId, name, nameEncrypted, description, descriptionEncrypted FROM SavingsGoal"
  );
  for (const row of goals) {
    const [nameEncrypted, descriptionEncrypted] = await Promise.all([
      resolvePair(row.userId, { plaintext: row.name, encrypted: row.nameEncrypted, field: "savingsGoal.name", required: true }),
      resolvePair(row.userId, { plaintext: row.description, encrypted: row.descriptionEncrypted, field: "savingsGoal.description" }),
    ]);
    await prisma.$executeRawUnsafe("UPDATE SavingsGoal SET name = NULL, nameEncrypted = ?, description = NULL, descriptionEncrypted = ? WHERE id = ?", nameEncrypted, descriptionEncrypted, row.id);
    processed += 1;
  }

  const subscriptions = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; name: string | null; nameEncrypted: string | null; provider: string | null; providerEncrypted: string | null; description: string | null; descriptionEncrypted: string | null; cancellationUrl: string | null; cancellationUrlEncrypted: string | null; notes: string | null; notesEncrypted: string | null }>>(
    "SELECT id, userId, name, nameEncrypted, provider, providerEncrypted, description, descriptionEncrypted, cancellationUrl, cancellationUrlEncrypted, notes, notesEncrypted FROM Subscription"
  );
  for (const row of subscriptions) {
    const [nameEncrypted, providerEncrypted, descriptionEncrypted, cancellationUrlEncrypted, notesEncrypted] = await Promise.all([
      resolvePair(row.userId, { plaintext: row.name, encrypted: row.nameEncrypted, field: "subscription.name", required: true }),
      resolvePair(row.userId, { plaintext: row.provider, encrypted: row.providerEncrypted, field: "subscription.provider" }),
      resolvePair(row.userId, { plaintext: row.description, encrypted: row.descriptionEncrypted, field: "subscription.description" }),
      resolvePair(row.userId, { plaintext: row.cancellationUrl, encrypted: row.cancellationUrlEncrypted, field: "subscription.cancellationUrl" }),
      resolvePair(row.userId, { plaintext: row.notes, encrypted: row.notesEncrypted, field: "subscription.notes" }),
    ]);
    await prisma.$executeRawUnsafe("UPDATE Subscription SET name = NULL, nameEncrypted = ?, provider = NULL, providerEncrypted = ?, description = NULL, descriptionEncrypted = ?, cancellationUrl = NULL, cancellationUrlEncrypted = ?, notes = NULL, notesEncrypted = ? WHERE id = ?", nameEncrypted, providerEncrypted, descriptionEncrypted, cancellationUrlEncrypted, notesEncrypted, row.id);
    processed += 1;
  }

  const assets = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; name: string | null; nameEncrypted: string | null; notes: string | null; notesEncrypted: string | null }>>(
    "SELECT id, userId, name, nameEncrypted, notes, notesEncrypted FROM PersonalAsset"
  );
  for (const row of assets) {
    const [nameEncrypted, notesEncrypted] = await Promise.all([
      resolvePair(row.userId, { plaintext: row.name, encrypted: row.nameEncrypted, field: "personalAsset.name", required: true }),
      resolvePair(row.userId, { plaintext: row.notes, encrypted: row.notesEncrypted, field: "personalAsset.notes" }),
    ]);
    await prisma.$executeRawUnsafe("UPDATE PersonalAsset SET name = NULL, nameEncrypted = ?, notes = NULL, notesEncrypted = ? WHERE id = ?", nameEncrypted, notesEncrypted, row.id);
    processed += 1;
  }

  console.log(`Backfilled ${processed} encrypted companion records.`);
}

main()
  .catch((error) => {
    console.error("Encrypted companion backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
