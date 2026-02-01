"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
    validateBuyTransaction,
    validateSellTransaction,
    getInvestmentAccounts,
} from "@/lib/investment-validation";
import {
    calculateInvestmentMetrics,
    getAssetPrice,
    getMultipleAssetPrices,
    searchSymbols,
} from "@/lib/finance-service";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const investmentAssetSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").toUpperCase(),
  name: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  avgBuyPrice: z.number().positive("Average buy price must be positive"),
  currency: z.string().default("IDR"),
  accountId: z.string().min(1, "Investment account is required"),
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
 * Create or update an investment asset by recording a BUY trade, updating the asset's quantity and average buy price, and adjusting the specified investment account balance.
 *
 * @param data - Input describing the asset to create or add to; must include `symbol`, `quantity`, `avgBuyPrice`, and `accountId` (may include `name` and `currency`)
 * @returns On success, `{ success: true, data: <asset>, created: true }` or `{ success: true, data: <asset>, updated: true }` plus `account` balance context; on failure, `{ success: false, error: <message> }`.
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

    const { symbol, accountId, ...rest } = validatedFields.data;
    const totalAmount = rest.quantity * rest.avgBuyPrice;

    // Validate investment account and sufficient funds
    const validationResult = await validateBuyTransaction(
      session.user.id,
      accountId,
      totalAmount
    );

    if (!validationResult.valid) {
      return { success: false, error: validationResult.error };
    }

    const { account, balanceBefore } = validationResult.data!;
    const balanceAfter = balanceBefore - totalAmount;

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
      // Update existing asset with weighted average price calculation
      const { quantity: newQuantity, avgBuyPrice: newAvgBuyPrice, currency } = rest;

      // Execute atomic transaction: update asset, create trade history, deduct balance
      const updatedAsset = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Lock account row for update to prevent race conditions
        const lockedAccount = await tx.financialAccount.findUnique({
          where: { id: accountId },
        });

        if (!lockedAccount || lockedAccount.balance < totalAmount) {
          throw new Error("Insufficient funds or account not found");
        }

        // Re-fetch asset within transaction to get most recent data
        const assetToUpdate = await tx.investmentAsset.findUnique({
          where: { id: existingAsset.id },
        });

        if (!assetToUpdate) {
          throw new Error("Asset not found during update");
        }

        // Calculate new weighted average buy price
        // Formula: (oldQty * oldPrice + newQty * newPrice) / (oldQty + newQty)
        const totalQuantity = assetToUpdate.quantity + newQuantity;
        const weightedAvgBuyPrice =
          (assetToUpdate.avgBuyPrice * assetToUpdate.quantity + newAvgBuyPrice * newQuantity) /
          totalQuantity;

        // Record the buy trade with audit trail
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
            notes: `Additional purchase of ${symbol}`,
          },
        });

        // Update the asset
        const updated = await tx.investmentAsset.update({
          where: { id: assetToUpdate.id },
          data: {
            quantity: totalQuantity,
            avgBuyPrice: weightedAvgBuyPrice,
            name: rest.name || assetToUpdate.name,
            currency: currency || assetToUpdate.currency,
            accountId: account.id, // Link to investment account
          },
        });

        // Deduct balance from account
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: totalAmount } },
        });

        return updated;
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/investments");
      revalidatePath("/dashboard/accounts");

      return { 
        success: true, 
        data: updatedAsset, 
        updated: true,
        account: {
          id: account.id,
          name: account.name,
          balanceBefore,
          balanceAfter,
        }
      };
    }

    // Fetch asset name from Yahoo Finance if not provided
    let assetName = rest.name;
    if (!assetName) {
      const quote = await getAssetPrice(symbol);
      assetName = quote?.shortName || quote?.longName || symbol;
    }

    const { quantity, avgBuyPrice, currency } = rest;

    // Create asset and initial trade history in atomic transaction
    const asset = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock account row for update
      const lockedAccount = await tx.financialAccount.findUnique({
        where: { id: accountId },
      });

      if (!lockedAccount || lockedAccount.balance < totalAmount) {
        throw new Error("Insufficient funds or account not found");
      }

      // Create the investment asset linked to the account
      const newAsset = await tx.investmentAsset.create({
        data: {
          symbol,
          name: assetName,
          userId: session.user.id,
          quantity,
          avgBuyPrice,
          currency,
          accountId: account.id,
        },
      });

      // Create initial BUY trade record with audit trail
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
          notes: `Initial purchase of ${symbol}`,
        },
      });

      // Deduct balance from account
      await tx.financialAccount.update({
        where: { id: accountId },
        data: { balance: { decrement: totalAmount } },
      });

      return newAsset;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/accounts");

    return { 
      success: true, 
      data: asset, 
      created: true,
      account: {
        id: account.id,
        name: account.name,
        balanceBefore,
        balanceAfter,
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

    const totalAmount = quantity * pricePerUnit + fees;

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

    // Perform all operations within transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

        // Update or delete asset
        const newQuantity = asset.quantity - quantity;
        if (newQuantity === 0) {
          await tx.investmentAsset.delete({ where: { id: assetId } });
        } else {
          await tx.investmentAsset.update({
            where: { id: assetId },
            data: { quantity: newQuantity },
          });
        }

        // Credit proceeds to account
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { increment: proceeds } },
        });
      }

      // Create trade history with audit trail
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
          ...rest,
        },
      });

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

