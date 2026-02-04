"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma, PaymentStatus, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  validateLiabilityPayment,
  generatePaymentReference as generateRef,
} from "@/lib/liability-payment-validation";

// Schema for liability payment input
const liabilityPaymentSchema = z.object({
  sourceAccountId: z.string().min(1, "Source account is required"),
  targetAccountId: z.string().min(1, "Target liability account is required"),
  amount: z.number().positive("Payment amount must be positive"),
  currency: z.string().default("IDR"),
  exchangeRate: z.number().positive().default(1),
  description: z.string().min(1, "Description is required"),
  date: z.date().default(() => new Date()),
  referenceNumber: z.string().min(1, "Reference number is required"),
  allowOverpayment: z.boolean().default(false),
});

export type LiabilityPaymentInput = z.infer<typeof liabilityPaymentSchema>;

export interface PaymentResult {
  success: boolean;
  data?: {
    transactionId: string;
    referenceNumber: string;
    sourceAccountId: string;
    targetAccountId: string;
    amount: number;
    sourceBalanceAfter: number;
    targetBalanceAfter: number;
  };
  error?: string;
  errorCode?: string;
}

/**
 * Create a liability payment using double-entry accounting and record an audit trail.
 *
 * @param data - Input fields required to perform the payment: sourceAccountId, targetAccountId, amount, currency, exchangeRate, description, date, referenceNumber, and allowOverpayment.
 * @returns A PaymentResult object. On success `data` contains `transactionId`, `referenceNumber`, `sourceAccountId`, `targetAccountId`, `amount`, `sourceBalanceAfter`, and `targetBalanceAfter`. On failure contains `error` and an `errorCode` such as `AUTH_REQUIRED`, `VALIDATION_ERROR`, `DUPLICATE_REFERENCE`, `RECORD_NOT_FOUND`, `RACE_CONDITION`, or `TRANSACTION_FAILED`.
 */
export async function createLiabilityPayment(
  data: LiabilityPaymentInput
): Promise<PaymentResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        errorCode: "AUTH_REQUIRED",
        error: "Please log in to continue.",
      };
    }

    const userId = session.user.id;

    // Step 1: Validate input schema
    const validatedFields = liabilityPaymentSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        error: validatedFields.error.issues[0].message,
      };
    }

    const {
      sourceAccountId,
      targetAccountId,
      amount,
      currency,
      exchangeRate,
      description,
      date,
      referenceNumber,
      allowOverpayment,
    } = validatedFields.data;

    // Step 2: Comprehensive business validation
    const validationResult = await validateLiabilityPayment(userId, {
      sourceAccountId,
      targetAccountId,
      amount,
      referenceNumber,
      allowOverpayment,
    });

    if (!validationResult.valid || !validationResult.data) {
      return {
        success: false,
        errorCode: validationResult.errorCode,
        error: validationResult.error || "Validation failed",
      };
    }

    // Step 3: Execute atomic transaction
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 3a. Re-read accounts with fresh balances inside transaction to avoid race conditions
        const sourceAccount = await tx.financialAccount.findUnique({
          where: { id: sourceAccountId },
        });

        const targetAccount = await tx.financialAccount.findUnique({
          where: { id: targetAccountId },
        });

        if (!sourceAccount || !targetAccount) {
          throw new Error("Account not found during transaction");
        }

        const sourceBalanceBefore = sourceAccount.balance;
        const targetBalanceBefore = targetAccount.balance;

        // 3b. Create transaction record with PENDING status
        const transaction = await tx.transaction.create({
          data: {
            amount,
            currency,
            exchangeRate,
            type: TransactionType.LIABILITY_PAYMENT, // Payments are treated as expenses
            description,
            date,
            referenceNumber,
            isOverpayment: allowOverpayment && amount > Math.abs(targetBalanceBefore),
            paymentStatus: PaymentStatus.PROCESSING,
            createdBy: userId,
            processedAt: new Date(),
            userId,
            accountId: sourceAccountId, // Source account is the "from" account
            toAccountId: targetAccountId, // Target account is the "to" account
          },
        });

        // 3c. Lock and update source account balance (credit/decrease)
        const updatedSourceAccount = await tx.financialAccount.update({
          where: { id: sourceAccountId },
          data: { balance: { decrement: amount } },
        });

        // 3d. Lock and update target account balance (debit/increase toward zero)
        // For liability accounts, balance is negative (debt)
        // Payment increases the balance (reduces debt)
        const updatedTargetAccount = await tx.financialAccount.update({
          where: { id: targetAccountId },
          data: { balance: { increment: amount } },
        });

        // 3e. Create audit trail record with consistent in-transaction balances
        await tx.liabilityPaymentAudit.create({
          data: {
            transactionId: transaction.id,
            sourceAccountId,
            sourceBalanceBefore,
            sourceBalanceAfter: updatedSourceAccount.balance,
            targetAccountId,
            targetBalanceBefore,
            targetBalanceAfter: updatedTargetAccount.balance,
            paymentAmount: amount,
            currency,
            exchangeRate,
            executedBy: userId,
            executedAt: new Date(),
          },
        });

        // 3f. Update transaction status to COMPLETED
        const completedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: { paymentStatus: PaymentStatus.COMPLETED },
        });

        return {
          transaction: completedTransaction,
          sourceBalanceAfter: updatedSourceAccount.balance,
          targetBalanceAfter: updatedTargetAccount.balance,
        };
      },
      {
        // Use serializable isolation to prevent race conditions
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      }
    );

    // Step 4: Revalidate cache paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/liabilities");

    return {
      success: true,
      data: {
        transactionId: result.transaction.id,
        referenceNumber,
        sourceAccountId,
        targetAccountId,
        amount,
        sourceBalanceAfter: result.sourceBalanceAfter,
        targetBalanceAfter: result.targetBalanceAfter,
      },
    };
  } catch (error) {
    console.error("Create liability payment error:", error);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          success: false,
          errorCode: "DUPLICATE_REFERENCE",
          error: "A payment with this reference number already exists. Please use a unique reference.",
        };
      }
      if (error.code === "P2025") {
        return {
          success: false,
          errorCode: "RECORD_NOT_FOUND",
          error: "One of the accounts was not found or was modified during processing.",
        };
      }
    }

    // Handle transaction timeout/serialization errors
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      error.message.includes("deadlock")
    ) {
      return {
        success: false,
        errorCode: "RACE_CONDITION",
        error:
          "Another transaction is currently processing. Please wait a moment and try again.",
      };
    }

    return {
      success: false,
      errorCode: "TRANSACTION_FAILED",
      error:
        "Failed to process the payment. Please try again or contact support if the issue persists.",
    };
  }
}

