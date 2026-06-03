"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma/client/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";

// Define TransactionType enum locally since Prisma client may not be generated yet
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TransactionTypeEnum = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  TRANSFER: "TRANSFER",
  LIABILITY_PAYMENT: "LIABILITY_PAYMENT",
} as const;

type TransactionType = (typeof TransactionTypeEnum)[keyof typeof TransactionTypeEnum];

function normalizeOptionalText(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const transactionSchema = z
  .object({
    amount: z.number().positive("Amount must be positive"),
    currency: z.string().default("IDR"),
    exchangeRate: z.number().positive().default(1),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "LIABILITY_PAYMENT"]),
    description: z.string().optional(),
    location: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    googleMapsLink: z.string().optional(),
    date: z.date().default(() => new Date()),
    accountId: z.string().min(1, "From account is required"),
    toAccountId: z.string().optional(),
    categoryId: z.string().optional(),
    isRecurring: z.boolean().default(false),
    recurringRuleId: z.string().optional(),
    // Liability payment specific fields
    referenceNumber: z.string().optional(),
    // Audit field
    createdBy: z.string().optional(),
  })
  .refine(
    (data) => {
      // For TRANSFER type, toAccountId is required
      if (data.type === "TRANSFER") {
        return data.toAccountId && data.toAccountId.length > 0;
      }
      // For LIABILITY_PAYMENT type, toAccountId is required (target liability account)
      if (data.type === "LIABILITY_PAYMENT") {
        return data.toAccountId && data.toAccountId.length > 0;
      }
      return true;
    },
    {
      message: "To account is required for transfers and liability payments",
      path: ["toAccountId"],
    }
  )
  .refine(
    (data) => {
      // From and To accounts must be different for transfers and liability payments
      if ((data.type === "TRANSFER" || data.type === "LIABILITY_PAYMENT") && data.toAccountId) {
        return data.accountId !== data.toAccountId;
      }
      return true;
    },
    {
      message: "From and To accounts must be different",
      path: ["toAccountId"],
    }
  );

export type TransactionInput = z.infer<typeof transactionSchema>;

/**
 * Creates a financial transaction, adjusts the related account balance(s), and revalidates relevant caches.
 *
 * @param data - Transaction input validated by the file's `transactionSchema`. For transfers, `toAccountId` must be provided and differ from `accountId`.
 * @returns An object with `success: true` and the created transaction in `data` on success, or `success: false` and an `error` message on failure.
 */
