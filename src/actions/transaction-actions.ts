"use server";

import { auth } from "@/auth";
import { decryptAccountName } from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma/client/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";
import {
  isLoanReceivableAccountType,
  isTransferAccountType,
} from "@/lib/account-types";
import {
  normalizeTransactionSplits,
  validateTransactionSplits,
  type NormalizedTransactionSplitInput,
} from "@/lib/transaction-split-validation";
import {
  DEFAULT_TRANSACTION_PAGE,
  DEFAULT_TRANSACTION_PAGE_SIZE,
  TRANSACTION_PAGE_SIZES,
  type PaginatedTransactionsData,
  type TransactionListQueryParams,
} from "@/types/transaction-list";

// Define TransactionType enum locally since Prisma client may not be generated yet
const TransactionTypeEnum = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  TRANSFER: "TRANSFER",
  LIABILITY_PAYMENT: "LIABILITY_PAYMENT",
} as const;

function normalizeOptionalText(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasMatchingTransferCurrency(
  sourceAccount: { currency: string },
  destinationAccount: { currency: string }
) {
  return sourceAccount.currency === destinationAccount.currency;
}

const transactionSchema = z
  .object({
    clientMutationId: z.string().uuid().optional(),
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
    splits: z
      .array(
        z.object({
          categoryId: z.string().optional().nullable(),
          amount: z.number().positive("Amount must be positive"),
          description: z.string().optional().nullable(),
          sortOrder: z.number().int().optional(),
        })
      )
      .optional(),
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

async function validateOwnedSplitCategories(
  userId: string,
  splits: NormalizedTransactionSplitInput[]
) {
  const categoryIds = Array.from(
    new Set(splits.map((split) => split.categoryId).filter(Boolean) as string[])
  );

  if (categoryIds.length === 0) {
    return { success: true as const };
  }

  const categories = await prisma.category.findMany({
    where: {
      userId,
      id: { in: categoryIds },
      type: TransactionTypeEnum.EXPENSE,
    },
    select: { id: true },
  });

  if (categories.length !== categoryIds.length) {
    return {
      success: false as const,
      error: "One or more split categories are invalid.",
    };
  }

  return { success: true as const };
}

async function buildSplitCreateData(
  userId: string,
  transactionId: string,
  splits: NormalizedTransactionSplitInput[]
) {
  return Promise.all(
    splits.map(async (split) => ({
      transactionId,
      userId,
      categoryId: split.categoryId,
      amount: split.amount,
      sortOrder: split.sortOrder,
      description: null,
      descriptionEncrypted: split.description
        ? await encryptUserField(userId, "transactionSplit.description", split.description)
        : null,
    }))
  );
}

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

    const { amount, type, accountId, toAccountId, splits, ...rest } = validatedFields.data;

    // Verify account belongs to user
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    if (!account.isActive) {
      return {
        success: false,
        error: "Account is inactive. Please choose an active account.",
      };
    }

    // For transfers, verify both accounts belong to the user and support transfers
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

      if (!toAccount.isActive) {
        return {
          success: false,
          error: "Destination account is inactive. Please choose an active account.",
        };
      }

      if (!isTransferAccountType(toAccount.type)) {
        return {
          success: false,
          error: "Transfers can only be made to bank, cash, or investment accounts",
        };
      }

      if (!isTransferAccountType(account.type)) {
        return {
          success: false,
          error: "Transfers can only be made from bank, cash, or investment accounts",
        };
      }

      if (accountId === toAccountId) {
        return { success: false, error: "Cannot transfer to the same account" };
      }

      if (!hasMatchingTransferCurrency(account, toAccount)) {
        return {
          success: false,
          error:
            "Transfers require source and destination accounts to use the same currency.",
        };
      }
    }

    // Calculate balance change (for non-transfer types)
    const balanceChange = type === "INCOME" ? amount : -amount;

    // Sanitize optional FKs: empty string causes foreign key violation, use null
    const categoryId = rest.categoryId?.trim() || null;
    const recurringRuleId = rest.recurringRuleId?.trim() || null;
    const splitValidation = validateTransactionSplits({
      type,
      amount,
      currency: rest.currency,
      splits,
    });

    if (!splitValidation.success) {
      return { success: false, error: splitValidation.error };
    }

    const normalizedSplits = splitValidation.data;

    // Validate category belongs to the current user (IDOR prevention)
    if (categoryId && normalizedSplits.length === 0) {
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

    if (normalizedSplits.length > 0) {
      const categoryValidation = await validateOwnedSplitCategories(
        session.user.id,
        normalizedSplits
      );
      if (!categoryValidation.success) {
        return { success: false, error: categoryValidation.error };
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
      categoryId: normalizedSplits.length > 0 ? null : categoryId,
      recurringRuleId,
    };

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: createData,
      });

      if (normalizedSplits.length > 0) {
        const splitData = await buildSplitCreateData(
          session.user.id,
          transaction.id,
          normalizedSplits
        );
        await tx.transactionSplit.createMany({
          data: splitData,
        });
      }

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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "This transaction was already submitted." };
    }
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
      include: { account: true, toAccount: true, splits: true },
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

    if (
      existingTransaction.type === "TRANSFER" &&
      (isLoanReceivableAccountType(existingTransaction.account.type) ||
        isLoanReceivableAccountType(existingTransaction.toAccount?.type ?? ""))
    ) {
      return {
        success: false,
        error:
          "Loans Receivable transfers cannot be edited here. Please manage them from the Loans Receivable page.",
      };
    }

    const nextAmount = amount ?? existingTransaction.amount;
    const nextCurrency = data.currency ?? existingTransaction.currency;
    const normalizedIncomingSplits =
      data.splits !== undefined
        ? normalizeTransactionSplits(data.splits)
        : normalizeTransactionSplits(existingTransaction.splits);
    const splitValidation = validateTransactionSplits({
      type: newType,
      amount: nextAmount,
      currency: nextCurrency,
      splits: data.splits !== undefined ? data.splits : existingTransaction.splits,
    });

    if (!splitValidation.success) {
      return { success: false, error: splitValidation.error };
    }

    const normalizedSplits = splitValidation.data;

    // Validate category belongs to the current user (IDOR prevention)
    if (categoryId !== undefined && normalizedSplits.length === 0) {
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

    if (normalizedIncomingSplits.length > 0) {
      const categoryValidation = await validateOwnedSplitCategories(
        session.user.id,
        normalizedIncomingSplits
      );
      if (!categoryValidation.success) {
        return { success: false, error: categoryValidation.error };
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

    if (newType === "TRANSFER") {
      const newSourceAccount = accountId
        ? await prisma.financialAccount.findFirst({
            where: { id: accountId, userId: session.user.id },
          })
        : existingTransaction.account;
      const newToAccountId = data.toAccountId ?? existingTransaction.toAccountId;
      const newTargetAccount = newToAccountId
        ? await prisma.financialAccount.findFirst({
            where: { id: newToAccountId, userId: session.user.id },
          })
        : null;

      if (!newSourceAccount || !newTargetAccount) {
        return { success: false, error: "Transfer accounts not found" };
      }

      const sourceRequiresActive =
        newType !== existingTransaction.type ||
        (accountId !== undefined && accountId !== existingTransaction.accountId);
      const targetRequiresActive =
        newType !== existingTransaction.type ||
        (data.toAccountId !== undefined &&
          data.toAccountId !== existingTransaction.toAccountId);

      if (sourceRequiresActive && !newSourceAccount.isActive) {
        return {
          success: false,
          error: "Source account is inactive. Please choose an active account.",
        };
      }

      if (targetRequiresActive && !newTargetAccount.isActive) {
        return {
          success: false,
          error: "Destination account is inactive. Please choose an active account.",
        };
      }

      if (
        isLoanReceivableAccountType(newSourceAccount.type) ||
        isLoanReceivableAccountType(newTargetAccount.type)
      ) {
        return {
          success: false,
          error:
            "Loans Receivable transfers cannot be edited here. Please manage them from the Loans Receivable page.",
        };
      }

      if (
        !isTransferAccountType(newSourceAccount.type) ||
        !isTransferAccountType(newTargetAccount.type)
      ) {
        return {
          success: false,
          error: "Transfers can only use bank, cash, or investment accounts",
        };
      }

      if (!hasMatchingTransferCurrency(newSourceAccount, newTargetAccount)) {
        return {
          success: false,
          error:
            "Transfers require source and destination accounts to use the same currency.",
        };
      }
    } else {
      const newAccount = accountId
        ? await prisma.financialAccount.findFirst({
            where: { id: accountId, userId: session.user.id },
          })
        : existingTransaction.account;

      if (!newAccount) {
        return { success: false, error: "Account not found" };
      }

      const accountRequiresActive =
        newType !== existingTransaction.type ||
        (accountId !== undefined && accountId !== existingTransaction.accountId);

      if (accountRequiresActive && !newAccount.isActive) {
        return {
          success: false,
          error: "Account is inactive. Please choose an active account.",
        };
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
          currency: data.currency ?? existingTransaction.currency,
          exchangeRate: data.exchangeRate ?? existingTransaction.exchangeRate,
          type: newType,
          accountId: newAccountId,
          toAccountId:
            newType === "TRANSFER"
              ? data.toAccountId ?? existingTransaction.toAccountId
              : null,
          date: data.date ?? existingTransaction.date,
          description: data.description !== undefined ? null : undefined,
          descriptionEncrypted:
            data.description !== undefined ? encryptedDescription : undefined,
          location: sanitizedLocation,
          latitude: data.latitude !== undefined ? data.latitude ?? null : undefined,
          longitude: data.longitude !== undefined ? data.longitude ?? null : undefined,
          googleMapsLink: sanitizedGoogleMapsLink,
          categoryId:
            normalizedSplits.length > 0
              ? null
              : categoryId !== undefined
                ? (categoryId?.trim() || null)
                : existingTransaction.categoryId,
          recurringRuleId: recurringRuleId !== undefined ? (recurringRuleId?.trim() || null) : undefined,
        },
      });

      await tx.transactionSplit.deleteMany({
        where: { transactionId: id, userId: session.user.id },
      });

      if (normalizedSplits.length > 0) {
        const splitData = await buildSplitCreateData(
          session.user.id,
          id,
          normalizedSplits
        );
        await tx.transactionSplit.createMany({
          data: splitData,
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/budgets");
    revalidatePath("/dashboard/reports");

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

function getEmptyTransactionPage(): PaginatedTransactionsData {
  return {
    transactions: [],
    total: 0,
    page: DEFAULT_TRANSACTION_PAGE,
    pageSize: DEFAULT_TRANSACTION_PAGE_SIZE,
    totalPages: 1,
  };
}

function normalizeTransactionPageSize(pageSize?: number) {
  if (pageSize && TRANSACTION_PAGE_SIZES.includes(pageSize as (typeof TRANSACTION_PAGE_SIZES)[number])) {
    return pageSize;
  }

  return DEFAULT_TRANSACTION_PAGE_SIZE;
}

function normalizeTransactionPage(page?: number) {
  if (page && Number.isInteger(page) && page > 0) {
    return page;
  }

  return DEFAULT_TRANSACTION_PAGE;
}

export async function getTransactions(options?: TransactionListQueryParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: getEmptyTransactionPage() };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (options?.accountId) where.accountId = options.accountId;
    if (options?.categoryId) {
      where.OR = [
        { categoryId: options.categoryId },
        { splits: { some: { categoryId: options.categoryId } } },
      ];
    }
    if (options?.type) where.type = options.type;
    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options?.startDate)
        (where.date as Record<string, Date>).gte = options.startDate;
      if (options?.endDate)
        (where.date as Record<string, Date>).lte = options.endDate;
    }

    const pageSize = normalizeTransactionPageSize(options?.pageSize);
    const requestedPage = normalizeTransactionPage(options?.page);
    const sortBy = options?.sortBy === "amount" ? "amount" : "date";
    const sortOrder = options?.sortOrder === "asc" ? "asc" : "desc";

    const total = await prisma.transaction.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * pageSize;
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      sortBy === "amount" ? { amount: sortOrder } : { date: sortOrder };

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: true,
        toAccount: true,
        category: true,
        splits: {
          include: {
            category: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy,
      take: pageSize,
      skip,
    });

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

        const [accountName, toAccountName, decryptedSplits] = await Promise.all([
          decryptAccountName(session.user.id, tx.account.nameEncrypted),
          tx.toAccount
            ? decryptAccountName(session.user.id, tx.toAccount.nameEncrypted)
            : Promise.resolve(null),
          Promise.all(
            tx.splits.map(async (split) => {
              let finalSplitDescription = split.description;
              if (split.descriptionEncrypted) {
                try {
                  finalSplitDescription = await decryptUserField(
                    session.user.id,
                    "transactionSplit.description",
                    split.descriptionEncrypted
                  );
                } catch {
                  finalSplitDescription = split.description;
                }
              }

              return {
                ...split,
                description: finalSplitDescription,
              };
            })
          ),
        ]);

        return {
          ...tx,
          account: {
            ...tx.account,
            name: accountName,
          },
          toAccount: tx.toAccount
            ? {
                ...tx.toAccount,
                name: toAccountName,
              }
            : null,
          description: finalDescription,
          referenceNumber: finalReferenceNumber,
          createdBy: finalCreatedBy,
          splits: decryptedSplits,
        };
      })
    );

    return {
      success: true,
      data: {
        transactions: decryptedTransactions,
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Get transactions error:", error);
    return { success: false, error: "Failed to fetch transactions", data: getEmptyTransactionPage() };
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
