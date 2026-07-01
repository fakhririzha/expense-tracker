"use server";

import { auth } from "@/auth";
import {
  decryptAccountName,
  decryptAccountRecords,
  encryptAccountDescription,
  encryptAccountName,
  sortAccountsByName,
} from "@/lib/account-crypto";
import prisma from "@/lib/db";
import {
  calculateDepositoInterestAmount,
  DEPOSITO_INTEREST_FREQUENCIES,
  DEPOSITO_TERM_MODES,
  formatDateInput,
  getNextDepositoInterestDate,
  getTodayUtc,
  isValidDepositoMaturityDate,
  parseDateInput,
  roundDepositoMoney,
  type DepositoInterestFrequencyValue,
  type DepositoTermModeValue,
} from "@/lib/deposito";
import { getExchangeRate } from "@/lib/finance-service";
import { isDepositoAccountType, isLiquidAccountType } from "@/lib/account-types";
import { TransactionType, Prisma } from "@/generated/prisma/client/client";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const openDepositoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceAccountId: z.string().min(1, "Funding account is required"),
  amount: z.number().positive("Amount must be positive"),
  startDate: z.string().min(1, "Start date is required"),
  interestFrequency: z.enum(DEPOSITO_INTEREST_FREQUENCIES),
  interestRate: z.number().positive("Interest rate must be greater than zero"),
  taxRate: z
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%")
    .optional()
    .nullable(),
  termMode: z.enum(DEPOSITO_TERM_MODES),
  maturityDate: z.string().optional().nullable(),
  description: z.string().optional(),
});

const updateDepositoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  interestFrequency: z.enum(DEPOSITO_INTEREST_FREQUENCIES),
  interestRate: z.number().positive("Interest rate must be greater than zero"),
  taxRate: z
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%")
    .optional()
    .nullable(),
  termMode: z.enum(DEPOSITO_TERM_MODES),
  maturityDate: z.string().optional().nullable(),
  description: z.string().optional(),
});

const closeDepositoSchema = z.object({
  destinationAccountId: z.string().min(1, "Destination account is required"),
  closeDate: z.string().min(1, "Close date is required"),
  description: z.string().optional(),
});

export type OpenDepositoInput = z.infer<typeof openDepositoSchema>;
export type UpdateDepositoInput = z.infer<typeof updateDepositoSchema>;
export type CloseDepositoInput = z.infer<typeof closeDepositoSchema>;

interface DepositoAccountWithLinkedAccount {
  id: string;
  startDate: Date;
  principalAmount: number;
  interestFrequency: DepositoInterestFrequencyValue;
  interestRate: number;
  taxRate: number | null;
  termMode: DepositoTermModeValue;
  maturityDate: Date | null;
  nextInterestDate: Date | null;
  status: "ACTIVE" | "MATURED" | "CLOSED";
  closedAt: Date | null;
  accountId: string;
  openingTransactionId: string | null;
  closingTransactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  account: {
    id: string;
    nameEncrypted: string;
    descriptionEncrypted: string | null;
    type: string;
    currency: string;
    balance: number;
    isActive: boolean;
  };
}

function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function getDepositoState(input: {
  startDate: Date;
  interestFrequency: DepositoInterestFrequencyValue;
  termMode: DepositoTermModeValue;
  maturityDate: Date | null;
  lastPostedDate: Date | null;
}) {
  const nextInterestDate = getNextDepositoInterestDate(
    input.startDate,
    input.interestFrequency,
    input.lastPostedDate
  );

  if (
    input.termMode === "FIXED_TERM" &&
    input.maturityDate &&
    nextInterestDate.getTime() > input.maturityDate.getTime()
  ) {
    return {
      status: "MATURED" as const,
      nextInterestDate: null,
    };
  }

  return {
    status: "ACTIVE" as const,
    nextInterestDate,
  };
}

