/**
 * Data Encryption Migration Script
 * 
 * This script encrypts existing sensitive data in the database.
 * Run this script once to migrate existing plaintext data to encrypted format.
 * 
 * Usage:
 * pnpm tsx src/scripts/migrate-encryption.ts
 * 
 * IMPORTANT: 
 * - Backup your database before running this script
 * - Set ENCRYPTION_MASTER_KEY in .env before running
 * - This script can be run multiple times safely (idempotent)
 */

import prisma from "@/lib/db";
import { getMasterKey, deriveUserKey, encrypt } from "@/lib/encryption";
import "dotenv/config";

interface MigrationResult {
  model: string;
  processed: number;
  encrypted: number;
  errors: number;
}

async function migrateTransactions(): Promise<MigrationResult> {
  const result: MigrationResult = {
    model: "Transaction",
    processed: 0,
    encrypted: 0,
    errors: 0,
  };

  try {
    // Get all users with their encryption salt
    const users = await prisma.user.findMany({
      select: { id: true, encryptionSalt: true },
    });

    for (const user of users) {
      if (!user.encryptionSalt) {
        console.log(`User ${user.id} has no encryption salt, skipping...`);
        continue;
      }

      const masterKey = getMasterKey();
      const userKey = deriveUserKey(masterKey, user.encryptionSalt);

      // Get transactions with descriptions that haven't been encrypted yet
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          description: { not: null },
          descriptionEncrypted: null,
        },
        select: {
          id: true,
          description: true,
        },
      });

      for (const tx of transactions) {
        if (tx.description) {
          try {
            const encrypted = encrypt(tx.description, userKey);
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { descriptionEncrypted: encrypted },
            });
            result.encrypted++;
          } catch (error) {
            console.error(`Error encrypting transaction ${tx.id}:`, error);
            result.errors++;
          }
        }
        result.processed++;
      }
    }

    console.log(`Transactions: Processed ${result.processed}, Encrypted ${result.encrypted}, Errors ${result.errors}`);
  } catch (error) {
    console.error("Error migrating transactions:", error);
  }

  return result;
}

async function migrateAccounts(): Promise<MigrationResult> {
  const result: MigrationResult = {
    model: "FinancialAccount",
    processed: 0,
    encrypted: 0,
    errors: 0,
  };

  console.log(
    "Accounts: skipped in migrate-encryption.ts. Use `pnpm db:backfill:account-encryption` for FinancialAccount backfill."
  );

  return result;
}

async function migrateTradeHistory(): Promise<MigrationResult> {
  const result: MigrationResult = {
    model: "TradeHistory",
    processed: 0,
    encrypted: 0,
    errors: 0,
  };

  try {
    const users = await prisma.user.findMany({
      select: { id: true, encryptionSalt: true },
    });

    for (const user of users) {
      if (!user.encryptionSalt) continue;

      const masterKey = getMasterKey();
      const userKey = deriveUserKey(masterKey, user.encryptionSalt);

      const trades = await prisma.tradeHistory.findMany({
        where: {
          userId: user.id,
          notes: { not: null },
          notesEncrypted: null,
        },
        select: {
          id: true,
          notes: true,
        },
      });

      for (const trade of trades) {
        if (trade.notes) {
          try {
            const encrypted = encrypt(trade.notes, userKey);
            await prisma.tradeHistory.update({
              where: { id: trade.id },
              data: { notesEncrypted: encrypted },
            });
            result.encrypted++;
          } catch (error) {
            console.error(`Error encrypting trade ${trade.id}:`, error);
            result.errors++;
          }
        }
        result.processed++;
      }
    }

    console.log(`TradeHistory: Processed ${result.processed}, Encrypted ${result.encrypted}, Errors ${result.errors}`);
  } catch (error) {
    console.error("Error migrating trade history:", error);
  }

  return result;
}

async function migrateRecurringRules(): Promise<MigrationResult> {
  const result: MigrationResult = {
    model: "RecurringRule",
    processed: 0,
    encrypted: 0,
    errors: 0,
  };

  try {
    const users = await prisma.user.findMany({
      select: { id: true, encryptionSalt: true },
    });

    for (const user of users) {
      if (!user.encryptionSalt) continue;

      const masterKey = getMasterKey();
      const userKey = deriveUserKey(masterKey, user.encryptionSalt);

      const rules = await prisma.recurringRule.findMany({
        where: {
          userId: user.id,
          name: { not: undefined },
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      for (const rule of rules) {
        try {
          if (rule.name) {
            const encryptedName = encrypt(rule.name, userKey);
            await prisma.recurringRule.update({
              where: { id: rule.id },
              data: { nameEncrypted: encryptedName },
            });
          }

          if (rule.description) {
            const encryptedDesc = encrypt(rule.description, userKey);
            await prisma.recurringRule.update({
              where: { id: rule.id },
              data: { descriptionEncrypted: encryptedDesc },
            });
          }

          result.encrypted++;
        } catch (error) {
          console.error(`Error encrypting recurring rule ${rule.id}:`, error);
          result.errors++;
        }
        result.processed++;
      }
    }

    console.log(`RecurringRule: Processed ${result.processed}, Encrypted ${result.encrypted}, Errors ${result.errors}`);
  } catch (error) {
    console.error("Error migrating recurring rules:", error);
  }

  return result;
}

async function migrateSavingsGoals(): Promise<MigrationResult> {
  const result: MigrationResult = {
    model: "SavingsGoal",
    processed: 0,
    encrypted: 0,
    errors: 0,
  };

  try {
    const users = await prisma.user.findMany({
      select: { id: true, encryptionSalt: true },
    });

    for (const user of users) {
      if (!user.encryptionSalt) continue;

      const masterKey = getMasterKey();
      const userKey = deriveUserKey(masterKey, user.encryptionSalt);

      const goals = await prisma.savingsGoal.findMany({
        where: {
          userId: user.id,
          name: { not: undefined },
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      for (const goal of goals) {
        try {
          if (goal.name) {
            const encryptedName = encrypt(goal.name, userKey);
            await prisma.savingsGoal.update({
              where: { id: goal.id },
              data: { nameEncrypted: encryptedName },
            });
          }

          if (goal.description) {
            const encryptedDesc = encrypt(goal.description, userKey);
            await prisma.savingsGoal.update({
              where: { id: goal.id },
              data: { descriptionEncrypted: encryptedDesc },
            });
          }

          result.encrypted++;
        } catch (error) {
          console.error(`Error encrypting savings goal ${goal.id}:`, error);
          result.errors++;
        }
        result.processed++;
      }
    }

    console.log(`SavingsGoal: Processed ${result.processed}, Encrypted ${result.encrypted}, Errors ${result.errors}`);
  } catch (error) {
    console.error("Error migrating savings goals:", error);
  }

  return result;
}

async function main() {
  console.log("Starting encryption migration...\n");

  try {
    // Check if master key is configured
    getMasterKey();
    console.log("✓ Encryption master key loaded\n");

    // Run migrations for each model
    await migrateTransactions();
    await migrateAccounts();
    await migrateTradeHistory();
    await migrateRecurringRules();
    await migrateSavingsGoals();

    console.log("\n✓ Encryption migration completed!");
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