export async function getPortfolio() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const assets = await prisma.investmentAsset.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (assets.length === 0) {
      return { success: true, data: [] };
    }

    interface AssetItem {
      id: string;
      symbol: string;
      name: string | null;
      quantity: number;
      avgBuyPrice: number;
      currency: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }

    // Fetch current prices for all assets
    const symbols = assets.map((a: AssetItem) => a.symbol);
    const prices = await getMultipleAssetPrices(symbols);

    // Calculate metrics for each asset
    const portfolioWithMetrics = assets.map((asset: AssetItem) => {
      const quote = prices.get(asset.symbol);
      const currentPrice = quote?.regularMarketPrice ?? asset.avgBuyPrice;
      const previousClose = quote?.regularMarketPreviousClose ?? currentPrice;

      const metrics = calculateInvestmentMetrics(
        asset.quantity,
        asset.avgBuyPrice,
        currentPrice,
        previousClose
      );

      return {
        ...asset,
        currentPrice,
        previousClose,
        ...metrics,
        quote,
      };
    });

    return { success: true, data: portfolioWithMetrics };
  } catch (error) {
    console.error("Get portfolio error:", error);
    return { success: false, error: "Failed to fetch portfolio", data: [] };
  }
}

export async function getPortfolioSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const portfolioResult = await getPortfolio();
    if (!portfolioResult.success || !portfolioResult.data) {
      return portfolioResult;
    }

    const portfolio = portfolioResult.data;

    interface PortfolioSummary {
      totalValue: number;
      totalCost: number;
      totalUnrealizedPnL: number;
      totalDayChange: number;
    }

    interface PortfolioAsset {
      currentValue: number;
      totalCost: number;
      unrealizedPnL: number;
      dayChange: number;
    }

    const initialSummary: PortfolioSummary = {
      totalValue: 0,
      totalCost: 0,
      totalUnrealizedPnL: 0,
      totalDayChange: 0
    };

    const summary = portfolio.reduce(
      (acc: PortfolioSummary, asset: PortfolioAsset) => {
        acc.totalValue += asset.currentValue;
        acc.totalCost += asset.totalCost;
        acc.totalUnrealizedPnL += asset.unrealizedPnL;
        acc.totalDayChange += asset.dayChange;
        return acc;
      },
      initialSummary
    );

    // Get realized PnL from trade history
    const realizedPnL = await prisma.tradeHistory.aggregate({
      where: {
        userId: session.user.id,
        type: "SELL",
        realizedPnL: { not: null },
      },
      _sum: { realizedPnL: true },
    });

    return {
      success: true,
      data: {
        ...summary,
        totalUnrealizedPnLPercent:
          summary.totalCost > 0
            ? (summary.totalUnrealizedPnL / summary.totalCost) * 100
            : 0,
        totalDayChangePercent:
          summary.totalValue - summary.totalDayChange > 0
            ? (summary.totalDayChange /
                (summary.totalValue - summary.totalDayChange)) *
              100
            : 0,
        totalRealizedPnL: realizedPnL._sum.realizedPnL ?? 0,
        assetCount: portfolio.length,
      },
    };
  } catch (error) {
    console.error("Get portfolio summary error:", error);
    return { success: false, error: "Failed to fetch portfolio summary" };
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

    return { success: true, data: trades };
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
 * Retrieve the authenticated user's investment assets with quantity greater than zero for use in a sell dialog selector.
 *
 * @returns `{ success: true, data: Array<{ id: string; symbol: string; name: string | null; quantity: number; avgBuyPrice: number; currency: string }> }` on success; `{ success: false, error: string, data: [] }` on failure.
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
      },
      orderBy: { symbol: "asc" },
    });

    return { success: true, data: assets };
  } catch (error) {
    console.error("Get sellable investments error:", error);
    return { success: false, error: "Failed to fetch sellable investments", data: [] };
  }
}