/**
 * Fetches a liability payment transaction along with its related accounts and audit trail.
 *
 * @returns On success, an object with `success: true` and `data` containing the transaction (including `account`, `toAccount`, and `liabilityPaymentAudit`); on failure, an object with `success: false` and an `error` message.
 */
export async function getLiabilityPaymentDetails(transactionId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: session.user.id,
        type: TransactionType.EXPENSE,
        toAccountId: { not: null },
      },
      include: {
        account: true,
        toAccount: true,
        liabilityPaymentAudit: true,
      },
    });

    if (!transaction) {
      return {
        success: false,
        error: "Payment not found",
      };
    }

    return {
      success: true,
      data: transaction,
    };
  } catch (error) {
    console.error("Get liability payment details error:", error);
    return {
      success: false,
      error: "Failed to fetch payment details",
    };
  }
}

/**
 * Roll back a recent liability payment and reverse its accounting effects.
 *
 * This reverses the original payment within a 24-hour rollback window by crediting the source account, debiting the target account, marking the audit record as rolled back, and updating the transaction status to ROLLED_BACK.
 *
 * @param transactionId - The ID of the transaction to roll back
 * @param reason - The reason for performing the rollback (stored on the audit record)
 * @returns An object with `success` `true` and `data` containing the updated transaction on success; otherwise `success` `false` and `error` containing a failure message
 */
export async function rollbackLiabilityPayment(
  transactionId: string,
  reason: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Only allow rollback for recent payments (e.g., within 24 hours)
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Fetch the original payment
        const transaction = await tx.transaction.findFirst({
          where: {
            id: transactionId,
            userId: session.user.id,
          },
          include: {
            liabilityPaymentAudit: true,
          },
        });

        if (!transaction) {
          throw new Error("Payment not found");
        }

        if (!transaction.liabilityPaymentAudit) {
          throw new Error("No audit record found for this payment");
        }

        if (transaction.liabilityPaymentAudit.isRolledBack) {
          throw new Error("Payment has already been rolled back");
        }

        // Check if payment is within rollback window (24 hours)
        const paymentTime = new Date(transaction.processedAt).getTime();
        const currentTime = new Date().getTime();
        const hoursSincePayment = (currentTime - paymentTime) / (1000 * 60 * 60);

        if (hoursSincePayment > 24) {
          throw new Error(
            "Payments can only be rolled back within 24 hours of processing"
          );
        }

        const { liabilityPaymentAudit } = transaction;

        // Reverse the payment:
        // 1. Add back to source account (credit back)
        await tx.financialAccount.update({
          where: { id: liabilityPaymentAudit.sourceAccountId },
          data: { balance: { increment: liabilityPaymentAudit.paymentAmount } },
        });

        // 2. Subtract from target account (debit back)
        await tx.financialAccount.update({
          where: { id: liabilityPaymentAudit.targetAccountId },
          data: { balance: { decrement: liabilityPaymentAudit.paymentAmount } },
        });

        // 3. Mark audit record as rolled back
        await tx.liabilityPaymentAudit.update({
          where: { transactionId },
          data: {
            isRolledBack: true,
            rolledBackAt: new Date(),
            rollbackReason: reason,
          },
        });

        // 4. Update transaction status
        const updatedTransaction = await tx.transaction.update({
          where: { id: transactionId },
          data: { paymentStatus: PaymentStatus.ROLLED_BACK },
        });

        return updatedTransaction;
      },
      {
        // Use serializable isolation to prevent race conditions
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000, // 5 seconds max to wait for lock
        timeout: 10000, // 10 seconds max transaction duration
      }
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/accounts");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Rollback liability payment error:", error);

    // Handle transaction timeout/serialization errors
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      error.message.includes("deadlock")
    ) {
      return {
        success: false,
        errorCode: "RACE_CONDITION",
        error:
          "Another rollback is currently processing. Please wait a moment and try again.",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rollback payment",
    };
  }
}

