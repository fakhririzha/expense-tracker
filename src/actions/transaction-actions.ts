"use server";

import { auth } from "@/auth";
import { Prisma, type AccountType } from "@/generated/prisma/client/client";
import { decryptAccountName } from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { isLoanReceivableAccountType, isTransferAccountType } from "@/lib/account-types";
import { decryptUserField, encryptUserField } from "@/lib/user-encryption";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
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

const TransactionTypeEnum = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  TRANSFER: "TRANSFER",
  LIABILITY_PAYMENT: "LIABILITY_PAYMENT",
} as const;

type TransactionTypeValue =
  (typeof TransactionTypeEnum)[keyof typeof TransactionTypeEnum];

type OwnedAccount = {
  id: string;
  type: AccountType;
  currency: string;
  isActive: boolean;
};

type TransactionBalanceEffect = {
  amount: number;
  type: TransactionTypeValue;
  accountId: string;
  toAccountId: string | null;
};

type PreparedSplitCreateData = {
  transactionId: string;
  userId: string;
  categoryId: string | null;
  amount: number;
  sortOrder: number;
  description: null;
  descriptionEncrypted: string | null;
};

function normalizeOptionalText(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeOptionalForeignKey(value?: string | null) {
  return value?.trim() || null;
}

function hasMatchingTransferCurrency(
  sourceAccount: { currency: string },
  destinationAccount: { currency: string }
) {
  return sourceAccount.currency === destinationAccount.currency;
}

function getBalanceChange(amount: number, type: TransactionTypeValue) {
  return type === TransactionTypeEnum.INCOME ? amount : -amount;
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
  if (
    pageSize &&
    TRANSACTION_PAGE_SIZES.includes(
      pageSize as (typeof TRANSACTION_PAGE_SIZES)[number]
    )
  ) {
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

function updateChangesBalances(
  existingTransaction: {
    amount: number;
    type: TransactionTypeValue;
    accountId: string;
    toAccountId: string | null;
  },
  nextTransaction: TransactionBalanceEffect
) {
  return (
    existingTransaction.amount !== nextTransaction.amount ||
    existingTransaction.type !== nextTransaction.type ||
    existingTransaction.accountId !== nextTransaction.accountId ||
    existingTransaction.toAccountId !== nextTransaction.toAccountId
  );
}

async function assertAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Unauthorized" };
  }

  return { success: true as const, userId: session.user.id };
}

async function loadOwnedAccounts(userId: string, accountIds: string[]) {
  const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, OwnedAccount>();
  }

  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      type: true,
      currency: true,
      isActive: true,
    },
  });

  return new Map(accounts.map((account) => [account.id, account]));
}

async function validateOwnedCategory(userId: string, categoryId: string | null) {
  if (!categoryId) {
    return { success: true as const };
  }

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId,
    },
    select: { id: true },
  });

  if (!category) {
    return { success: false as const, error: "Category not found" };
  }

  return { success: true as const };
}

async function validateOwnedRecurringRule(
  userId: string,
  recurringRuleId: string | null
) {
  if (!recurringRuleId) {
    return { success: true as const };
  }

  const recurringRule = await prisma.recurringRule.findFirst({
    where: { id: recurringRuleId, userId },
    select: { id: true },
  });

  if (!recurringRule) {
    return { success: false as const, error: "Recurring rule not found" };
  }

  return { success: true as const };
}

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
): Promise<PreparedSplitCreateData[]> {
  const encryptedDescriptions = await Promise.all(
    splits.map((split) =>
      split.description
        ? encryptUserField(
            userId,
            "transactionSplit.description",
            split.description
          )
        : Promise.resolve(null)
    )
  );

  return splits.map((split, index) => ({
    transactionId,
    userId,
    categoryId: split.categoryId,
    amount: split.amount,
    sortOrder: split.sortOrder,
    description: null,
    descriptionEncrypted: encryptedDescriptions[index],
  }));
}

