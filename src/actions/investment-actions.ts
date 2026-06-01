"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
    validateBuyTransaction,
    validateSellTransaction,
    getInvestmentAccounts,
} from "@/lib/investment-validation";
import {
    getAssetPrice,
    searchSymbols,
} from "@/lib/finance-service";
import { isPreciousMetal } from "@/lib/unit-conversion";
import {
    getAssetPriceInCurrency,
    getCurrentPortfolioValuation,
} from "@/lib/investment-valuation-service";
import { Prisma, UnitType } from "@/generated/prisma/client/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";

const investmentAssetSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").toUpperCase(),
  name: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  avgBuyPrice: z.number().positive("Average buy price must be positive"),
  accountId: z.string().min(1, "Investment account is required"),
  unitType: z.enum(["UNIT", "TROY_OUNCE", "GRAM"]).optional(),
});

const tradeSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().positive("Price must be positive"),
  fees: z.number().min(0).default(0),
  date: z.date().default(() => new Date()),
  notes: z.string().optional(),
  accountId: z.string().min(1, "Investment account is required"),
});

export type InvestmentAssetInput = z.infer<typeof investmentAssetSchema>;
export type TradeInput = z.infer<typeof tradeSchema>;

/**
 * Helper function for transactions with Serializable isolation and retry logic.
 * Prevents race conditions in financial operations by ensuring strict isolation.
 */
