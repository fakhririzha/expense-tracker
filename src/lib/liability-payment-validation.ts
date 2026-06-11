/**
 * Liability Payment Validation Library
 *
 * Provides comprehensive validation for liability payment transactions:
 * - Source account validation (BANK type, active, sufficient funds)
 * - Target account validation (LOAN or CREDIT_CARD type, active)
 * - Payment amount validation (not exceeding balance unless allowed)
 * - Reference number uniqueness
 */

import {
  decryptAccountName,
  sortAccountsByName,
} from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { FinancialAccount } from "@/generated/prisma/client/client";

export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export type AccountWithDisplayName = Omit<
  FinancialAccount,
  "nameEncrypted" | "descriptionEncrypted"
> & {
  name: string;
  nameEncrypted: string;
  descriptionEncrypted: string | null;
};

export interface AccountValidationData {
  account: AccountWithDisplayName;
  currentBalance: number;
  availableBalance: number;
}

/**
 * Ensure the source account exists, is a BANK account owned by the given user, and is active.
 *
 * @returns A ValidationResult with `data` containing the account and its `currentBalance` and `availableBalance` when valid; otherwise contains `error` and `errorCode` describing why validation failed (`INVALID_SOURCE_ACCOUNT` or `ACCOUNT_INACTIVE`).
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
    const accountName = await decryptAccountName(userId, account.nameEncrypted);
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Source account "${accountName}" is inactive or closed. Please activate it first.`,
    };
  }

  const accountName = await decryptAccountName(userId, account.nameEncrypted);

  return {
    valid: true,
    data: {
      account: { ...account, name: accountName },
      currentBalance: account.balance,
      availableBalance: account.balance,
    },
  };
}

/**
 * Ensure the specified target account exists, is a LOAN or CREDIT_CARD liability owned by the user, and is active.
 *
 * @param userId - ID of the account owner to validate ownership
 * @param accountId - ID of the target account to validate
 * @returns A ValidationResult containing `data` with the account and its `currentBalance` and `availableBalance` when valid; otherwise `valid` is `false` and `error`/`errorCode` explain the failure.
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
    const accountName = await decryptAccountName(userId, account.nameEncrypted);
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Target account "${accountName}" is inactive or closed. Please activate it first.`,
    };
  }

  const accountName = await decryptAccountName(userId, account.nameEncrypted);

  return {
    valid: true,
    data: {
      account: { ...account, name: accountName },
      currentBalance: account.balance,
      availableBalance: account.balance,
    },
  };
}

/**
 * Check that an account's balance is at least the required payment amount.
 *
 * @param accountId - The ID of the account to validate
 * @param requiredAmount - The minimum amount required for the payment
 * @returns ValidationResult whose `data` contains `currentBalance` and `currency` when the account has sufficient funds, `valid` is `false` with `errorCode` and `error` otherwise
 */
export async function validateSufficientFunds(
  userId: string,
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
    const accountName = await decryptAccountName(userId, account.nameEncrypted);
    return {
      valid: false,
      errorCode: "INSUFFICIENT_FUNDS",
      error: `Insufficient funds in "${accountName}". Available: ${account.balance.toLocaleString()} ${account.currency}, Required: ${requiredAmount.toLocaleString()} ${account.currency}`,
      data: { currentBalance: account.balance, currency: account.currency },
    };
  }

  return {
    valid: true,
    data: { currentBalance: account.balance, currency: account.currency },
  };
}

/**
 * Ensure a payment amount does not exceed the liability account's outstanding balance unless overpayment is allowed.
 *
 * @param liabilityAccountId - The ID of the liability (loan or credit card) account to validate against
 * @param paymentAmount - The amount intended to be paid
 * @param allowOverpayment - When true, permits payments larger than the outstanding balance
 * @returns A ValidationResult whose `data` contains `{ liabilityBalance, maxPayment }` when valid; otherwise includes an `errorCode` and `error` describing the failure
 */
