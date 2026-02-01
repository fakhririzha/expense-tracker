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
 * Creates a liability payment transaction with double-entry bookkeeping
 *
 * Business Logic:
 * 1. Validate all inputs and business rules
 * 2. Lock both accounts for update (prevent race conditions)
 * 3. Create transaction record with PENDING status
 * 4. Update source account balance (decrement - credit)
 * 5. Update target account balance (increment toward zero - debit)
 * 6. Create audit trail record
 * 7. Update transaction status to COMPLETED
 * 8. Revalidate affected paths
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

    const {
      // sourceAccount,
      // targetAccount,
      sourceBalanceBefore,
      targetBalanceBefore,
    } = validationResult.data;

    // Step 3: Execute atomic transaction
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 3a. Create transaction record with PENDING status
        const transaction = await tx.transaction.create({
          data: {
            amount,
            currency,
            exchangeRate,
            type: TransactionType.EXPENSE, // Payments are treated as expenses
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

        // 3b. Lock and update source account balance (credit/decrease)
        const updatedSourceAccount = await tx.financialAccount.update({
          where: { id: sourceAccountId },
          data: { balance: { decrement: amount } },
        });

        // 3c. Lock and update target account balance (debit/increase toward zero)
        // For liability accounts, balance is negative (debt)
        // Payment increases the balance (reduces debt)
        const updatedTargetAccount = await tx.financialAccount.update({
          where: { id: targetAccountId },
          data: { balance: { increment: amount } },
        });

        // 3d. Create audit trail record
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

        // 3e. Update transaction status to COMPLETED
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
 * Retrieves liability payment details with audit trail
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
 * Rolls back a liability payment (for admin/error scenarios)
 * This reverses the payment by:
 * 1. Crediting the source account (adding back the payment amount)
 * 2. Debiting the target account (subtracting the payment amount)
 * 3. Marking the audit record as rolled back
 * 4. Updating the transaction status to ROLLED_BACK
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
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/accounts");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Rollback liability payment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rollback payment",
    };
  }
}

/**
 * Gets payment history for a specific liability account or all liability payments
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
 * Generates a unique reference number for liability payments
 * Format: LP-YYYYMMDD-XXXX (where XXXX is a random 4-digit number)
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
 * Gets summary statistics for liability payments
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