function validateDepositoDates(input: {
  startDate: Date;
  interestFrequency: DepositoInterestFrequencyValue;
  termMode: DepositoTermModeValue;
  maturityDate: Date | null;
}) {
  if (input.termMode === "OPEN_ENDED") {
    return { success: true as const };
  }

  if (!input.maturityDate) {
    return {
      success: false as const,
      error: "Maturity date is required for fixed-term deposito.",
    };
  }

  if (input.maturityDate.getTime() <= input.startDate.getTime()) {
    return {
      success: false as const,
      error: "Maturity date must be after the start date.",
    };
  }

  if (
    !isValidDepositoMaturityDate(
      input.startDate,
      input.interestFrequency,
      input.maturityDate
    )
  ) {
    return {
      success: false as const,
      error:
        "Maturity date must land on a valid interest posting date for the selected schedule.",
    };
  }

  return { success: true as const };
}

async function getDepositoInterestCategory(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const existingCategory = await tx.category.findFirst({
    where: {
      userId,
      type: TransactionType.INCOME,
      name: "Deposito Interest",
    },
    select: { id: true },
  });

  if (existingCategory) {
    return existingCategory.id;
  }

  const category = await tx.category.create({
    data: {
      userId,
      name: "Deposito Interest",
      icon: "🏦",
      color: "#0f766e",
      type: TransactionType.INCOME,
      isSystem: true,
    },
    select: { id: true },
  });

  return category.id;
}