async function decryptOptionalField(
  userId: string,
  fieldName:
    | "transaction.description"
    | "transaction.referenceNumber"
    | "transaction.createdBy"
    | "transactionSplit.description",
  encryptedValue: string | null,
  fallbackValue: string | null
) {
  if (!encryptedValue) {
    return fallbackValue;
  }

  try {
    return await decryptUserField(userId, fieldName, encryptedValue);
  } catch {
    return fallbackValue;
  }
}

async function reverseBalanceEffect(
  tx: Prisma.TransactionClient,
  transaction: TransactionBalanceEffect
) {
  if (transaction.type === TransactionTypeEnum.TRANSFER && transaction.toAccountId) {
    await tx.financialAccount.update({
      where: { id: transaction.accountId },
      data: { balance: { increment: transaction.amount } },
    });
    await tx.financialAccount.update({
      where: { id: transaction.toAccountId },
      data: { balance: { decrement: transaction.amount } },
    });
    return;
  }

  await tx.financialAccount.update({
    where: { id: transaction.accountId },
    data: { balance: { increment: -getBalanceChange(transaction.amount, transaction.type) } },
  });
}

async function applyBalanceEffect(
  tx: Prisma.TransactionClient,
  transaction: TransactionBalanceEffect
) {
  if (transaction.type === TransactionTypeEnum.TRANSFER) {
    if (!transaction.toAccountId) {
      throw new Error("To account is required for transfers");
    }

    await tx.financialAccount.update({
      where: { id: transaction.accountId },
      data: { balance: { decrement: transaction.amount } },
    });
    await tx.financialAccount.update({
      where: { id: transaction.toAccountId },
      data: { balance: { increment: transaction.amount } },
    });
    return;
  }

  await tx.financialAccount.update({
    where: { id: transaction.accountId },
    data: { balance: { increment: getBalanceChange(transaction.amount, transaction.type) } },
  });
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
    referenceNumber: z.string().optional(),
    createdBy: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.type === TransactionTypeEnum.TRANSFER ||
        data.type === TransactionTypeEnum.LIABILITY_PAYMENT
      ) {
        return Boolean(data.toAccountId && data.toAccountId.length > 0);
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
      if (
        (data.type === TransactionTypeEnum.TRANSFER ||
          data.type === TransactionTypeEnum.LIABILITY_PAYMENT) &&
        data.toAccountId
      ) {
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

export async function createTransaction(data: TransactionInput) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const validatedFields = transactionSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const userId = authResult.userId;
    const { amount, type, accountId, toAccountId, splits, ...rest } = validatedFields.data;
    const categoryId = sanitizeOptionalForeignKey(rest.categoryId);
    const recurringRuleId = sanitizeOptionalForeignKey(rest.recurringRuleId);

    const accountIds =
      type === TransactionTypeEnum.TRANSFER && toAccountId
        ? [accountId, toAccountId]
        : [accountId];
    const accountMap = await loadOwnedAccounts(userId, accountIds);
    const account = accountMap.get(accountId);

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    if (!account.isActive) {
      return {
        success: false,
        error: "Account is inactive. Please choose an active account.",
      };
    }

    let toAccount: OwnedAccount | null = null;
    if (type === TransactionTypeEnum.TRANSFER) {
      if (!toAccountId) {
        return { success: false, error: "To account is required for transfers" };
      }

      toAccount = accountMap.get(toAccountId) ?? null;

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

    const [
      categoryValidation,
      splitCategoryValidation,
      recurringRuleValidation,
      encryptedDescription,
      encryptedReferenceNumber,
      encryptedCreatedBy,
      preparedSplitData,
    ] = await Promise.all([
      normalizedSplits.length === 0
        ? validateOwnedCategory(userId, categoryId)
        : Promise.resolve({ success: true as const }),
      normalizedSplits.length > 0
        ? validateOwnedSplitCategories(userId, normalizedSplits)
        : Promise.resolve({ success: true as const }),
      validateOwnedRecurringRule(userId, recurringRuleId),
      rest.description
        ? encryptUserField(userId, "transaction.description", rest.description)
        : Promise.resolve(null),
      rest.referenceNumber
        ? encryptUserField(
            userId,
            "transaction.referenceNumber",
            rest.referenceNumber
          )
        : Promise.resolve(null),
      rest.createdBy
        ? encryptUserField(userId, "transaction.createdBy", rest.createdBy)
        : Promise.resolve(null),
      normalizedSplits.length > 0
        ? buildSplitCreateData(userId, "", normalizedSplits)
        : Promise.resolve([] as PreparedSplitCreateData[]),
    ]);

    if (!categoryValidation.success) {
      return { success: false, error: categoryValidation.error };
    }

    if (!splitCategoryValidation.success) {
      return { success: false, error: splitCategoryValidation.error };
    }

    if (!recurringRuleValidation.success) {
      return { success: false, error: recurringRuleValidation.error };
    }

    const createData = {
      amount,
      type,
      accountId,
      userId,
      toAccountId: type === TransactionTypeEnum.TRANSFER ? toAccountId : null,
      ...rest,
      location: normalizeOptionalText(rest.location) ?? null,
      latitude: rest.latitude ?? null,
      longitude: rest.longitude ?? null,
      googleMapsLink: normalizeOptionalText(rest.googleMapsLink) ?? null,
      description: null,
      descriptionEncrypted: encryptedDescription,
      referenceNumber: null,
      referenceNumberEncrypted: encryptedReferenceNumber,
      createdBy: null,
      createdByEncrypted: encryptedCreatedBy,
      categoryId: normalizedSplits.length > 0 ? null : categoryId,
      recurringRuleId,
    };

    const balanceEffect: TransactionBalanceEffect = {
      amount,
      type,
      accountId,
      toAccountId: type === TransactionTypeEnum.TRANSFER ? toAccountId ?? null : null,
    };

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transaction = await tx.transaction.create({
        data: createData,
      });

      if (preparedSplitData.length > 0) {
        await tx.transactionSplit.createMany({
          data: preparedSplitData.map((split) => ({
            ...split,
            transactionId: transaction.id,
          })),
        });
      }

      await applyBalanceEffect(tx, balanceEffect);

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

export async function updateTransaction(id: string, data: Partial<TransactionInput>) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const userId = authResult.userId;
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        account: {
          select: {
            id: true,
            type: true,
            currency: true,
            isActive: true,
          },
        },
        toAccount: {
          select: {
            id: true,
            type: true,
            currency: true,
            isActive: true,
          },
        },
        splits: {
          select: {
            id: true,
            amount: true,
            description: true,
            sortOrder: true,
            categoryId: true,
          },
        },
      },
    });

    if (!existingTransaction) {
      return { success: false, error: "Transaction not found" };
    }

    const { amount, type, accountId, categoryId, recurringRuleId } = data;
    const nextAmount = amount ?? existingTransaction.amount;
    const nextType = (type ?? existingTransaction.type) as TransactionTypeValue;
    const nextCurrency = data.currency ?? existingTransaction.currency;
    const nextAccountId = accountId ?? existingTransaction.accountId;
    const nextToAccountId =
      nextType === TransactionTypeEnum.TRANSFER
        ? data.toAccountId ?? existingTransaction.toAccountId
        : null;
    const shouldReplaceSplits = data.splits !== undefined;
    const splitValidation = validateTransactionSplits({
      type: nextType,
      amount: nextAmount,
      currency: nextCurrency,
      splits: data.splits !== undefined ? data.splits : existingTransaction.splits,
    });

    if (!splitValidation.success) {
      return { success: false, error: splitValidation.error };
    }

    const normalizedSplits = splitValidation.data;
    const sanitizedCategoryId =
      categoryId !== undefined ? sanitizeOptionalForeignKey(categoryId) : undefined;
    const sanitizedRecurringRuleId =
      recurringRuleId !== undefined
        ? sanitizeOptionalForeignKey(recurringRuleId)
        : undefined;

    if (
      existingTransaction.type === TransactionTypeEnum.LIABILITY_PAYMENT ||
      nextType === TransactionTypeEnum.LIABILITY_PAYMENT
    ) {
      return {
        success: false,
        error:
          "Liability payment transactions cannot be edited here. Please use the Liabilities page to manage payments.",
      };
    }

    if (
      existingTransaction.type === TransactionTypeEnum.TRANSFER &&
      (isLoanReceivableAccountType(existingTransaction.account.type) ||
        isLoanReceivableAccountType(existingTransaction.toAccount?.type ?? ""))
    ) {
      return {
        success: false,
        error:
          "Loans Receivable transfers cannot be edited here. Please manage them from the Loans Receivable page.",
      };
    }

    let nextSourceAccount = existingTransaction.account;
    let nextTargetAccount = existingTransaction.toAccount;

    const accountsToLoad: string[] = [];
    if (nextAccountId !== existingTransaction.accountId) {
      accountsToLoad.push(nextAccountId);
    }
    if (
      nextType === TransactionTypeEnum.TRANSFER &&
      nextToAccountId &&
      nextToAccountId !== existingTransaction.toAccountId
    ) {
      accountsToLoad.push(nextToAccountId);
    }

    if (accountsToLoad.length > 0) {
      const accountMap = await loadOwnedAccounts(userId, accountsToLoad);
      if (nextAccountId !== existingTransaction.accountId) {
        const loadedSourceAccount = accountMap.get(nextAccountId);
        if (!loadedSourceAccount) {
          return {
            success: false,
            error:
              nextType === TransactionTypeEnum.TRANSFER
                ? "Transfer accounts not found"
                : "Account not found",
          };
        }
        nextSourceAccount = loadedSourceAccount;
      }

      if (
        nextType === TransactionTypeEnum.TRANSFER &&
        nextToAccountId &&
        nextToAccountId !== existingTransaction.toAccountId
      ) {
        nextTargetAccount = accountMap.get(nextToAccountId) ?? null;
      }
    }

    if (nextType === TransactionTypeEnum.TRANSFER) {
      if (!nextToAccountId || !nextTargetAccount) {
        return { success: false, error: "Transfer accounts not found" };
      }

      const sourceRequiresActive =
        nextType !== existingTransaction.type ||
        nextAccountId !== existingTransaction.accountId;
      const targetRequiresActive =
        nextType !== existingTransaction.type ||
        nextToAccountId !== existingTransaction.toAccountId;

      if (sourceRequiresActive && !nextSourceAccount.isActive) {
        return {
          success: false,
          error: "Source account is inactive. Please choose an active account.",
        };
      }

      if (targetRequiresActive && !nextTargetAccount.isActive) {
        return {
          success: false,
          error: "Destination account is inactive. Please choose an active account.",
        };
      }

      if (
        isLoanReceivableAccountType(nextSourceAccount.type) ||
        isLoanReceivableAccountType(nextTargetAccount.type)
      ) {
        return {
          success: false,
          error:
            "Loans Receivable transfers cannot be edited here. Please manage them from the Loans Receivable page.",
        };
      }

      if (
        !isTransferAccountType(nextSourceAccount.type) ||
        !isTransferAccountType(nextTargetAccount.type)
      ) {
        return {
          success: false,
          error: "Transfers can only use bank, cash, or investment accounts",
        };
      }

      if (!hasMatchingTransferCurrency(nextSourceAccount, nextTargetAccount)) {
        return {
          success: false,
          error:
            "Transfers require source and destination accounts to use the same currency.",
        };
      }
    } else {
      const accountRequiresActive =
        nextType !== existingTransaction.type ||
        nextAccountId !== existingTransaction.accountId;

      if (accountRequiresActive && !nextSourceAccount.isActive) {
        return {
          success: false,
          error: "Account is inactive. Please choose an active account.",
        };
      }
    }

    const [
      categoryValidation,
      splitCategoryValidation,
      recurringRuleValidation,
      encryptedDescription,
      preparedSplitData,
    ] = await Promise.all([
      sanitizedCategoryId !== undefined && normalizedSplits.length === 0
        ? validateOwnedCategory(userId, sanitizedCategoryId)
        : Promise.resolve({ success: true as const }),
      shouldReplaceSplits && normalizedSplits.length > 0
        ? validateOwnedSplitCategories(userId, normalizedSplits)
        : Promise.resolve({ success: true as const }),
      sanitizedRecurringRuleId !== undefined
        ? validateOwnedRecurringRule(userId, sanitizedRecurringRuleId)
        : Promise.resolve({ success: true as const }),
      data.description !== undefined
        ? (() => {
            const sanitizedDescription = normalizeOptionalText(data.description);
            return sanitizedDescription
              ? encryptUserField(
                  userId,
                  "transaction.description",
                  sanitizedDescription
                )
              : Promise.resolve(null);
          })()
        : Promise.resolve(undefined),
      shouldReplaceSplits && normalizedSplits.length > 0
        ? buildSplitCreateData(userId, id, normalizedSplits)
        : Promise.resolve([] as PreparedSplitCreateData[]),
    ]);

    if (!categoryValidation.success) {
      return { success: false, error: categoryValidation.error };
    }

    if (!splitCategoryValidation.success) {
      return { success: false, error: splitCategoryValidation.error };
    }

    if (!recurringRuleValidation.success) {
      return { success: false, error: recurringRuleValidation.error };
    }

    const sanitizedLocation =
      data.location !== undefined ? normalizeOptionalText(data.location) : undefined;
    const sanitizedGoogleMapsLink =
      data.googleMapsLink !== undefined
        ? normalizeOptionalText(data.googleMapsLink)
        : undefined;

    const nextBalanceEffect: TransactionBalanceEffect = {
      amount: nextAmount,
      type: nextType,
      accountId: nextAccountId,
      toAccountId: nextToAccountId,
    };

    const requiresBalanceRecalculation = updateChangesBalances(
      {
        amount: existingTransaction.amount,
        type: existingTransaction.type as TransactionTypeValue,
        accountId: existingTransaction.accountId,
        toAccountId: existingTransaction.toAccountId,
      },
      nextBalanceEffect
    );

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (requiresBalanceRecalculation) {
        await reverseBalanceEffect(tx, {
          amount: existingTransaction.amount,
          type: existingTransaction.type as TransactionTypeValue,
          accountId: existingTransaction.accountId,
          toAccountId: existingTransaction.toAccountId,
        });
        await applyBalanceEffect(tx, nextBalanceEffect);
      }

      await tx.transaction.update({
        where: { id },
        data: {
          amount: nextAmount,
          currency: data.currency ?? existingTransaction.currency,
          exchangeRate: data.exchangeRate ?? existingTransaction.exchangeRate,
          type: nextType,
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
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
              : sanitizedCategoryId !== undefined
                ? sanitizedCategoryId
                : existingTransaction.categoryId,
          recurringRuleId:
            sanitizedRecurringRuleId !== undefined
              ? sanitizedRecurringRuleId
              : undefined,
        },
      });

      if (shouldReplaceSplits) {
        await tx.transactionSplit.deleteMany({
          where: { transactionId: id, userId },
        });

        if (preparedSplitData.length > 0) {
          await tx.transactionSplit.createMany({
            data: preparedSplitData,
          });
        }
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
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: authResult.userId },
      select: {
        id: true,
        amount: true,
        type: true,
        accountId: true,
        toAccountId: true,
      },
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await reverseBalanceEffect(tx, {
        amount: transaction.amount,
        type: transaction.type as TransactionTypeValue,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
      });

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