/**
 * Retrieve liability payment records with optional account, pagination, and date-range filters.
 *
 * @param accountId - If provided, limits results to payments made to the specified liability account
 * @param options.limit - Maximum number of records to return (defaults to 50)
 * @param options.offset - Number of records to skip (for pagination)
 * @param options.startDate - Include payments on or after this date
 * @param options.endDate - Include payments on or before this date
 * @returns An object with `success` indicating operation result, `data` containing an array of transaction records (each including related account, toAccount, and a liability payment audit subset), and `total` with the total matching count when successful; `error` contains a message on failure
 */
export async function getLiabilityPaymentHistory(
  accountId?: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized",
        data: [],
      };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
      type: TransactionType.EXPENSE,
      toAccountId: { not: null },
      referenceNumber: { not: null }, // Only liability payments have reference numbers
    };

    if (accountId) {
      where.toAccountId = accountId;
    }

    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options?.startDate)
        (where.date as Record<string, Date>).gte = options.startDate;
      if (options?.endDate)
        (where.date as Record<string, Date>).lte = options.endDate;
    }

    const [payments, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: true,
          toAccount: true,
          liabilityPaymentAudit: {
            select: {
              sourceBalanceBefore: true,
              sourceBalanceAfter: true,
              targetBalanceBefore: true,
              targetBalanceAfter: true,
              isRolledBack: true,
            },
          },
        },
        orderBy: { date: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      success: true,
      data: payments,
      total,
    };
  } catch (error) {
    console.error("Get liability payment history error:", error);
    return {
      success: false,
      error: "Failed to fetch payment history",
      data: [],
    };
  }
}

/**
 * Generate a unique liability payment reference in the format `LP-YYYYMMDD-XXXX`.
 *
 * Attempts up to 10 generated candidates to ensure uniqueness against existing transactions before failing.
 *
 * @returns An object with `success` indicating whether a unique reference was produced; on success `reference` contains the generated reference in the `LP-YYYYMMDD-XXXX` format, on failure `error` contains a human-readable message.
 */
export async function generatePaymentReference(): Promise<{
  success: boolean;
  reference?: string;
  error?: string;
}> {
  try {
    let reference: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    // Keep generating until we find a unique reference
    while (!isUnique && attempts < maxAttempts) {
      reference = generateRef();
      const existing = await prisma.transaction.findUnique({
        where: { referenceNumber: reference },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return {
        success: false,
        error: "Could not generate unique reference number. Please try again.",
      };
    }

    return {
      success: true,
      reference: reference!,
    };
  } catch (error) {
    console.error("Generate reference error:", error);
    return {
      success: false,
      error: "Failed to generate reference number",
    };
  }
}

/**
 * Produce aggregated statistics for completed liability payments, optionally limited to a date range.
 *
 * @param startDate - Inclusive start of the date range to include in the summary
 * @param endDate - Inclusive end of the date range to include in the summary
 * @returns An object with:
 *   - `totalPayments`: total number of matching payments,
 *   - `totalAmount`: sum of `amount * exchangeRate` for matching payments,
 *   - `byAccountType`: map of account type to summed `amount * exchangeRate`
 */
export async function getLiabilityPaymentSummary(startDate?: Date, endDate?: Date) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
      type: TransactionType.EXPENSE,
      toAccountId: { not: null },
      referenceNumber: { not: null },
      paymentStatus: PaymentStatus.COMPLETED,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, Date>).gte = startDate;
      if (endDate) (where.date as Record<string, Date>).lte = endDate;
    }

    const payments = await prisma.transaction.findMany({
      where,
      select: {
        amount: true,
        currency: true,
        exchangeRate: true,
        toAccount: {
          select: {
            type: true,
            name: true,
          },
        },
      },
    });

    const summary = payments.reduce(
      (
        acc: {
          totalPayments: number;
          totalAmount: number;
          byAccountType: Record<string, number>;
        },
        payment
      ) => {
        const normalizedAmount = payment.amount * payment.exchangeRate;
        acc.totalPayments++;
        acc.totalAmount += normalizedAmount;

        const accountType = payment.toAccount?.type || "UNKNOWN";
        acc.byAccountType[accountType] =
          (acc.byAccountType[accountType] || 0) + normalizedAmount;

        return acc;
      },
      { totalPayments: 0, totalAmount: 0, byAccountType: {} }
    );

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    console.error("Get liability payment summary error:", error);
    return {
      success: false,
      error: "Failed to fetch payment summary",
    };
  }
}