async function withSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000, // 5 seconds max to wait for lock
        timeout: 10000, // 10 seconds max transaction duration
      });
    } catch (error: unknown) {
      // Check for transaction conflict errors (P2023, P2034, etc.)
      const prismaError = error as { code?: string };
      const isConflictError = ["P2023", "P2034"].includes(prismaError.code || "");

      if (isConflictError && attempt < maxRetries) {
        // Exponential backoff before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Transaction failed after maximum retries");
}

/**
 * Create a new investment asset or add to an existing one by recording a BUY trade, updating the asset's quantity and average buy price, and adjusting the specified investment account's balance.
 *
 * Determines storage unit type for the asset (respecting an explicit `unitType`, defaulting to `TROY_OUNCE` for precious metals, otherwise `UNIT`), validates the account has sufficient funds, and performs the asset and account updates inside a serializable transaction to prevent race conditions. Triggers revalidation of relevant dashboard paths on success.
 *
 * @param data - Fields describing the asset and initial purchase (must include `symbol`, `quantity`, `avgBuyPrice`, and `accountId`; may include `name` and `unitType`)
 * @returns On success, an object with `success: true` and either `created: true` or `updated: true`, `data` containing the created/updated asset, and `account` containing `id`, `name`, `balanceBefore`, and `balanceAfter`. On failure, an object with `success: false` and `error` describing the problem.
 */
export async function createInvestmentAsset(data: InvestmentAssetInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = investmentAssetSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { symbol, accountId, unitType, ...rest } = validatedFields.data;
    
    // Determine the unit type for storage
    // For precious metals: if user selects GRAM, we store prices in GRAM
    // Yahoo Finance returns TROY_OUNCE prices, so we'll convert when fetching current prices
    let storageUnitType: UnitType;
    const storageAvgBuyPrice = rest.avgBuyPrice;
    
    if (unitType) {
      // User explicitly selected a unit type
      storageUnitType = unitType as UnitType;
    } else if (isPreciousMetal(symbol)) {
      // Auto-detect for precious metals - default to TROY_OUNCE (Yahoo's unit)
      storageUnitType = "TROY_OUNCE";
    } else {
      // Default for non-precious metals
      storageUnitType = "UNIT";
    }
    
    const totalAmount = rest.quantity * storageAvgBuyPrice;

    // Validate investment account and sufficient funds
    const validationResult = await validateBuyTransaction(
      session.user.id,
      accountId,
      totalAmount
    );

    if (!validationResult.valid) {
      return { success: false, error: validationResult.error };
    }

    const { account } = validationResult.data!;

    // Check if asset already exists for user
    const existingAsset = await prisma.investmentAsset.findUnique({
      where: {
        userId_symbol: {
          userId: session.user.id,
          symbol,
        },
      },
    });

    if (existingAsset) {
      if (existingAsset.currency !== account.currency) {
        return {
          success: false,
          error: `Existing ${symbol} holding uses ${existingAsset.currency}. Select an investment account with the same currency.`,
        };
      }
      if (existingAsset.unitType !== storageUnitType) {
        return {
          success: false,
          error: `Existing ${symbol} holding uses ${existingAsset.unitType}. Additional purchases must use the same unit.`,
        };
      }

      // Update existing asset with weighted average price calculation
      const { quantity: newQuantity, avgBuyPrice: newAvgBuyPrice } = rest;

      // Execute atomic transaction with Serializable isolation to prevent race conditions
      const updatedAsset = await withSerializableTransaction(async (tx) => {
        // Lock account row for update to prevent race conditions
        const lockedAccount = await tx.financialAccount.findUnique({
          where: { id: accountId },
        });

        if (!lockedAccount || lockedAccount.balance < totalAmount) {
          throw new Error("Insufficient funds or account not found");
        }

        // Compute balanceBefore from fresh read inside transaction
        const balanceBefore = lockedAccount.balance;

        // Re-fetch asset within transaction to get most recent data
        const assetToUpdate = await tx.investmentAsset.findUnique({
          where: { id: existingAsset.id },
        });

        if (!assetToUpdate) {
          throw new Error("Asset not found during update");
        }
        if (assetToUpdate.currency !== lockedAccount.currency) {
          throw new Error(
            `Existing ${symbol} holding uses ${assetToUpdate.currency}. Select an investment account with the same currency.`
          );
        }
        if (assetToUpdate.unitType !== storageUnitType) {
          throw new Error(
            `Existing ${symbol} holding uses ${assetToUpdate.unitType}. Additional purchases must use the same unit.`
          );
        }

        // Calculate new weighted average buy price
        // Formula: (oldQty * oldPrice + newQty * newPrice) / (oldQty + newQty)
        const totalQuantity = assetToUpdate.quantity + newQuantity;
        const weightedAvgBuyPrice =
          (assetToUpdate.avgBuyPrice * assetToUpdate.quantity + newAvgBuyPrice * newQuantity) /
          totalQuantity;

        // Update the asset
        const updated = await tx.investmentAsset.update({
          where: { id: assetToUpdate.id },
          data: {
            quantity: totalQuantity,
            avgBuyPrice: weightedAvgBuyPrice,
            name: rest.name || assetToUpdate.name,
            accountId: account.id, // Link to investment account
          },
        });

        // Deduct balance from account and get updated balance
        const updatedAccount = await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: totalAmount } },
        });

        // Compute balanceAfter immediately before writing trade history
        const balanceAfter = updatedAccount.balance;

        // Encrypt notes for trade history
        const encryptedNotes = `Additional purchase of ${symbol}`
          ? await encryptUserField(session.user.id, "tradeHistory.notes", `Additional purchase of ${symbol}`)
          : null;

        // Record the buy trade with audit trail using fresh balance snapshots
        await tx.tradeHistory.create({
          data: {
            type: "BUY",
            quantity: newQuantity,
            pricePerUnit: newAvgBuyPrice,
            totalAmount,
            fees: 0,
            assetId: assetToUpdate.id,
            userId: session.user.id,
            accountId: account.id,
            balanceBefore,
            balanceAfter,
            date: new Date(),
            notes: null, // Nullify plaintext after encryption
            notesEncrypted: encryptedNotes,
            unitType: assetToUpdate.unitType,
          },
        });

        return { asset: updated, balanceBefore, balanceAfter };
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/investments");
      revalidatePath("/dashboard/accounts");

      return { 
        success: true, 
        data: updatedAsset.asset, 
        updated: true,
        account: {
          id: account.id,
          name: account.name,
          balanceBefore: updatedAsset.balanceBefore,
          balanceAfter: updatedAsset.balanceAfter,
        }
      };
    }

    // Fetch asset name from Yahoo Finance if not provided
    let assetName = rest.name;
    if (!assetName) {
      const quote = await getAssetPrice(symbol);
      assetName = quote?.shortName || quote?.longName || symbol;
    }

    const { quantity, avgBuyPrice } = rest;

    // Create asset and initial trade history in atomic transaction with Serializable isolation
    const asset = await withSerializableTransaction(async (tx) => {
      // Lock account row for update
      const lockedAccount = await tx.financialAccount.findUnique({
        where: { id: accountId },
      });

      if (!lockedAccount || lockedAccount.balance < totalAmount) {
        throw new Error("Insufficient funds or account not found");
      }

      // Compute balanceBefore from fresh read inside transaction
      const balanceBefore = lockedAccount.balance;

      // Create the investment asset linked to the account
      const newAsset = await tx.investmentAsset.create({
        data: {
          symbol,
          name: assetName,
          userId: session.user.id,
          quantity,
          avgBuyPrice,
          currency: account.currency,
          unitType: storageUnitType,
          accountId: account.id,
        },
      });

      // Deduct balance from account and get updated balance
      const updatedAccount = await tx.financialAccount.update({
        where: { id: accountId },
        data: { balance: { decrement: totalAmount } },
      });

      // Compute balanceAfter immediately before writing trade history
      const balanceAfter = updatedAccount.balance;

      // Encrypt notes for trade history
      const encryptedNotes = `Initial purchase of ${symbol}`
        ? await encryptUserField(session.user.id, "tradeHistory.notes", `Initial purchase of ${symbol}`)
        : null;

      // Create initial BUY trade record with audit trail using fresh balance snapshots
      await tx.tradeHistory.create({
        data: {
          type: "BUY",
          quantity,
          pricePerUnit: avgBuyPrice,
          totalAmount,
          fees: 0,
          assetId: newAsset.id,
          userId: session.user.id,
          accountId: account.id,
          balanceBefore,
          balanceAfter,
          date: new Date(),
          notes: null, // Nullify plaintext after encryption
          notesEncrypted: encryptedNotes,
          unitType: storageUnitType,
        },
      });

      return { asset: newAsset, balanceBefore, balanceAfter };
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/accounts");

    return { 
      success: true, 
      data: asset.asset, 
      created: true,
      account: {
        id: account.id,
        name: account.name,
        balanceBefore: asset.balanceBefore,
        balanceAfter: asset.balanceAfter,
      }
    };
  } catch (error) {
    console.error("Create investment asset error:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to create investment asset" };
  }
}

