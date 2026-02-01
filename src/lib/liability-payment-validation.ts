/**
 * Liability Payment Validation Library
 *
 * Provides comprehensive validation for liability payment transactions:
 * - Source account validation (BANK type, active, sufficient funds)
 * - Target account validation (LOAN or CREDIT_CARD type, active)
 * - Payment amount validation (not exceeding balance unless allowed)
 * - Reference number uniqueness
 */

import prisma from "@/lib/db";
import { FinancialAccount } from "@prisma/client";

export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface AccountValidationData {
  account: FinancialAccount;
  currentBalance: number;
  availableBalance: number;
}

/**
 * Validates that a source account is a BANK type, belongs to user, and is active
 */
export async function validateSourceAccount(
  userId: string,
  accountId: string
): Promise<ValidationResult<AccountValidationData>> {
  const account = await prisma.financialAccount.findFirst({
    where: {
      id: accountId,
      userId,
      type: "BANK",
    },
  });

  if (!account) {
    return {
      valid: false,
      errorCode: "INVALID_SOURCE_ACCOUNT",
      error:
        "Source account not found or is not a bank account. Please select a valid bank account.",
    };
  }

  if (!account.isActive) {
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Source account "${account.name}" is inactive or closed. Please activate it first.`,
    };
  }

  return {
    valid: true,
    data: {
      account,
      currentBalance: account.balance,
      availableBalance: account.balance,
    },
  };
}

/**
 * Validates that a target account is a LOAN or CREDIT_CARD type, belongs to user, and is active
 */
export async function validateTargetLiabilityAccount(
  userId: string,
  accountId: string
): Promise<ValidationResult<AccountValidationData>> {
  const account = await prisma.financialAccount.findFirst({
    where: {
      id: accountId,
      userId,
      type: {
        in: ["LOAN", "CREDIT_CARD"],
      },
    },
  });

  if (!account) {
    return {
      valid: false,
      errorCode: "INVALID_TARGET_ACCOUNT",
      error:
        "Target account not found or is not a loan/credit card account. Please select a valid liability account.",
    };
  }

  if (!account.isActive) {
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Target account "${account.name}" is inactive or closed. Please activate it first.`,
    };
  }

  return {
    valid: true,
    data: {
      account,
      currentBalance: account.balance,
      availableBalance: account.balance,
    },
  };
}

/**
 * Validates that source account has sufficient funds for the payment
 */
export async function validateSufficientFunds(
  accountId: string,
  requiredAmount: number
): Promise<ValidationResult<{ currentBalance: number; currency: string }>> {
  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return {
      valid: false,
      errorCode: "ACCOUNT_NOT_FOUND",
      error: "Account not found.",
    };
  }

  if (account.balance < requiredAmount) {
    return {
      valid: false,
      errorCode: "INSUFFICIENT_FUNDS",
      error: `Insufficient funds in "${account.name}". Available: ${account.balance.toLocaleString()} ${account.currency}, Required: ${requiredAmount.toLocaleString()} ${account.currency}`,
      data: { currentBalance: account.balance, currency: account.currency },
    };
  }

  return {
    valid: true,
    data: { currentBalance: account.balance, currency: account.currency },
  };
}

/**
 * Validates that payment amount does not exceed liability balance
 * unless overpayment protection is disabled
 */
export async function validatePaymentAmount(
  liabilityAccountId: string,
  paymentAmount: number,
  allowOverpayment = false
): Promise<ValidationResult<{ liabilityBalance: number; maxPayment: number }>> {
  const account = await prisma.financialAccount.findUnique({
    where: { id: liabilityAccountId },
  });

  if (!account) {
    return {
      valid: false,
      errorCode: "ACCOUNT_NOT_FOUND",
      error: "Liability account not found.",
    };
  }

  // Liability accounts typically have negative balance (debt)
  // The maximum payment is the absolute value of the balance
  const liabilityBalance = account.balance;
  const maxPayment = Math.abs(liabilityBalance);

  // If balance is 0 or positive (no debt), can't make a payment
  if (liabilityBalance >= 0) {
    return {
      valid: false,
      errorCode: "NO_OUTSTANDING_BALANCE",
      error: `Account "${account.name}" has no outstanding balance to pay off.`,
      data: { liabilityBalance, maxPayment: 0 },
    };
  }

  // Check if payment exceeds balance (unless overpayment is allowed)
  if (paymentAmount > maxPayment && !allowOverpayment) {
    return {
      valid: false,
      errorCode: "PAYMENT_EXCEEDS_BALANCE",
      error: `Payment amount (${paymentAmount.toLocaleString()} ${account.currency}) exceeds outstanding balance (${maxPayment.toLocaleString()} ${account.currency}). Maximum payment allowed: ${maxPayment.toLocaleString()} ${account.currency}`,
      data: { liabilityBalance, maxPayment },
    };
  }

  return {
    valid: true,
    data: { liabilityBalance, maxPayment },
  };
}

/**
 * Validates reference number uniqueness
 */
export async function validateReferenceNumber(
  referenceNumber: string
): Promise<ValidationResult<void>> {
  const existing = await prisma.transaction.findUnique({
    where: { referenceNumber },
  });

  if (existing) {
    return {
      valid: false,
      errorCode: "DUPLICATE_REFERENCE",
      error: `Reference number "${referenceNumber}" has already been used. Please use a unique reference number.`,
    };
  }

  return { valid: true };
}

