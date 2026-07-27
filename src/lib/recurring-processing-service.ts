import { Prisma } from "@/generated/prisma/client/client";
import { isDepositoAccountType } from "@/lib/account-types";
import prisma from "@/lib/db";
import {
  decryptOptionalCompanion,
  decryptRequiredCompanion,
} from "@/lib/encrypted-companion-crypto";
import { encryptUserField } from "@/lib/user-encryption";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";

export async function processRecurringTransactions() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueRules = await prisma.recurringRule.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: { user: { select: { mainCurrency: true } } },
    });
    const results = { processed: 0, failed: 0, errors: [] as string[] };

    for (const rule of dueRules) {
      try {
        if (!rule.accountId) {
          results.errors.push(`Rule ${rule.id}: No account specified`);
          results.failed++;
          continue;
        }
        const [name, description] = await Promise.all([
          decryptRequiredCompanion(
            rule.userId,
            "recurringRule.name",
            rule.nameEncrypted,
            rule.name
          ),
          decryptOptionalCompanion(
            rule.userId,
            "recurringRule.description",
            rule.descriptionEncrypted,
            rule.description
          ),
        ]);
        const descriptionEncrypted = await encryptUserField(
          rule.userId,
          "transaction.description",
          description ?? name
        );

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const account = await tx.financialAccount.findFirst({
            where: { id: rule.accountId!, userId: rule.userId },
            select: { id: true, type: true, isActive: true },
          });
          if (!account) throw new Error("Account not found");
          if (!account.isActive) throw new Error("Account is inactive");
          if (isDepositoAccountType(account.type)) {
            throw new Error("Deposito accounts cannot be used by recurring rules.");
          }

          await tx.transaction.create({
            data: {
              amount: rule.amount,
              currency: rule.currency,
              exchangeRate: 1,
              type: rule.type,
              description: null,
              descriptionEncrypted,
              date: rule.nextDueDate,
              isRecurring: true,
              userId: rule.userId,
              accountId: rule.accountId!,
              categoryId: rule.categoryId,
              recurringRuleId: rule.id,
            },
          });
          const balanceChange = rule.type === "INCOME" ? rule.amount : -rule.amount;
          await tx.financialAccount.update({
            where: { id: rule.accountId! },
            data: { balance: { increment: balanceChange } },
          });
          const nextDueDate = calculateNextDueDate(rule.nextDueDate, rule.interval);
          const shouldDeactivate = Boolean(
            rule.endDate && nextDueDate > rule.endDate
          );
          await tx.recurringRule.update({
            where: { id: rule.id },
            data: { nextDueDate, isActive: !shouldDeactivate },
          });
          await tx.subscription.updateMany({
            where: { recurringRuleId: rule.id },
            data: { nextBillingDate: nextDueDate },
          });
        });
        results.processed++;
      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
        results.errors.push(`Rule ${rule.id}: ${error}`);
        results.failed++;
      }
    }
    return { success: true, data: results };
  } catch (error) {
    console.error("Process recurring transactions error:", error);
    return { success: false, error: "Failed to process recurring transactions" };
  }
}

function calculateNextDueDate(currentDate: Date, interval: string): Date {
  switch (interval) {
    case "DAILY": return addDays(currentDate, 1);
    case "WEEKLY": return addWeeks(currentDate, 1);
    case "BIWEEKLY": return addWeeks(currentDate, 2);
    case "MONTHLY": return addMonths(currentDate, 1);
    case "QUARTERLY": return addMonths(currentDate, 3);
    case "YEARLY": return addYears(currentDate, 1);
    default: return addMonths(currentDate, 1);
  }
}