async function decryptDepositoAccount(
  userId: string,
  deposito: DepositoAccountWithLinkedAccount
) {
  const [name, description] = await Promise.all([
    decryptAccountName(userId, deposito.account.nameEncrypted),
    deposito.account.descriptionEncrypted
      ? decryptUserField(
          userId,
          "account.description",
          deposito.account.descriptionEncrypted
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    ...deposito,
    account: {
      ...deposito.account,
      name,
      description,
    },
  };
}

function revalidateDepositoPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/deposito");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
}

async function loadDepositoForUser(
  userId: string,
  depositoId: string
): Promise<DepositoAccountWithLinkedAccount | null> {
  return prisma.depositoAccount.findFirst({
    where: { id: depositoId, userId },
    include: {
      account: {
        select: {
          id: true,
          nameEncrypted: true,
          descriptionEncrypted: true,
          type: true,
          currency: true,
          balance: true,
          isActive: true,
        },
      },
    },
  });
}

export async function openDeposito(data: OpenDepositoInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = openDepositoSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const description = normalizeOptionalText(validatedFields.data.description);
    const startDate = parseDateInput(validatedFields.data.startDate);
    const maturityDate = validatedFields.data.maturityDate
      ? parseDateInput(validatedFields.data.maturityDate)
      : null;
    const taxRate = validatedFields.data.taxRate ?? null;
    const dateValidation = validateDepositoDates({
      startDate,
      interestFrequency: validatedFields.data.interestFrequency,
      termMode: validatedFields.data.termMode,
      maturityDate,
    });

    if (!dateValidation.success) {
      return { success: false, error: dateValidation.error };
    }

    const fundingAccount = await prisma.financialAccount.findFirst({
      where: {
        id: validatedFields.data.sourceAccountId,
        userId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        currency: true,
        balance: true,
        isActive: true,
      },
    });

    if (!fundingAccount) {
      return { success: false, error: "Funding account not found." };
    }

    if (!fundingAccount.isActive) {
      return { success: false, error: "Funding account must be active." };
    }

    if (!isLiquidAccountType(fundingAccount.type)) {
      return {
        success: false,
        error: "Deposito can only be funded from a bank or cash account.",
      };
    }

    if (fundingAccount.balance < validatedFields.data.amount) {
      return { success: false, error: "Funding account has insufficient balance." };
    }

    const encryptedName = await encryptAccountName(
      session.user.id,
      validatedFields.data.name
    );
    const encryptedDescription = await encryptAccountDescription(
      session.user.id,
      description
    );
    const encryptedTransactionDescription = description
      ? await encryptUserField(
          session.user.id,
          "transaction.description",
          description
        )
      : null;
    const initialState = getDepositoState({
      startDate,
      interestFrequency: validatedFields.data.interestFrequency,
      termMode: validatedFields.data.termMode,
      maturityDate,
      lastPostedDate: null,
    });

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const depositoAccount = await tx.financialAccount.create({
          data: {
            nameEncrypted: encryptedName,
            descriptionEncrypted: encryptedDescription,
            type: "DEPOSITO",
            currency: fundingAccount.currency,
            balance: 0,
            isActive: true,
            userId: session.user.id,
          },
        });

        const transaction = await tx.transaction.create({
          data: {
            amount: validatedFields.data.amount,
            currency: fundingAccount.currency,
            exchangeRate: 1,
            type: TransactionType.TRANSFER,
            description: null,
            descriptionEncrypted: encryptedTransactionDescription,
            date: startDate,
            userId: session.user.id,
            accountId: fundingAccount.id,
            toAccountId: depositoAccount.id,
          },
        });

        await tx.financialAccount.update({
          where: { id: fundingAccount.id },
          data: { balance: { decrement: validatedFields.data.amount } },
        });
        await tx.financialAccount.update({
          where: { id: depositoAccount.id },
          data: { balance: { increment: validatedFields.data.amount } },
        });

        return tx.depositoAccount.create({
          data: {
            userId: session.user.id,
            accountId: depositoAccount.id,
            openingTransactionId: transaction.id,
            startDate,
            principalAmount: validatedFields.data.amount,
            interestFrequency: validatedFields.data.interestFrequency,
            interestRate: validatedFields.data.interestRate,
            taxRate,
            termMode: validatedFields.data.termMode,
            maturityDate,
            nextInterestDate: initialState.nextInterestDate,
            status: initialState.status,
          },
          include: {
            account: {
              select: {
                id: true,
                nameEncrypted: true,
                descriptionEncrypted: true,
                type: true,
                currency: true,
                balance: true,
                isActive: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    revalidateDepositoPaths();

    return {
      success: true,
      data: await decryptDepositoAccount(
        session.user.id,
        result as DepositoAccountWithLinkedAccount
      ),
    };
  } catch (error) {
    console.error("Open deposito error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to open deposito.",
    };
  }
}

export async function updateDeposito(id: string, data: UpdateDepositoInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = updateDepositoSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const existingDeposito = await loadDepositoForUser(session.user.id, id);
    if (!existingDeposito) {
      return { success: false, error: "Deposito not found." };
    }

    if (existingDeposito.status === "CLOSED") {
      return {
        success: false,
        error: "Closed deposito cannot be edited.",
      };
    }

    const description = normalizeOptionalText(validatedFields.data.description);
    const maturityDate = validatedFields.data.maturityDate
      ? parseDateInput(validatedFields.data.maturityDate)
      : null;
    const taxRate = validatedFields.data.taxRate ?? null;
    const dateValidation = validateDepositoDates({
      startDate: existingDeposito.startDate,
      interestFrequency: validatedFields.data.interestFrequency,
      termMode: validatedFields.data.termMode,
      maturityDate,
    });

    if (!dateValidation.success) {
      return { success: false, error: dateValidation.error };
    }

    const latestPosting = await prisma.depositoInterestPosting.findFirst({
      where: {
        depositoAccountId: existingDeposito.id,
      },
      select: {
        postingDate: true,
      },
      orderBy: {
        postingDate: "desc",
      },
    });

    const nextState = getDepositoState({
      startDate: existingDeposito.startDate,
      interestFrequency: validatedFields.data.interestFrequency,
      termMode: validatedFields.data.termMode,
      maturityDate,
      lastPostedDate: latestPosting?.postingDate ?? null,
    });

    const encryptedName = await encryptAccountName(
      session.user.id,
      validatedFields.data.name
    );
    const encryptedDescription = await encryptAccountDescription(
      session.user.id,
      description
    );

    const updatedDeposito = await prisma.$transaction(async (tx) => {
      await tx.financialAccount.update({
        where: { id: existingDeposito.accountId },
        data: {
          nameEncrypted: encryptedName,
          descriptionEncrypted: encryptedDescription,
        },
      });

      return tx.depositoAccount.update({
        where: { id },
        data: {
          interestFrequency: validatedFields.data.interestFrequency,
          interestRate: validatedFields.data.interestRate,
          taxRate,
          termMode: validatedFields.data.termMode,
          maturityDate,
          nextInterestDate: nextState.nextInterestDate,
          status: nextState.status,
          closedAt: null,
        },
        include: {
          account: {
            select: {
              id: true,
              nameEncrypted: true,
              descriptionEncrypted: true,
              type: true,
              currency: true,
              balance: true,
              isActive: true,
            },
          },
        },
      });
    });

    revalidateDepositoPaths();

    return {
      success: true,
      data: await decryptDepositoAccount(
        session.user.id,
        updatedDeposito as DepositoAccountWithLinkedAccount
      ),
    };
  } catch (error) {
    console.error("Update deposito error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update deposito.",
    };
  }
}

export async function closeDeposito(id: string, data: CloseDepositoInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = closeDepositoSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const closeDate = parseDateInput(validatedFields.data.closeDate);
    const description = normalizeOptionalText(validatedFields.data.description);
    const deposito = await loadDepositoForUser(session.user.id, id);

    if (!deposito) {
      return { success: false, error: "Deposito not found." };
    }

    if (deposito.status === "CLOSED") {
      return { success: false, error: "Deposito is already closed." };
    }

    if (!isDepositoAccountType(deposito.account.type)) {
      return { success: false, error: "Invalid deposito account." };
    }

    const destinationAccount = await prisma.financialAccount.findFirst({
      where: {
        id: validatedFields.data.destinationAccountId,
        userId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        currency: true,
        isActive: true,
      },
    });

    if (!destinationAccount) {
      return { success: false, error: "Destination account not found." };
    }

    if (!destinationAccount.isActive) {
      return { success: false, error: "Destination account must be active." };
    }

    if (!isLiquidAccountType(destinationAccount.type)) {
      return {
        success: false,
        error: "Deposito can only be closed into a bank or cash account.",
      };
    }

    if (destinationAccount.currency !== deposito.account.currency) {
      return {
        success: false,
        error:
          "Deposito can only be closed into an account with the same currency.",
      };
    }

    if (deposito.account.balance <= 0) {
      return { success: false, error: "Deposito balance is already zero." };
    }

    const encryptedDescription = description
      ? await encryptUserField(
          session.user.id,
          "transaction.description",
          description
        )
      : null;

    const result = await prisma.$transaction(
      async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            amount: deposito.account.balance,
            currency: deposito.account.currency,
            exchangeRate: 1,
            type: TransactionType.TRANSFER,
            description: null,
            descriptionEncrypted: encryptedDescription,
            date: closeDate,
            userId: session.user.id,
            accountId: deposito.accountId,
            toAccountId: destinationAccount.id,
          },
        });

        await tx.financialAccount.update({
          where: { id: deposito.accountId },
          data: {
            balance: { decrement: deposito.account.balance },
            isActive: false,
          },
        });

        await tx.financialAccount.update({
          where: { id: destinationAccount.id },
          data: {
            balance: { increment: deposito.account.balance },
          },
        });

        return tx.depositoAccount.update({
          where: { id },
          data: {
            status: "CLOSED",
            closedAt: closeDate,
            nextInterestDate: null,
            closingTransactionId: transaction.id,
          },
          include: {
            account: {
              select: {
                id: true,
                nameEncrypted: true,
                descriptionEncrypted: true,
                type: true,
                currency: true,
                balance: true,
                isActive: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    revalidateDepositoPaths();

    return {
      success: true,
      data: await decryptDepositoAccount(
        session.user.id,
        result as DepositoAccountWithLinkedAccount
      ),
    };
  } catch (error) {
    console.error("Close deposito error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to close deposito.",
    };
  }
}

export async function getDepositoSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const [user, depositos] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { mainCurrency: true },
      }),
      prisma.depositoAccount.findMany({
        where: { userId: session.user.id },
        include: {
          account: {
            select: {
              id: true,
              nameEncrypted: true,
              descriptionEncrypted: true,
              type: true,
              currency: true,
              balance: true,
              isActive: true,
            },
          },
          interestPostings: {
            select: {
              postingDate: true,
              netInterest: true,
            },
            orderBy: {
              postingDate: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const decryptedAccounts = sortAccountsByName(
      await decryptAccountRecords(
        session.user.id,
        depositos.map((deposito) => deposito.account)
      )
    );
    const accountMap = new Map(
      decryptedAccounts.map((account) => [account.id, account])
    );

    let totalDepositoValue = 0;
    let nextInterestDate: Date | null = null;

    const items = await Promise.all(
      depositos.map(async (deposito) => {
        const account = accountMap.get(deposito.account.id);
        if (!account) {
          throw new Error("Deposito account could not be decrypted.");
        }

        const rate =
          account.currency === user.mainCurrency
            ? 1
            : (await getExchangeRate(account.currency, user.mainCurrency)) ?? 1;

        totalDepositoValue += account.balance * rate;

        if (
          deposito.status === "ACTIVE" &&
          deposito.nextInterestDate &&
          (!nextInterestDate ||
            deposito.nextInterestDate.getTime() < nextInterestDate.getTime())
        ) {
          nextInterestDate = deposito.nextInterestDate;
        }

        return {
          id: deposito.id,
          startDate: deposito.startDate,
          principalAmount: deposito.principalAmount,
          interestFrequency: deposito.interestFrequency,
          interestRate: deposito.interestRate,
          taxRate: deposito.taxRate,
          termMode: deposito.termMode,
          maturityDate: deposito.maturityDate,
          nextInterestDate: deposito.nextInterestDate,
          status: deposito.status,
          closedAt: deposito.closedAt,
          openingTransactionId: deposito.openingTransactionId,
          closingTransactionId: deposito.closingTransactionId,
          createdAt: deposito.createdAt,
          updatedAt: deposito.updatedAt,
          latestInterestPosting: deposito.interestPostings[0] ?? null,
          account,
        };
      })
    );

    const activeCount = items.filter((item) => item.status === "ACTIVE").length;
    const maturedCount = items.filter((item) => item.status === "MATURED").length;
    const closedCount = items.filter((item) => item.status === "CLOSED").length;

    return {
      success: true,
      data: {
        totalDepositoValue,
        activeCount,
        maturedCount,
        closedCount,
        nextInterestDate,
        displayCurrency: user.mainCurrency,
        depositos: items.sort((left, right) =>
          left.account.name.localeCompare(right.account.name)
        ),
      },
    };
  } catch (error) {
    console.error("Get deposito summary error:", error);
    return { success: false, error: "Failed to fetch deposito summary." };
  }
}

export async function getDepositoInterestHistory(limit: number = 50) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const postings = await prisma.depositoInterestPosting.findMany({
      where: {
        depositoAccount: {
          userId: session.user.id,
        },
      },
      include: {
        depositoAccount: {
          include: {
            account: {
              select: {
                id: true,
                nameEncrypted: true,
                descriptionEncrypted: true,
                type: true,
                currency: true,
                balance: true,
                isActive: true,
              },
            },
          },
        },
        transaction: {
          select: {
            id: true,
            date: true,
            currency: true,
            description: true,
            descriptionEncrypted: true,
          },
        },
      },
      orderBy: {
        postingDate: "desc",
      },
      take: limit,
    });

    const history = await Promise.all(
      postings.map(async (posting) => {
        const [account, description] = await Promise.all([
          decryptDepositoAccount(session.user.id, posting.depositoAccount as DepositoAccountWithLinkedAccount),
          posting.transaction.descriptionEncrypted
            ? decryptUserField(
                session.user.id,
                "transaction.description",
                posting.transaction.descriptionEncrypted
              ).catch(() => posting.transaction.description)
            : Promise.resolve(posting.transaction.description),
        ]);

        return {
          id: posting.id,
          postingDate: posting.postingDate,
          grossInterest: posting.grossInterest,
          taxAmount: posting.taxAmount,
          netInterest: posting.netInterest,
          balanceBefore: posting.balanceBefore,
          balanceAfter: posting.balanceAfter,
          transactionId: posting.transactionId,
          transactionDate: posting.transaction.date,
          transactionDescription: description ?? null,
          depositoId: posting.depositoAccountId,
          account: account.account,
        };
      })
    );

    return {
      success: true,
      data: history,
    };
  } catch (error) {
    console.error("Get deposito history error:", error);
    return { success: false, error: "Failed to fetch deposito history.", data: [] };
  }
}

export async function processDepositoInterest() {
  try {
    const todayUtc = getTodayUtc();
    const dueDepositos = await prisma.depositoAccount.findMany({
      where: {
        status: "ACTIVE",
        nextInterestDate: {
          lte: todayUtc,
        },
      },
      select: {
        id: true,
      },
    });

    const results = {
      processedDepositos: 0,
      postedTransactions: 0,
      maturedDepositos: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const item of dueDepositos) {
      try {
        const postingCount = await prisma.$transaction(
          async (tx) => {
            const deposito = await tx.depositoAccount.findUnique({
              where: { id: item.id },
              include: {
                user: {
                  select: { id: true, mainCurrency: true },
                },
                account: {
                  select: {
                    id: true,
                    nameEncrypted: true,
                    currency: true,
                    balance: true,
                    isActive: true,
                    type: true,
                  },
                },
                interestPostings: {
                  select: {
                    postingDate: true,
                  },
                  orderBy: {
                    postingDate: "desc",
                  },
                  take: 1,
                },
              },
            });

            if (!deposito || deposito.status !== "ACTIVE" || !deposito.nextInterestDate) {
              return { posted: 0, matured: false };
            }

            if (!deposito.account.isActive || !isDepositoAccountType(deposito.account.type)) {
              await tx.depositoAccount.update({
                where: { id: deposito.id },
                data: {
                  status: "CLOSED",
                  nextInterestDate: null,
                  closedAt: deposito.closedAt ?? todayUtc,
                },
              });
              return { posted: 0, matured: false };
            }

            const categoryId = await getDepositoInterestCategory(tx, deposito.user.id);
            const accountName = await decryptAccountName(
              deposito.user.id,
              deposito.account.nameEncrypted
            );

            let currentBalance = deposito.account.balance;
            let currentDueDate: Date | null = deposito.nextInterestDate;
            let lastPostedDate = deposito.interestPostings[0]?.postingDate ?? null;
            let posted = 0;
            let matured = false;

            while (currentDueDate && currentDueDate.getTime() <= todayUtc.getTime()) {
              if (
                deposito.termMode === "FIXED_TERM" &&
                deposito.maturityDate &&
                currentDueDate.getTime() > deposito.maturityDate.getTime()
              ) {
                matured = true;
                currentDueDate = null;
                break;
              }

              const { grossInterest, taxAmount, netInterest } =
                calculateDepositoInterestAmount({
                  balance: currentBalance,
                  ratePercent: deposito.interestRate,
                  taxRatePercent: deposito.taxRate,
                });

              const exchangeRate =
                deposito.account.currency === deposito.user.mainCurrency
                  ? 1
                  : (await getExchangeRate(
                      deposito.account.currency,
                      deposito.user.mainCurrency
                    )) ?? 1;

              const transactionDescription = `Deposito interest for ${accountName}`;
              const encryptedDescription = await encryptUserField(
                deposito.user.id,
                "transaction.description",
                transactionDescription
              );

              const transaction = await tx.transaction.create({
                data: {
                  amount: netInterest,
                  currency: deposito.account.currency,
                  exchangeRate,
                  type: TransactionType.INCOME,
                  description: null,
                  descriptionEncrypted: encryptedDescription,
                  date: currentDueDate,
                  userId: deposito.user.id,
                  accountId: deposito.account.id,
                  categoryId,
                },
              });

              const balanceAfter = roundDepositoMoney(currentBalance + netInterest);

              await tx.financialAccount.update({
                where: { id: deposito.account.id },
                data: {
                  balance: {
                    increment: netInterest,
                  },
                },
              });

              await tx.depositoInterestPosting.create({
                data: {
                  depositoAccountId: deposito.id,
                  transactionId: transaction.id,
                  postingDate: currentDueDate,
                  grossInterest,
                  taxAmount,
                  netInterest,
                  balanceBefore: currentBalance,
                  balanceAfter,
                },
              });

              currentBalance = balanceAfter;
              lastPostedDate = currentDueDate;
              posted += 1;

              const nextState = getDepositoState({
                startDate: deposito.startDate,
                interestFrequency: deposito.interestFrequency,
                termMode: deposito.termMode,
                maturityDate: deposito.maturityDate,
                lastPostedDate,
              });

              currentDueDate = nextState.nextInterestDate;
              matured = nextState.status === "MATURED";

              if (matured) {
                currentDueDate = null;
              }
            }

            await tx.depositoAccount.update({
              where: { id: deposito.id },
              data: {
                nextInterestDate: currentDueDate,
                status: matured ? "MATURED" : "ACTIVE",
              },
            });

            return { posted, matured };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
          }
        );

        if (postingCount.posted > 0) {
          results.processedDepositos += 1;
          results.postedTransactions += postingCount.posted;
        }
        if (postingCount.matured) {
          results.maturedDepositos += 1;
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        console.error(`Process deposito interest error for ${item.id}:`, error);
        results.failed += 1;
        results.errors.push(
          `Deposito ${item.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (results.postedTransactions > 0 || results.maturedDepositos > 0) {
      revalidateDepositoPaths();
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error("Process deposito interest error:", error);
    return {
      success: false,
      error: "Failed to process deposito interest.",
    };
  }
}

export async function getManagedDepositoTransactionIds(userId: string) {
  const [depositos, postings] = await Promise.all([
    prisma.depositoAccount.findMany({
      where: { userId },
      select: {
        openingTransactionId: true,
        closingTransactionId: true,
      },
    }),
    prisma.depositoInterestPosting.findMany({
      where: {
        depositoAccount: {
          userId,
        },
      },
      select: {
        transactionId: true,
      },
    }),
  ]);

  const ids = new Set<string>();

  for (const deposito of depositos) {
    if (deposito.openingTransactionId) {
      ids.add(deposito.openingTransactionId);
    }
    if (deposito.closingTransactionId) {
      ids.add(deposito.closingTransactionId);
    }
  }

  for (const posting of postings) {
    ids.add(posting.transactionId);
  }

  return ids;
}

export async function isManagedDepositoTransaction(
  userId: string,
  transactionId: string
) {
  const [deposito, posting] = await Promise.all([
    prisma.depositoAccount.findFirst({
      where: {
        userId,
        OR: [
          { openingTransactionId: transactionId },
          { closingTransactionId: transactionId },
        ],
      },
      select: { id: true },
    }),
    prisma.depositoInterestPosting.findFirst({
      where: {
        transactionId,
        depositoAccount: {
          userId,
        },
      },
      select: { id: true },
    }),
  ]);

  return Boolean(deposito || posting);
}

export async function getDepositoFormDefaults() {
  const today = getTodayUtc();

  return {
    startDate: formatDateInput(today),
    closeDate: formatDateInput(today),
  };
}
