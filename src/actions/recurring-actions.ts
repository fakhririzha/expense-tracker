"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma/client/client";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

    // Validate category belongs to user OR is a system category (IDOR prevention)
    const { categoryId, ...restData } = validatedFields.data;
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          OR: [{ userId: session.user.id }, { isSystem: true }],
        },
      });
      if (!category) {
        return { success: false, error: "Category not found" };
      }
    }

    const rule = await prisma.recurringRule.create({
      data: {
        ...restData,
        categoryId: categoryId?.trim() || null,
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
    });

    if (!existingRule) {
      return { success: false, error: "Recurring rule not found" };
    }

    // Validate category belongs to user OR is a system category (IDOR prevention)
    if (data.categoryId !== undefined) {
      const sanitizedCategoryId = data.categoryId?.trim() || null;
      if (sanitizedCategoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: sanitizedCategoryId,
            OR: [{ userId: session.user.id }, { isSystem: true }],
          },
        });
        if (!category) {
          return { success: false, error: "Category not found" };
        }
      }
    }

    const rule = await prisma.recurringRule.update({
      where: { id },
      data: {
        ...data,
        categoryId: data.categoryId !== undefined ? (data.categoryId?.trim() || null) : undefined,
      },
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
    });

    if (!rule) {
      return { success: false, error: "Recurring rule not found" };
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
      orderBy: { nextDueDate: "asc" },
    });

    return { success: true, data: rules };
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

        // Create the transaction
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Create transaction
          await tx.transaction.create({
            data: {
              amount: rule.amount,
              currency: rule.currency,
              exchangeRate: 1, // TODO: Fetch actual exchange rate
              type: rule.type,
              description: rule.description || rule.name,
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