export async function getTransactions(options?: TransactionListQueryParams) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error,
        data: getEmptyTransactionPage(),
      };
    }

    const userId = authResult.userId;
    const where: Prisma.TransactionWhereInput = {
      userId,
    };

    if (options?.accountId) {
      where.accountId = options.accountId;
    }
    if (options?.categoryId) {
      where.OR = [
        { categoryId: options.categoryId },
        { splits: { some: { categoryId: options.categoryId } } },
      ];
    }
    if (options?.type) {
      where.type = options.type;
    }
    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options.startDate) {
        where.date.gte = options.startDate;
      }
      if (options.endDate) {
        where.date.lte = options.endDate;
      }
    }

    const pageSize = normalizeTransactionPageSize(options?.pageSize);
    const requestedPage = normalizeTransactionPage(options?.page);
    const sortBy = options?.sortBy === "amount" ? "amount" : "date";
    const sortOrder = options?.sortOrder === "asc" ? "asc" : "desc";

    const initialTotal = await prisma.transaction.count({ where });
    const totalPages = Math.max(1, Math.ceil(initialTotal / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * pageSize;
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      sortBy === "amount" ? { amount: sortOrder } : { date: sortOrder };

    const [total, transactions] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          amount: true,
          currency: true,
          exchangeRate: true,
          type: true,
          description: true,
          descriptionEncrypted: true,
          location: true,
          latitude: true,
          longitude: true,
          googleMapsLink: true,
          date: true,
          isRecurring: true,
          toAccountId: true,
          referenceNumber: true,
          referenceNumberEncrypted: true,
          createdBy: true,
          createdByEncrypted: true,
          account: {
            select: {
              id: true,
              nameEncrypted: true,
              type: true,
            },
          },
          toAccount: {
            select: {
              id: true,
              nameEncrypted: true,
              type: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
          splits: {
            select: {
              id: true,
              amount: true,
              description: true,
              descriptionEncrypted: true,
              sortOrder: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  icon: true,
                  color: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy,
        take: pageSize,
        skip,
      }),
    ]);

    const accountNameCache = new Map<string, Promise<string>>();
    const decryptAccountNameCached = (account: {
      id: string;
      nameEncrypted: string;
    }) => {
      const cached = accountNameCache.get(account.id);
      if (cached) {
        return cached;
      }

      const pending = decryptAccountName(userId, account.nameEncrypted);
      accountNameCache.set(account.id, pending);
      return pending;
    };

    const decryptOptionalAccountNameCached = (account: {
      id: string;
      nameEncrypted: string;
    } | null) => {
      if (!account) {
        return Promise.resolve(null);
      }

      return decryptAccountNameCached(account);
    };

    const decryptedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        const [
          description,
          referenceNumber,
          createdBy,
          accountName,
          toAccountName,
          decryptedSplits,
        ] = await Promise.all([
          decryptOptionalField(
            userId,
            "transaction.description",
            transaction.descriptionEncrypted,
            transaction.description
          ),
          decryptOptionalField(
            userId,
            "transaction.referenceNumber",
            transaction.referenceNumberEncrypted,
            transaction.referenceNumber
          ),
          decryptOptionalField(
            userId,
            "transaction.createdBy",
            transaction.createdByEncrypted,
            transaction.createdBy
          ),
          decryptAccountNameCached(transaction.account),
          decryptOptionalAccountNameCached(transaction.toAccount),
          Promise.all(
            transaction.splits.map(async (split) => ({
              ...split,
              description: await decryptOptionalField(
                userId,
                "transactionSplit.description",
                split.descriptionEncrypted,
                split.description
              ),
            }))
          ),
        ]);

        return {
          ...transaction,
          account: {
            id: transaction.account.id,
            name: accountName,
            type: transaction.account.type,
          },
          toAccount: transaction.toAccount
            ? {
                id: transaction.toAccount.id,
                name: toAccountName,
                type: transaction.toAccount.type,
              }
            : null,
          description,
          referenceNumber,
          createdBy,
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
    return {
      success: false,
      error: "Failed to fetch transactions",
      data: getEmptyTransactionPage(),
    };
  }
}

interface TransactionSummaryItem {
  amount: number;
  type: string;
  exchangeRate: number;
}

export async function getTransactionSummary(startDate?: Date, endDate?: Date) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const where: Prisma.TransactionWhereInput = {
      userId: authResult.userId,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
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
      (
        acc: { totalIncome: number; totalExpense: number },
        transaction: TransactionSummaryItem
      ) => {
        const normalizedAmount = transaction.amount * transaction.exchangeRate;
        if (transaction.type === TransactionTypeEnum.INCOME) {
          acc.totalIncome += normalizedAmount;
        } else if (transaction.type === TransactionTypeEnum.EXPENSE) {
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