export async function createTransaction(data: TransactionInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = transactionSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { amount, type, accountId, toAccountId, ...rest } = validatedFields.data;

    // Verify account belongs to user
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // For transfers, verify to account belongs to user and is a BANK account
    let toAccount = null;
    if (type === "TRANSFER") {
      if (!toAccountId) {
        return { success: false, error: "To account is required for transfers" };
      }

      toAccount = await prisma.financialAccount.findFirst({
        where: { id: toAccountId, userId: session.user.id },
      });

      if (!toAccount) {
        return { success: false, error: "To account not found" };
      }

      if (toAccount.type !== "BANK") {
        return { success: false, error: "Transfers can only be made to bank accounts" };
      }

      if (account.type !== "BANK") {
        return { success: false, error: "Transfers can only be made from bank accounts" };
      }

      if (accountId === toAccountId) {
        return { success: false, error: "Cannot transfer to the same account" };
      }
    }

    // Calculate balance change (for non-transfer types)
    const balanceChange = type === "INCOME" ? amount : -amount;

    // Sanitize optional FKs: empty string causes foreign key violation, use null
    const categoryId = rest.categoryId?.trim() || null;
    const recurringRuleId = rest.recurringRuleId?.trim() || null;

    // Validate category belongs to the current user (IDOR prevention)
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: session.user.id,
        },
      });
      if (!category) {
        return { success: false, error: "Category not found" };
      }
    }

    // Validate recurring rule belongs to user (IDOR prevention)
    if (recurringRuleId) {
      const recurringRule = await prisma.recurringRule.findFirst({
        where: { id: recurringRuleId, userId: session.user.id },
      });
      if (!recurringRule) {
        return { success: false, error: "Recurring rule not found" };
      }
    }

    // Encrypt sensitive fields
    const encryptedDescription = rest.description 
      ? await encryptUserField(session.user.id, "transaction.description", rest.description)
      : null;
    
    const encryptedReferenceNumber = rest.referenceNumber
      ? await encryptUserField(session.user.id, "transaction.referenceNumber", rest.referenceNumber)
      : null;
    
    const encryptedCreatedBy = rest.createdBy
      ? await encryptUserField(session.user.id, "transaction.createdBy", rest.createdBy)
      : null;

    const createData = {
      amount,
      type,
      accountId,
      userId: session.user.id,
      toAccountId: type === "TRANSFER" ? toAccountId : null,
      ...rest,
      location: normalizeOptionalText(rest.location) ?? null,
      latitude: rest.latitude ?? null,
      longitude: rest.longitude ?? null,
      googleMapsLink: normalizeOptionalText(rest.googleMapsLink) ?? null,
      description: null, // Nullify plaintext after encryption
      descriptionEncrypted: encryptedDescription,
      referenceNumber: null, // Nullify plaintext after encryption
      referenceNumberEncrypted: encryptedReferenceNumber,
      createdBy: null, // Nullify plaintext after encryption
      createdByEncrypted: encryptedCreatedBy,
      categoryId,
      recurringRuleId,
    };

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: createData,
      });

      if (type === "TRANSFER") {
        // For transfers: decrement from source account, increment to destination account
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: amount } },
        });

        await tx.financialAccount.update({
          where: { id: toAccountId },
          data: { balance: { increment: amount } },
        });
      } else {
        // For income/expense: update single account balance
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { increment: balanceChange } },
        });
      }

      return transaction;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/accounts");

    return { success: true, data: result };
  } catch (error) {
    console.error("Create transaction error:", error);
    return { success: false, error: "Failed to create transaction" };
  }
}

/**
 * Update an existing transaction and adjust affected account balances.
 *
 * Validates that the transaction and provided references belong to the current user, prevents editing of `LIABILITY_PAYMENT` transactions, requires a `toAccountId` when changing a transaction to `TRANSFER`, and revalidates related dashboard caches after applying balance changes and updating the record.
 *
 * @param id - The ID of the transaction to update
 * @param data - Partial transaction fields to apply; `categoryId` and `recurringRuleId` will be validated for ownership and normalized to `null` when empty
 * @returns `{ success: true }` on success, `{ success: false, error: string }` on failure
 */
