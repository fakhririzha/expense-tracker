"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma/client/client";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { isDepositoAccountType } from "@/lib/account-types";
import {
  decryptOptionalCompanion,
  decryptRequiredCompanion,
  encryptOptionalCompanion,
  encryptRequiredCompanion,
} from "@/lib/encrypted-companion-crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptUserField } from "@/lib/user-encryption";

const recurringRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("IDR"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  interval: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  nextDueDate: z.date(),
  endDate: z.date().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;

async function validateOwnedRecurringAccount(
  userId: string,
  accountId?: string | null
) {
  if (!accountId) {
    return { success: true as const };
  }

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, type: true },
  });

  if (!account) {
    return { success: false as const, error: "Account not found" };
  }

  if (isDepositoAccountType(account.type)) {
    return {
      success: false as const,
      error: "Deposito accounts cannot be used by recurring rules.",
    };
  }

  return { success: true as const };
}

export async function createRecurringRule(data: RecurringRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = recurringRuleSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { categoryId, ...restData } = validatedFields.data;
    const normalizedCategoryId =
      restData.type === "TRANSFER" ? null : categoryId?.trim() || null;

    // Validate category belongs to the current user (IDOR prevention)
    if (normalizedCategoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: normalizedCategoryId,
          userId: session.user.id,
        },
      });
      if (!category) {
        return { success: false, error: "Category not found" };
      }
    }

    const accountValidation = await validateOwnedRecurringAccount(
      session.user.id,
      restData.accountId
    );
    if (!accountValidation.success) {
      return { success: false, error: accountValidation.error };
    }

    // Encrypt sensitive fields
    const [encryptedName, encryptedDescription] = await Promise.all([
      encryptRequiredCompanion(session.user.id, "recurringRule.name", restData.name),
      encryptOptionalCompanion(session.user.id, "recurringRule.description", restData.description),
    ]);

    const rule = await prisma.recurringRule.create({
      data: {
        ...restData,
        name: null,
        nameEncrypted: encryptedName,
        // Nullify optional plaintext after encryption
        description: restData.description ? null : undefined,
        descriptionEncrypted: encryptedDescription,
        categoryId: normalizedCategoryId,
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/recurring");

    return { success: true, data: rule };
  } catch (error) {
    console.error("Create recurring rule error:", error);
    return { success: false, error: "Failed to create recurring rule" };
  }
}

export async function updateRecurringRule(
  id: string,
  data: Partial<RecurringRuleInput>
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existingRule = await prisma.recurringRule.findFirst({
      where: { id, userId: session.user.id },
      include: {
        subscription: {
          select: { id: true },
        },
      },
    });

    if (!existingRule) {
      return { success: false, error: "Recurring rule not found" };
    }

    if (existingRule.subscription) {
      return {
        success: false,
        error: "This recurring rule is managed by a subscription. Update it from the Subscriptions page.",
      };
    }

    const nextType = data.type ?? existingRule.type;
    const normalizedCategoryId =
      nextType === "TRANSFER"
        ? null
        : data.categoryId !== undefined
          ? data.categoryId?.trim() || null
          : undefined;

    // Validate category belongs to the current user (IDOR prevention)
    if (normalizedCategoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: normalizedCategoryId,
          userId: session.user.id,
        },
      });
      if (!category) {
        return { success: false, error: "Category not found" };
      }
    }

    const accountValidation = await validateOwnedRecurringAccount(
      session.user.id,
      data.accountId !== undefined ? data.accountId : existingRule.accountId
    );
    if (!accountValidation.success) {
      return { success: false, error: accountValidation.error };
    }

    // Encrypt sensitive fields if provided
    let encryptedName: string | undefined;
    let encryptedDescription: string | null | undefined;
    
    if (data.name !== undefined) {
      encryptedName = await encryptRequiredCompanion(
        session.user.id,
        "recurringRule.name",
        data.name
      );
    }
    if (data.description !== undefined) {
      encryptedDescription = await encryptOptionalCompanion(
        session.user.id,
        "recurringRule.description",
        data.description
      );
    }

    const updateData: Record<string, unknown> = {
      ...data,
      categoryId: normalizedCategoryId,
    };
    
    // If name is being updated, also store encrypted version
    if (data.name !== undefined) {
      updateData.name = null;
      updateData.nameEncrypted = encryptedName;
    }
    // If description is being updated, nullify plaintext and store encrypted
    if (data.description !== undefined) {
      updateData.description = data.description ? null : undefined;
      updateData.descriptionEncrypted = encryptedDescription;
    }

    const rule = await prisma.recurringRule.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/recurring");

    return { success: true, data: rule };
  } catch (error) {
    console.error("Update recurring rule error:", error);
    return { success: false, error: "Failed to update recurring rule" };
  }
}

