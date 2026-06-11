/**
 * Investment Validation Library
 * 
 * Provides validation utilities for investment transactions including:
 * - INVESTMENT account prerequisite checks
 * - Sufficient funds validation for buy orders
 * - Holding existence validation for sell orders
 */

import {
  decryptAccountName,
  sortAccountsByName,
} from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { FinancialAccount } from "@/generated/prisma/client/client";

/**
 * Result type for validation operations
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  error?: string;
}

export type AccountWithDisplayName = Omit<
  FinancialAccount,
  "nameEncrypted" | "descriptionEncrypted"
> & {
  name: string;
  nameEncrypted: string;
  descriptionEncrypted: string | null;
};

/**
 * Ensure the user has at least one active INVESTMENT account.
 *
 * @returns A ValidationResult containing an array of investment accounts when valid, or an error message when none are found.
 */
export async function validateInvestmentAccountPrerequisite(
  userId: string
): Promise<ValidationResult<AccountWithDisplayName[]>> {
  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      type: "INVESTMENT",
      isActive: true,
    },
  });
  const decryptedAccounts = sortAccountsByName(
    await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        name: await decryptAccountName(userId, account.nameEncrypted),
      }))
    )
  );

  if (decryptedAccounts.length === 0) {
    return {
      valid: false,
      error: "No active INVESTMENT account found. Please create an INVESTMENT account first.",
    };
  }

  return {
    valid: true,
    data: decryptedAccounts,
  };
}

/**
 * Validates that a specific INVESTMENT account belongs to the user and is active.
 * 
 * @param userId - The user ID to check
 * @param accountId - The account ID to validate
 * @returns Validation result with the account if valid
 */
export async function validateInvestmentAccountOwnership(
  userId: string,
  accountId: string
): Promise<ValidationResult<AccountWithDisplayName>> {
  const account = await prisma.financialAccount.findFirst({
    where: {
      id: accountId,
      userId,
      type: "INVESTMENT",
    },
  });

  if (!account) {
    return {
      valid: false,
      error: "Investment account not found or does not belong to you.",
    };
  }

  if (!account.isActive) {
    const accountName = await decryptAccountName(userId, account.nameEncrypted);
    return {
      valid: false,
      error: `Account "${accountName}" is inactive. Please activate it first.`,
    };
  }

  const accountName = await decryptAccountName(userId, account.nameEncrypted);

  return {
    valid: true,
    data: { ...account, name: accountName },
  };
}

/**
 * Check that the specified account has at least the required available balance.
 *
 * @returns A ValidationResult whose `data` contains `currentBalance` and `currency` when the account has sufficient funds; otherwise `valid` is `false` and `error` explains the shortage or that the account was not found.
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
      error: "Account not found.",
    };
  }

  if (account.balance < requiredAmount) {
    const accountName = await decryptAccountName(userId, account.nameEncrypted);
    return {
      valid: false,
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
 * Ensure the user owns the specified investment asset and has at least the requested quantity to sell.
 *
 * @param userId - ID of the owner to validate
 * @param assetId - ID of the investment asset to check
 * @param sellQuantity - Quantity the user intends to sell
 * @returns When valid, `data` contains `currentQuantity`, `assetSymbol`, and `assetName`; when invalid, `error` contains a descriptive message
 */
export async function validateHoldingExists(
  userId: string,
  assetId: string,
  sellQuantity: number
): Promise<ValidationResult<{ currentQuantity: number; assetSymbol: string; assetName: string | null }>> {
  const asset = await prisma.investmentAsset.findFirst({
    where: {
      id: assetId,
      userId,
    },
  });

  if (!asset) {
    return {
      valid: false,
      error: "Investment asset not found in your portfolio.",
    };
  }

  if (asset.quantity < sellQuantity) {
    return {
      valid: false,
      error: `Insufficient holdings for ${asset.symbol}. You own ${asset.quantity.toLocaleString()} units, but tried to sell ${sellQuantity.toLocaleString()} units.`,
      data: {
        currentQuantity: asset.quantity,
        assetSymbol: asset.symbol,
        assetName: asset.name,
      },
    };
  }

  return {
    valid: true,
    data: {
      currentQuantity: asset.quantity,
      assetSymbol: asset.symbol,
      assetName: asset.name,
    },
  };
}

