/**
 * Investment Validation Library
 * 
 * Provides validation utilities for investment transactions including:
 * - INVESTMENT account prerequisite checks
 * - Sufficient funds validation for buy orders
 * - Holding existence validation for sell orders
 */

import prisma from "@/lib/db";
import { FinancialAccount } from "@prisma/client";

/**
 * Result type for validation operations
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  error?: string;
}

/**
 * Validates that a user has at least one active INVESTMENT-type account.
 * 
 * @param userId - The user ID to check
 * @returns Validation result with list of investment accounts if valid
 */
export async function validateInvestmentAccountPrerequisite(
  userId: string
): Promise<ValidationResult<FinancialAccount[]>> {
  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      type: "INVESTMENT",
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  if (accounts.length === 0) {
    return {
      valid: false,
      error: "No active INVESTMENT account found. Please create an INVESTMENT account first.",
    };
  }

  return {
    valid: true,
    data: accounts,
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
): Promise<ValidationResult<FinancialAccount>> {
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
    return {
      valid: false,
      error: `Account "${account.name}" is inactive. Please activate it first.`,
    };
  }

  return {
    valid: true,
    data: account,
  };
}

/**
 * Validates that an account has sufficient funds for a transaction.
 * 
 * @param accountId - The account ID to check
 * @param requiredAmount - The amount required
 * @returns Validation result with current balance if valid
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
      error: "Account not found.",
    };
  }

  if (account.balance < requiredAmount) {
    return {
      valid: false,
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
 * Validates that a user has sufficient quantity of an asset to sell.
 * 
 * @param userId - The user ID to check
 * @param assetId - The asset ID to validate
 * @param sellQuantity - The quantity to sell
 * @returns Validation result with current quantity if valid
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
 * Comprehensive validation for buy transactions.
 * Validates account ownership, prerequisite, and sufficient funds in one call.
 * 
 * @param userId - The user ID
 * @param accountId - The investment account ID
 * @param totalAmount - The total amount required for the purchase
 * @returns Validation result with account and balance info if valid
 */
export async function validateBuyTransaction(
  userId: string,
  accountId: string,
  totalAmount: number
): Promise<ValidationResult<{ account: FinancialAccount; balanceBefore: number }>> {
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
  const fundsResult = await validateSufficientFunds(accountId, totalAmount);
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
 * Comprehensive validation for sell transactions.
 * Validates account ownership and sufficient holdings in one call.
 * 
 * @param userId - The user ID
 * @param accountId - The investment account ID to credit proceeds to
 * @param assetId - The asset ID to sell
 * @param sellQuantity - The quantity to sell
 * @returns Validation result with asset and account info if valid
 */
export async function validateSellTransaction(
  userId: string,
  accountId: string,
  assetId: string,
  sellQuantity: number
): Promise<ValidationResult<{
  account: FinancialAccount;
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
 * Fetches all active INVESTMENT-type accounts for a user.
 * Useful for populating account selectors.
 * 
 * @param userId - The user ID
 * @returns Array of investment accounts
 */
export async function getInvestmentAccounts(userId: string): Promise<FinancialAccount[]> {
  return prisma.financialAccount.findMany({
    where: {
      userId,
      type: "INVESTMENT",
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}