export async function updateTransaction(
  id: string,
  data: Partial<TransactionInput>
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing transaction
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
      include: { account: true },
    });

    if (!existingTransaction) {
      return { success: false, error: "Transaction not found" };
    }

    const { amount, type, accountId, categoryId, recurringRuleId } = data;

    // Compute the new type (either from the patch or keep existing)
    const newType = type ?? existingTransaction.type;

    // Block editing of LIABILITY_PAYMENT transactions - they should be managed through the liability payment module
    // Also block any attempt to change a transaction's type TO LIABILITY_PAYMENT
    if (existingTransaction.type === "LIABILITY_PAYMENT" || newType === "LIABILITY_PAYMENT") {
      return { 
        success: false, 
        error: "Liability payment transactions cannot be edited here. Please use the Liabilities page to manage payments." 
      };
    }

    // Validate category belongs to the current user (IDOR prevention)
    if (categoryId !== undefined) {
      const sanitizedCategoryId = categoryId?.trim() || null;
      if (sanitizedCategoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: sanitizedCategoryId,
            userId: session.user.id,
          },
        });
        if (!category) {
          return { success: false, error: "Category not found" };
        }
      }
    }

    // Validate recurring rule belongs to user (IDOR prevention)
    if (recurringRuleId !== undefined) {
      const sanitizedRecurringRuleId = recurringRuleId?.trim() || null;
      if (sanitizedRecurringRuleId) {
        const recurringRule = await prisma.recurringRule.findFirst({
          where: { id: sanitizedRecurringRuleId, userId: session.user.id },
        });
        if (!recurringRule) {
          return { success: false, error: "Recurring rule not found" };
        }
      }
    }

    let encryptedDescription: string | null | undefined;
    if (data.description !== undefined) {
      const sanitizedDescription = normalizeOptionalText(data.description);
      encryptedDescription = sanitizedDescription
        ? await encryptUserField(
            session.user.id,
            "transaction.description",
            sanitizedDescription
          )
        : null;
    }

    const sanitizedLocation =
      data.location !== undefined ? normalizeOptionalText(data.location) : undefined;
    const sanitizedGoogleMapsLink =
      data.googleMapsLink !== undefined
        ? normalizeOptionalText(data.googleMapsLink)
        : undefined;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reverse old balance change
      if (existingTransaction.type === "TRANSFER" && existingTransaction.toAccountId) {
        // For transfers: reverse by incrementing source account and decrementing destination account
        await tx.financialAccount.update({
          where: { id: existingTransaction.accountId },
          data: { balance: { increment: existingTransaction.amount } },
        });
        await tx.financialAccount.update({
          where: { id: existingTransaction.toAccountId },
          data: { balance: { decrement: existingTransaction.amount } },
        });
      } else {
        // For income/expense: reverse against single account
        const oldBalanceChange =
          existingTransaction.type === "INCOME"
            ? -existingTransaction.amount
            : existingTransaction.amount;
        await tx.financialAccount.update({
          where: { id: existingTransaction.accountId },
          data: { balance: { increment: oldBalanceChange } },
        });
      }

      // Apply new balance change
      const newAmount = amount ?? existingTransaction.amount;
      const newType = type ?? existingTransaction.type;
      const newAccountId = accountId ?? existingTransaction.accountId;

      if (newType === "TRANSFER") {
        // For transfers: we need toAccountId - but current UI doesn't support editing transfers
        // This is a safeguard - transfers should be deleted and recreated if account changes needed
        const newToAccountId = data.toAccountId ?? existingTransaction.toAccountId;
        if (!newToAccountId) {
          throw new Error("To account is required for transfers");
        }
        // Decrement source account
        await tx.financialAccount.update({
          where: { id: newAccountId },
          data: { balance: { decrement: newAmount } },
        });
        // Increment destination account
        await tx.financialAccount.update({
          where: { id: newToAccountId },
          data: { balance: { increment: newAmount } },
        });
      } else {
        // For income/expense: apply to single account
        const newBalanceChange = newType === "INCOME" ? newAmount : -newAmount;
        await tx.financialAccount.update({
          where: { id: newAccountId },
          data: { balance: { increment: newBalanceChange } },
        });
      }

      // Update transaction
      await tx.transaction.update({
        where: { id },
        data: {
          amount: newAmount,
          type: newType,
          accountId: newAccountId,
          date: data.date ?? existingTransaction.date,
          description: data.description !== undefined ? null : undefined,
          descriptionEncrypted:
            data.description !== undefined ? encryptedDescription : undefined,
          location: sanitizedLocation,
          latitude: data.latitude !== undefined ? data.latitude ?? null : undefined,
          longitude: data.longitude !== undefined ? data.longitude ?? null : undefined,
          googleMapsLink: sanitizedGoogleMapsLink,
          categoryId: categoryId !== undefined ? (categoryId?.trim() || null) : undefined,
          recurringRuleId: recurringRuleId !== undefined ? (recurringRuleId?.trim() || null) : undefined,
        },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");

    return { success: true };
  } catch (error) {
    console.error("Update transaction error:", error);
    return { success: false, error: "Failed to update transaction" };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, amount: true, type: true, accountId: true, toAccountId: true },
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reverse balance change
      if (transaction.type === "TRANSFER" && transaction.toAccountId) {
        // For transfers: reverse by incrementing source account and decrementing destination account
        await tx.financialAccount.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: transaction.amount } },
        });
        await tx.financialAccount.update({
          where: { id: transaction.toAccountId },
          data: { balance: { decrement: transaction.amount } },
        });
      } else {
        // For income/expense: reverse against single account
        const balanceChange =
          transaction.type === "INCOME"
            ? -transaction.amount
            : transaction.amount;
        await tx.financialAccount.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });
      }

      // Delete transaction
      await tx.transaction.delete({ where: { id } });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");

    return { success: true };
  } catch (error) {
    console.error("Delete transaction error:", error);
    return { success: false, error: "Failed to delete transaction" };
  }
}