/**
 * Records a trade (BUY or SELL) for an existing investment asset.
 * 
 * For BUY trades:
 * - Validates sufficient funds in the investment account
 * - Deducts the purchase amount from the account balance
 * - Updates asset quantity and average buy price
 * 
 * For SELL trades:
 * - Validates sufficient holdings
 * - Credits the sale proceeds (minus fees) to the investment account
 * - Calculates realized PnL
 * - Updates or deletes the asset based on remaining quantity
 * 
 * All operations are performed atomically within a transaction with full audit trail.
 *
 * @param data - Trade input including assetId, type, quantity, price, fees, accountId, etc.
 * @returns On success, an object with `success: true` and audit data. On failure, an object with `success: false` and an `error` message.
 */
export async function recordTrade(data: TradeInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = tradeSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { assetId, type, quantity, pricePerUnit, fees, accountId, ...rest } =
      validatedFields.data;

    const grossAmount = quantity * pricePerUnit;
    const totalAmount = type === "BUY" ? grossAmount + fees : grossAmount - fees;

    // Validate based on trade type
    if (type === "BUY") {
      const validationResult = await validateBuyTransaction(
        session.user.id,
        accountId,
        totalAmount
      );
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }
    } else {
      const validationResult = await validateSellTransaction(
        session.user.id,
        accountId,
        assetId,
        quantity
      );
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }
    }

    // Perform all operations within transaction with Serializable isolation to prevent race conditions
    const result = await withSerializableTransaction(async (tx) => {
      // Lock account row for update
      const account = await tx.financialAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Re-fetch asset within transaction to get most recent data
      const asset = await tx.investmentAsset.findFirst({
        where: { id: assetId, userId: session.user.id },
      });

      if (!asset) {
        throw new Error("Asset not found");
      }
      if (asset.currency !== account.currency) {
        throw new Error(
          `${asset.symbol} uses ${asset.currency}. Select an investment account with the same currency.`
        );
      }

      const balanceBefore = account.balance;
      let balanceAfter: number;
      let realizedPnL: number | null = null;

      if (type === "BUY") {
        // Validate sufficient funds within transaction
        if (account.balance < totalAmount) {
          throw new Error(`Insufficient funds in "${account.name}". Available: ${account.balance}, Required: ${totalAmount}`);
        }

        balanceAfter = balanceBefore - totalAmount;

        // Update average buy price and quantity
        const newTotalQuantity = asset.quantity + quantity;
        const newAvgBuyPrice =
          (asset.avgBuyPrice * asset.quantity + pricePerUnit * quantity) /
          newTotalQuantity;

        await tx.investmentAsset.update({
          where: { id: assetId },
          data: {
            quantity: newTotalQuantity,
            avgBuyPrice: newAvgBuyPrice,
            accountId: account.id,
          },
        });

        // Deduct balance from account
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: totalAmount } },
        });
      } else {
        // SELL
        // Validate sufficient quantity
        if (asset.quantity < quantity) {
          throw new Error(`Insufficient quantity. You own ${asset.quantity} units, but tried to sell ${quantity} units`);
        }

        // Calculate realized PnL
        const proceeds = quantity * pricePerUnit - fees;
        realizedPnL = proceeds - (asset.avgBuyPrice * quantity);
        balanceAfter = balanceBefore + proceeds;

        // Calculate new quantity for later asset update/delete
        // const newQuantity = asset.quantity - quantity;

        // Credit proceeds to account
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { increment: proceeds } },
        });
      }

      // Create trade history with audit trail (BEFORE deleting/updating asset to preserve FK constraint)
      // Encrypt notes if provided
      const encryptedNotes = rest.notes
        ? await encryptUserField(session.user.id, "tradeHistory.notes", rest.notes)
        : null;

      const trade = await tx.tradeHistory.create({
        data: {
          type,
          quantity,
          pricePerUnit,
          totalAmount,
          fees,
          realizedPnL,
          assetId,
          userId: session.user.id,
          accountId: account.id,
          balanceBefore,
          balanceAfter,
          notes: null, // Nullify plaintext after encryption
          notesEncrypted: encryptedNotes,
          unitType: asset.unitType,
        },
      });

      // For SELL trades: update asset quantity (never delete - preserve FK relationships for TradeHistory)
      if (type === "SELL") {
        const newQuantity = asset.quantity - quantity;
        // When all units are sold, set avgBuyPrice to 0 since there's no remaining position
        const newAvgBuyPrice = newQuantity === 0 ? 0 : asset.avgBuyPrice;
        
        await tx.investmentAsset.update({
          where: { id: assetId },
          data: {
            quantity: newQuantity,
            avgBuyPrice: newAvgBuyPrice,
          },
        });
      }

      return {
        trade,
        account: {
          id: account.id,
          name: account.name,
          balanceBefore,
          balanceAfter,
        },
      };
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/accounts");

    return { 
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Record trade error:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to record trade" };
  }
}

