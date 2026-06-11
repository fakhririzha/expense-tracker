import "dotenv/config";

import prisma from "../lib/db.ts";
import { encryptAccountDescription, encryptAccountName } from "../lib/account-crypto.ts";
import { getMasterKey } from "../lib/encryption.ts";

type LegacyAccountRow = {
  id: string;
  userId: string;
  name: string | null;
  description: string | null;
  nameEncrypted: string | null;
  descriptionEncrypted: string | null;
};

async function main() {
  getMasterKey();

  const accounts = await prisma.$queryRawUnsafe<LegacyAccountRow[]>(`
    SELECT id, userId, name, description, nameEncrypted, descriptionEncrypted
    FROM FinancialAccount
    WHERE name IS NOT NULL OR description IS NOT NULL
  `);

  let processed = 0;

  for (const account of accounts) {
    if (!account.name || account.name.trim().length === 0) {
      throw new Error(`Account ${account.id} is missing plaintext name; aborting drop-prep.`);
    }

    const encryptedName = await encryptAccountName(account.userId, account.name);
    const encryptedDescription = await encryptAccountDescription(
      account.userId,
      account.description
    );

    await prisma.$executeRawUnsafe(
      `
        UPDATE FinancialAccount
        SET nameEncrypted = ?, descriptionEncrypted = ?, lastEncryptedAt = NOW()
        WHERE id = ?
      `,
      encryptedName,
      encryptedDescription,
      account.id
    );

    processed += 1;
  }

  console.log(`Backfilled ${processed} FinancialAccount rows.`);
}

main()
  .catch((error) => {
    console.error("FinancialAccount backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