export async function getTransactions(options?: {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (options?.accountId) where.accountId = options.accountId;
    if (options?.categoryId) where.categoryId = options.categoryId;
    if (options?.type) where.type = options.type;
    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options?.startDate)
        (where.date as Record<string, Date>).gte = options.startDate;
      if (options?.endDate)
        (where.date as Record<string, Date>).lte = options.endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: true,
          category: true,
        },
        orderBy: { date: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    // Decrypt sensitive fields
    const decryptedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        // Use encrypted description if available, otherwise fall back to plaintext
        let finalDescription = tx.description;
        if (tx.descriptionEncrypted) {
          try {
            finalDescription = await decryptUserField(
              session.user.id,
              "transaction.description",
              tx.descriptionEncrypted
            );
          } catch {
            // If decryption fails, fall back to plaintext
            finalDescription = tx.description;
          }
        }

        // Use encrypted referenceNumber if available, otherwise fall back to plaintext
        let finalReferenceNumber = tx.referenceNumber;
        if (tx.referenceNumberEncrypted) {
          try {
            finalReferenceNumber = await decryptUserField(
              session.user.id,
              "transaction.referenceNumber",
              tx.referenceNumberEncrypted
            );
          } catch {
            // If decryption fails, fall back to plaintext
            finalReferenceNumber = tx.referenceNumber;
          }
        }

        // Use encrypted createdBy if available, otherwise fall back to plaintext
        let finalCreatedBy = tx.createdBy;
        if (tx.createdByEncrypted) {
          try {
            finalCreatedBy = await decryptUserField(
              session.user.id,
              "transaction.createdBy",
              tx.createdByEncrypted
            );
          } catch {
            // If decryption fails, fall back to plaintext
            finalCreatedBy = tx.createdBy;
          }
        }

        return {
          ...tx,
          description: finalDescription,
          referenceNumber: finalReferenceNumber,
          createdBy: finalCreatedBy,
        };
      })
    );

    return { success: true, data: decryptedTransactions, total };
  } catch (error) {
    console.error("Get transactions error:", error);
    return { success: false, error: "Failed to fetch transactions", data: [] };
  }
}

interface TransactionSummaryItem {
  amount: number;
  type: string;
  exchangeRate: number;
}

export async function getTransactionSummary(
  startDate?: Date,
  endDate?: Date
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, Date>).gte = startDate;
      if (endDate) (where.date as Record<string, Date>).lte = endDate;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        amount: true,
        type: true,
        exchangeRate: true,
      },
    });

    const summary = transactions.reduce(
      (acc: { totalIncome: number; totalExpense: number }, t: TransactionSummaryItem) => {
        const normalizedAmount = t.amount * t.exchangeRate;
        if (t.type === "INCOME") {
          acc.totalIncome += normalizedAmount;
        } else if (t.type === "EXPENSE") {
          acc.totalExpense += normalizedAmount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );

    return {
      success: true,
      data: {
        ...summary,
        netFlow: summary.totalIncome - summary.totalExpense,
      },
    };
  } catch (error) {
    console.error("Get transaction summary error:", error);
    return { success: false, error: "Failed to fetch summary" };
  }
}