/**
 * Retrieve the authenticated user's investment assets enriched with current prices and computed metrics.
 *
 * Fetches the user's assets, obtains market prices, adjusts prices for currency and precious-metal units when necessary, computes investment metrics, and returns one overview containing normalized assets, summary totals, and display currency.
 *
 * @returns An object with `success` boolean, `data` containing the portfolio overview, and `error` when the operation fails.
 */
export async function getPortfolio() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mainCurrency: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      data: await getCurrentPortfolioValuation(
        session.user.id,
        user.mainCurrency
      ),
    };
  } catch (error) {
    console.error("Get portfolio error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch portfolio valuation",
    };
  }
}

/**
 * Fetches the authenticated user's trade history, optionally filtered by a specific asset ID.
 *
 * @param assetId - Optional investment asset ID to filter trades
 * @returns On success: an object with `success: true` and `data` containing trade records (each includes the related asset). On failure: an object with `success: false`, an `error` message, and an empty `data` array.
 */
export async function getTradeHistory(assetId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (assetId) where.assetId = assetId;

    const trades = await prisma.tradeHistory.findMany({
      where,
      include: { asset: true },
      orderBy: { date: "desc" },
    });

    // Decrypt sensitive fields
    const decryptedTrades = await Promise.all(
      trades.map(async (trade) => {
        let finalNotes = trade.notes;
        if (trade.notesEncrypted) {
          try {
            finalNotes = await decryptUserField(
              session.user.id,
              "tradeHistory.notes",
              trade.notesEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        return {
          ...trade,
          notes: finalNotes,
        };
      })
    );

    return { success: true, data: decryptedTrades };
  } catch (error) {
    console.error("Get trade history error:", error);
    return { success: false, error: "Failed to fetch trade history", data: [] };
  }
}

/**
 * Searches for financial symbols that match the provided query string.
 *
 * @param query - The search string; a lookup is performed only when `query` has at least 2 characters.
 * @returns On success, an object with `success: true` and `data` containing an array of matching symbol results (empty if no matches or if the query is shorter than 2). On failure or unauthorized access, an object with `success: false`, an `error` message, and `data: []`.
 */
export async function searchSymbolsAction(query: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    const results = await searchSymbols(query);
    return { success: true, data: results };
  } catch (error) {
    console.error("Search symbols error:", error);
    return { success: false, error: "Failed to search symbols", data: [] };
  }
}

/**
 * Fetches the current price for a single symbol with proper currency conversion.
 * 
 * - The quote is converted into the selected investment account's currency
 * - Precious metals can optionally be converted from TROY_OUNCE to GRAM
 *
 * @param symbol - The stock/asset symbol to fetch the price for
 * @param targetCurrency - Investment account currency for the price preview
 * @param unitType - Optional unit type for precious metals ("GRAM" or "TROY_OUNCE")
 * @returns On success, an object with `success: true`, `data` containing the converted price, and optionally `rawPrice` (before conversion). On failure, an object with `success: false` and an `error` message.
 */
export async function getAssetPriceWithConversion(
  symbol: string,
  targetCurrency: string,
  unitType?: "UNIT" | "TROY_OUNCE" | "GRAM"
): Promise<{
  success: boolean;
  data?: number;
  rawPrice?: number;
  error?: string;
  currency?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    const normalizedTargetCurrency = targetCurrency.trim().toUpperCase();
    if (!normalizedTargetCurrency) {
      return { success: false, error: "Target currency is required" };
    }

    const price = await getAssetPriceInCurrency(
      symbol,
      normalizedTargetCurrency,
      unitType
    );

    return {
      success: true,
      data: price.currentPrice,
      rawPrice: price.rawPrice,
      currency: price.currency,
    };
  } catch (error) {
    console.error("Get asset price error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch asset price",
    };
  }
}