/**
 * Validates that neither account is frozen or closed
 */
export async function validateAccountStatus(
  sourceAccountId: string,
  targetAccountId: string
): Promise<ValidationResult<{ sourceActive: boolean; targetActive: boolean }>> {
  const [sourceAccount, targetAccount] = await Promise.all([
    prisma.financialAccount.findUnique({ where: { id: sourceAccountId } }),
    prisma.financialAccount.findUnique({ where: { id: targetAccountId } }),
  ]);

  if (!sourceAccount || !targetAccount) {
    return {
      valid: false,
      errorCode: "ACCOUNT_NOT_FOUND",
      error: "One or both accounts could not be found.",
    };
  }

  const sourceActive = sourceAccount.isActive;
  const targetActive = targetAccount.isActive;

  if (!sourceActive && !targetActive) {
    return {
      valid: false,
      errorCode: "ACCOUNTS_INACTIVE",
      error: `Both accounts are inactive. Source: "${sourceAccount.name}", Target: "${targetAccount.name}"`,
      data: { sourceActive, targetActive },
    };
  }

  if (!sourceActive) {
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Source account "${sourceAccount.name}" is inactive or closed.`,
      data: { sourceActive, targetActive },
    };
  }

  if (!targetActive) {
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Target account "${targetAccount.name}" is inactive or closed.`,
      data: { sourceActive, targetActive },
    };
  }

  return {
    valid: true,
    data: { sourceActive, targetActive },
  };
}

/**
 * Comprehensive validation for liability payment
 */
export async function validateLiabilityPayment(
  userId: string,
  data: {
    sourceAccountId: string;
    targetAccountId: string;
    amount: number;
    referenceNumber: string;
    allowOverpayment?: boolean;
  }
): Promise<
  ValidationResult<{
    sourceAccount: FinancialAccount;
    targetAccount: FinancialAccount;
    sourceBalanceBefore: number;
    targetBalanceBefore: number;
  }>
> {
  // Step 1: Validate source account
  const sourceValidation = await validateSourceAccount(
    userId,
    data.sourceAccountId
  );
  if (!sourceValidation.valid || !sourceValidation.data) {
    return {
      valid: false,
      errorCode: sourceValidation.errorCode,
      error: sourceValidation.error,
    };
  }

  // Step 2: Validate target account
  const targetValidation = await validateTargetLiabilityAccount(
    userId,
    data.targetAccountId
  );
  if (!targetValidation.valid || !targetValidation.data) {
    return {
      valid: false,
      errorCode: targetValidation.errorCode,
      error: targetValidation.error,
    };
  }

  // Step 3: Validate accounts are not the same
  if (data.sourceAccountId === data.targetAccountId) {
    return {
      valid: false,
      errorCode: "SAME_ACCOUNT",
      error:
        "Source and target accounts cannot be the same. Please select different accounts.",
    };
  }

  const sourceAccount = sourceValidation.data.account;
  const targetAccount = targetValidation.data.account;
  const sourceBalanceBefore = sourceAccount.balance;
  const targetBalanceBefore = targetAccount.balance;

  // Step 4: Validate source account has sufficient funds
  const fundsValidation = await validateSufficientFunds(
    data.sourceAccountId,
    data.amount
  );
  if (!fundsValidation.valid) {
    return {
      valid: false,
      errorCode: fundsValidation.errorCode,
      error: fundsValidation.error,
    };
  }

  // Step 5: Validate payment amount vs liability balance
  const amountValidation = await validatePaymentAmount(
    data.targetAccountId,
    data.amount,
    data.allowOverpayment
  );
  if (!amountValidation.valid) {
    return {
      valid: false,
      errorCode: amountValidation.errorCode,
      error: amountValidation.error,
    };
  }

  // Step 6: Validate reference number uniqueness
  const referenceValidation = await validateReferenceNumber(
    data.referenceNumber
  );
  if (!referenceValidation.valid) {
    return {
      valid: false,
      errorCode: referenceValidation.errorCode,
      error: referenceValidation.error,
    };
  }

  return {
    valid: true,
    data: {
      sourceAccount,
      targetAccount,
      sourceBalanceBefore,
      targetBalanceBefore,
    },
  };
}

/**
 * Fetches all active BANK accounts for a user (for source account selection)
 */
export async function getBankAccounts(
  userId: string
): Promise<FinancialAccount[]> {
  return prisma.financialAccount.findMany({
    where: {
      userId,
      type: "BANK",
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Fetches all active LOAN and CREDIT_CARD accounts for a user (for target account selection)
 */
export async function getLiabilityAccounts(
  userId: string
): Promise<FinancialAccount[]> {
  return prisma.financialAccount.findMany({
    where: {
      userId,
      type: {
        in: ["LOAN", "CREDIT_CARD"],
      },
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Generates a unique reference number for liability payments
 * Format: LP-YYYYMMDD-XXXX (where XXXX is a random 4-digit number)
 */
export function generatePaymentReference(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `LP-${dateStr}-${randomNum}`;
}

/**
 * Validates if an account has any outstanding balance
 */
export async function hasOutstandingBalance(
  accountId: string
): Promise<boolean> {
  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId },
    select: { balance: true },
  });

  if (!account) return false;

  // Liability accounts have negative balance when there's debt
  return account.balance < 0;
}