export async function validatePaymentAmount(
  userId: string,
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
    const accountName = await decryptAccountName(userId, account.nameEncrypted);
    return {
      valid: false,
      errorCode: "NO_OUTSTANDING_BALANCE",
      error: `Account "${accountName}" has no outstanding balance to pay off.`,
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
 * Checks that a transaction reference number is not already used.
 *
 * @param referenceNumber - The transaction reference to verify for uniqueness
 * @returns A ValidationResult: `valid: false` with `errorCode: "DUPLICATE_REFERENCE"` and an explanatory `error` if the reference exists, `valid: true` otherwise
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
 * Check that both source and target accounts exist and are active.
 *
 * Returns an invalid result if either account cannot be found or if one or both accounts are inactive; when available the result includes `sourceActive` and `targetActive` flags.
 *
 * @returns A ValidationResult whose `data` contains `sourceActive` and `targetActive` booleans when valid. When invalid, `errorCode` will be one of `ACCOUNT_NOT_FOUND`, `ACCOUNT_INACTIVE`, or `ACCOUNTS_INACTIVE`, and `data` includes activity flags when available.
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
  const [sourceAccountName, targetAccountName] = await Promise.all([
    decryptAccountName(sourceAccount.userId, sourceAccount.nameEncrypted),
    decryptAccountName(targetAccount.userId, targetAccount.nameEncrypted),
  ]);

  if (!sourceActive && !targetActive) {
    return {
      valid: false,
      errorCode: "ACCOUNTS_INACTIVE",
      error: `Both accounts are inactive. Source: "${sourceAccountName}", Target: "${targetAccountName}"`,
      data: { sourceActive, targetActive },
    };
  }

  if (!sourceActive) {
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Source account "${sourceAccountName}" is inactive or closed.`,
      data: { sourceActive, targetActive },
    };
  }

  if (!targetActive) {
    return {
      valid: false,
      errorCode: "ACCOUNT_INACTIVE",
      error: `Target account "${targetAccountName}" is inactive or closed.`,
      data: { sourceActive, targetActive },
    };
  }

  return {
    valid: true,
    data: { sourceActive, targetActive },
  };
}

/**
 * Run end-to-end validations for a liability payment and return the involved accounts and their pre-action balances when valid.
 *
 * Validations performed:
 * - source account exists, is a BANK account, belongs to `userId`, and is active
 * - target account exists, is a LOAN or CREDIT_CARD account, belongs to `userId`, and is active
 * - source and target accounts are not the same
 * - source account has sufficient funds for the requested amount
 * - payment amount does not exceed the liability balance unless `allowOverpayment` is true
 * - `referenceNumber` is unique
 *
 * @param userId - Owner identifier used to validate account ownership
 * @param data.sourceAccountId - ID of the source BANK account
 * @param data.targetAccountId - ID of the target liability account (LOAN or CREDIT_CARD)
 * @param data.amount - Payment amount to validate
 * @param data.referenceNumber - Payment reference to check for uniqueness
 * @param data.allowOverpayment - When true, allows payment amounts that exceed the liability balance
 * @returns A ValidationResult containing, on success, `sourceAccount`, `targetAccount`, `sourceBalanceBefore`, and `targetBalanceBefore`; on failure, `valid` is false and `error`/`errorCode` describe the problem
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
    sourceAccount: AccountWithDisplayName;
    targetAccount: AccountWithDisplayName;
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
    userId,
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
    userId,
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
 * Retrieve the user's active BANK accounts ordered by name.
 *
 * @returns An array of the user's active `FinancialAccount` records of type `BANK`, sorted ascending by name
 */
export async function getBankAccounts(
  userId: string
): Promise<AccountWithDisplayName[]> {
  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      type: "BANK",
      isActive: true,
    },
  });
  return sortAccountsByName(
    await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        name: await decryptAccountName(userId, account.nameEncrypted),
      }))
    )
  );
}

/**
 * Fetches all active LOAN and CREDIT_CARD accounts for a user (for target account selection)
 */
export async function getLiabilityAccounts(
  userId: string
): Promise<AccountWithDisplayName[]> {
  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      type: {
        in: ["LOAN", "CREDIT_CARD"],
      },
      isActive: true,
    },
  });
  return sortAccountsByName(
    await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        name: await decryptAccountName(userId, account.nameEncrypted),
      }))
    )
  );
}

/**
 * Generate a unique payment reference for liability payments.
 *
 * Format: `LP-YYYYMMDD-XXXX` where `YYYYMMDD` is the current date and `XXXX` is a random 4-digit number.
 *
 * @returns A string reference in the format `LP-YYYYMMDD-XXXX`.
 */
export function generatePaymentReference(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `LP-${dateStr}-${randomNum}`;
}

/**
 * Determine whether the account has an outstanding (negative) balance.
 *
 * @returns `true` if the account exists and its balance is less than zero, `false` otherwise.
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