/**
 * Triggers revalidation of portfolio pages so subsequent requests fetch fresh asset prices.
 *
 * @returns An object with `success: true` when revalidation was initiated; otherwise `success: false` and an `error` message (for unauthorized access or failure).
 */
export async function refreshPortfolioPrices() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Revalidate portfolio data by triggering path revalidation
    // This will cause fresh data to be fetched on next load
    revalidatePath("/dashboard/investments", "page");
    revalidatePath("/dashboard", "page");
    
    return { success: true };
  } catch (error) {
    console.error("Refresh portfolio prices error:", error);
    return { success: false, error: "Failed to refresh prices" };
  }
}

/**
 * Fetches the authenticated user's active INVESTMENT-type accounts.
 * Used for populating account selectors in buy/sell dialogs.
 *
 * @returns On success: an object with `success: true` and `data` containing an array of investment accounts
 * with their id, name, balance, and currency. On failure: an object with `success: false`, an `error` message, and an empty `data` array.
 */
export async function getInvestmentAccountsAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const accounts = await getInvestmentAccounts(session.user.id);

    return { success: true, data: accounts };
  } catch (error) {
    console.error("Get investment accounts error:", error);
    return { success: false, error: "Failed to fetch investment accounts", data: [] };
  }
}

/**
 * Retrieve the authenticated user's investment assets with quantity greater than zero for use in sell dialogs.
 *
 * @returns An object with `success: true` and `data` containing an array of sellable assets when successful; otherwise `success: false`, `error` with a message, and an empty `data` array.
 *
 * Each asset in `data` contains:
 * - `id` — Asset UUID.
 * - `symbol` — Asset symbol (uppercase).
 * - `name` — Asset display name or `null`.
 * - `quantity` — Owned quantity (greater than zero).
 * - `avgBuyPrice` — Average purchase price per unit.
 * - `currency` — Currency code for prices (e.g., "IDR").
 * - `unitType` — Unit type (`UNIT`, `TROY_OUNCE`, or `GRAM`).
 */
export async function getSellableInvestments() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const assets = await prisma.investmentAsset.findMany({
      where: {
        userId: session.user.id,
        quantity: {
          gt: 0,
        },
      },
      select: {
        id: true,
        symbol: true,
        name: true,
        quantity: true,
        avgBuyPrice: true,
        currency: true,
        unitType: true,
      },
      orderBy: { symbol: "asc" },
    });

    return { success: true, data: assets };
  } catch (error) {
    console.error("Get sellable investments error:", error);
    return { success: false, error: "Failed to fetch sellable investments", data: [] };
  }
}