export async function deleteRecurringRule(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const rule = await prisma.recurringRule.findFirst({
      where: { id, userId: session.user.id },
      include: {
        subscription: {
          select: { id: true },
        },
      },
    });

    if (!rule) {
      return { success: false, error: "Recurring rule not found" };
    }

    if (rule.subscription) {
      return {
        success: false,
        error: "This recurring rule is managed by a subscription. Unlink it from the Subscriptions page first.",
      };
    }

    await prisma.recurringRule.delete({ where: { id } });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/recurring");

    return { success: true };
  } catch (error) {
    console.error("Delete recurring rule error:", error);
    return { success: false, error: "Failed to delete recurring rule" };
  }
}

export async function getRecurringRules() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const rules = await prisma.recurringRule.findMany({
      where: { userId: session.user.id },
      include: {
        subscription: {
          select: { id: true },
        },
      },
      orderBy: { nextDueDate: "asc" },
    });
    const categoryIds = Array.from(
      new Set(rules.map((rule) => rule.categoryId).filter(Boolean) as string[])
    );
    const categories = categoryIds.length
      ? await prisma.category.findMany({
          where: {
            id: { in: categoryIds },
            userId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            icon: true,
          },
        })
      : [];
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    // Decrypt sensitive fields
    const decryptedRules = await Promise.all(
      rules.map(async (rule) => {
        const [finalName, finalDescription] = await Promise.all([
          decryptRequiredCompanion(
            session.user.id,
            "recurringRule.name",
            rule.nameEncrypted,
            rule.name
          ),
          decryptOptionalCompanion(
            session.user.id,
            "recurringRule.description",
            rule.descriptionEncrypted,
            rule.description
          ),
        ]);

        return {
          ...rule,
          name: finalName,
          description: finalDescription,
          category: rule.categoryId ? categoryMap.get(rule.categoryId) ?? null : null,
          subscriptionId: rule.subscription?.id ?? null,
        };
      })
    );

    return { success: true, data: decryptedRules };
  } catch (error) {
    console.error("Get recurring rules error:", error);
    return { success: false, error: "Failed to fetch recurring rules", data: [] };
  }
}

// Process due recurring transactions
// This should be called by a CRON job (e.g., Vercel Cron)
export async function processRecurringTransactions() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active rules due today or earlier
    const dueRules = await prisma.recurringRule.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
        OR: [
          { endDate: null },
          { endDate: { gte: today } },
        ],
      },
      include: {
        user: {
          select: { mainCurrency: true },
        },
      },
    });

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const rule of dueRules) {
      try {
        // Skip if no account is set
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
        const transactionDescription = description ?? name;
        const descriptionEncrypted = await encryptUserField(
          rule.userId,
          "transaction.description",
          transactionDescription
        );

        // Create the transaction
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const account = await tx.financialAccount.findFirst({
            where: {
              id: rule.accountId!,
              userId: rule.userId,
            },
            select: {
              id: true,
              type: true,
              isActive: true,
            },
          });

          if (!account) {
            throw new Error("Account not found");
          }

          if (!account.isActive) {
            throw new Error("Account is inactive");
          }

          if (isDepositoAccountType(account.type)) {
            throw new Error(
              "Deposito accounts cannot be used by recurring rules."
            );
          }

          // Create transaction
          await tx.transaction.create({
            data: {
              amount: rule.amount,
              currency: rule.currency,
              exchangeRate: 1, // TODO: Fetch actual exchange rate
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

          // Update account balance
          const balanceChange = rule.type === "INCOME" ? rule.amount : -rule.amount;
          await tx.financialAccount.update({
            where: { id: rule.accountId! },
            data: { balance: { increment: balanceChange } },
          });

          // Calculate next due date
          const nextDueDate = calculateNextDueDate(rule.nextDueDate, rule.interval);

          // Check if rule should be deactivated
          const shouldDeactivate = rule.endDate && nextDueDate > rule.endDate;

          // Update the rule
          await tx.recurringRule.update({
            where: { id: rule.id },
            data: {
              nextDueDate,
              isActive: !shouldDeactivate,
            },
          });

          await tx.subscription.updateMany({
            where: { recurringRuleId: rule.id },
            data: {
              nextBillingDate: nextDueDate,
            },
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

function calculateNextDueDate(
  currentDate: Date,
  interval: string
): Date {
  switch (interval) {
    case "DAILY":
      return addDays(currentDate, 1);
    case "WEEKLY":
      return addWeeks(currentDate, 1);
    case "BIWEEKLY":
      return addWeeks(currentDate, 2);
    case "MONTHLY":
      return addMonths(currentDate, 1);
    case "QUARTERLY":
      return addMonths(currentDate, 3);
    case "YEARLY":
      return addYears(currentDate, 1);
    default:
      return addMonths(currentDate, 1);
  }
}
