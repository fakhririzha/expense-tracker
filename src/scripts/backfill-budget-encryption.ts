import "dotenv/config";

import prisma from "../lib/db.ts";
import { encryptBudgetName } from "../lib/budget-crypto.ts";
import { getMasterKey } from "../lib/encryption.ts";

type LegacyBudgetRow = {
  id: string;
  userId: string;
  name: string | null;
  nameEncrypted: string | null;
};

async function main() {
  getMasterKey();

  const budgets = await prisma.$queryRawUnsafe<LegacyBudgetRow[]>(`
    SELECT id, userId, name, nameEncrypted
    FROM Budget
    WHERE nameEncrypted IS NULL
  `);

  let processed = 0;

  for (const budget of budgets) {
    if (!budget.name?.trim()) {
      throw new Error(`Budget ${budget.id} is missing plaintext name; aborting drop-prep.`);
    }

    const encryptedName = await encryptBudgetName(budget.userId, budget.name);

    await prisma.$executeRawUnsafe(
      `
        UPDATE Budget
        SET nameEncrypted = ?, name = NULL
        WHERE id = ?
      `,
      encryptedName,
      budget.id
    );

    processed += 1;
  }

  console.log(`Backfilled ${processed} Budget rows.`);
}

main()
  .catch((error) => {
    console.error("Budget backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