/**
 * Validate that a user can execute a buy by confirming the specified investment account belongs to the user, is active, and has sufficient funds.
 *
 * @param userId - The ID of the user initiating the buy
 * @param accountId - The investment account ID to be used for the buy
 * @param totalAmount - The total amount required for the purchase
 * @returns A ValidationResult whose `data` contains the account and `balanceBefore` when validation succeeds; `error` is set when validation fails
 */
export async function validateBuyTransaction(
  userId: string,
  accountId: string,
  totalAmount: number
): Promise<ValidationResult<{ account: AccountWithDisplayName; balanceBefore: number }>> {
  // Step 1: Validate account ownership and status
  const ownershipResult = await validateInvestmentAccountOwnership(userId, accountId);
  if (!ownershipResult.valid || !ownershipResult.data) {
    return {
      valid: false,
      error: ownershipResult.error || "Account validation failed",
    };
  }

  const account = ownershipResult.data;

  // Step 2: Validate sufficient funds
  const fundsResult = await validateSufficientFunds(
    userId,
    accountId,
    totalAmount
  );
  if (!fundsResult.valid) {
    return {
      valid: false,
      error: fundsResult.error || "Funds validation failed",
      data: fundsResult.data ? {
        account,
        balanceBefore: fundsResult.data.currentBalance
      } : undefined,
    };
  }

  return {
    valid: true,
    data: {
      account,
      balanceBefore: fundsResult.data!.currentBalance,
    },
  };
}

/**
 * Validate that the user may sell the specified quantity of an asset from the given investment account.
 *
 * Performs ownership and holding checks, fetches the asset record, and returns account and asset details plus the account balance prior to the sale when valid.
 *
 * @returns The validated payload: an object containing `account`, `asset` (`id`, `symbol`, `name`, `quantity`, `avgBuyPrice`), and `balanceBefore`. 
 */
export async function validateSellTransaction(
  userId: string,
  accountId: string,
  assetId: string,
  sellQuantity: number
): Promise<ValidationResult<{
  account: AccountWithDisplayName;
  asset: { id: string; symbol: string; name: string | null; quantity: number; avgBuyPrice: number };
  balanceBefore: number;
}>> {
  // Step 1: Validate account ownership and status
  const ownershipResult = await validateInvestmentAccountOwnership(userId, accountId);
  if (!ownershipResult.valid || !ownershipResult.data) {
    return {
      valid: false,
      error: ownershipResult.error || "Account validation failed",
    };
  }

  const account = ownershipResult.data;

  // Step 2: Validate sufficient holdings
  const holdingResult = await validateHoldingExists(userId, assetId, sellQuantity);
  if (!holdingResult.valid) {
    return {
      valid: false,
      error: holdingResult.error || "Holding validation failed",
    };
  }

  // Fetch full asset details
  const asset = await prisma.investmentAsset.findFirst({
    where: {
      id: assetId,
      userId,
    },
  });

  if (!asset) {
    return {
      valid: false,
      error: "Investment asset not found.",
    };
  }

  return {
    valid: true,
    data: {
      account,
      asset: {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        quantity: asset.quantity,
        avgBuyPrice: asset.avgBuyPrice,
      },
      balanceBefore: account.balance,
    },
  };
}

/**
 * Return the user's active INVESTMENT accounts ordered by name.
 *
 * @returns The array of active INVESTMENT `FinancialAccount` records for the user, ordered ascending by `name`
 */
export async function getInvestmentAccounts(
  userId: string
): Promise<AccountWithDisplayName[]> {
  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      type: "INVESTMENT",
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
