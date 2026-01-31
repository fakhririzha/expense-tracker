"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
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
});

const tradeSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().positive("Price must be positive"),
  fees: z.number().min(0).default(0),
  date: z.date().default(() => new Date()),
  notes: z.string().optional(),
});

export type InvestmentAssetInput = z.infer<typeof investmentAssetSchema>;
export type TradeInput = z.infer<typeof tradeSchema>;

/**
 * Creates a new investment asset for the current user or updates an existing asset by recording a BUY trade and adjusting quantity and average buy price.
 *
 * @param data - Input describing the asset to create or add to (must include `symbol`, `quantity`, and `avgBuyPrice`; may include `name` and `currency`)
 * @returns On success, an object with `success: true`, `data` containing the created or updated investment asset, and either `created: true` or `updated: true`. On failure, an object with `success: false` and an `error` message.
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

    const { symbol, ...rest } = validatedFields.data;

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
      const { quantity: newQuantity, avgBuyPrice: newAvgBuyPrice, ...updateRest } = rest;

      // Calculate new weighted average buy price
      // Formula: (oldQty * oldPrice + newQty * newPrice) / (oldQty + newQty)
      const totalQuantity = existingAsset.quantity + newQuantity;
      const weightedAvgBuyPrice =
        (existingAsset.avgBuyPrice * existingAsset.quantity + newAvgBuyPrice * newQuantity) /
        totalQuantity;

      const totalAmount = newQuantity * newAvgBuyPrice;

      // Update asset and create trade history in transaction
      const updatedAsset = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Record the buy trade
        await tx.tradeHistory.create({
          data: {
            type: "BUY",
            quantity: newQuantity,
            pricePerUnit: newAvgBuyPrice,
            totalAmount,
            fees: 0,
            assetId: existingAsset.id,
            userId: session.user.id,
            date: new Date(),
            notes: `Additional purchase of ${symbol}`,
          },
        });

        // Update the asset
        return tx.investmentAsset.update({
          where: { id: existingAsset.id },
          data: {
            quantity: totalQuantity,
            avgBuyPrice: weightedAvgBuyPrice,
            name: updateRest.name || existingAsset.name,
            currency: updateRest.currency || existingAsset.currency,
          },
        });
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/investments");

      return { success: true, data: updatedAsset, updated: true };
    }

    // Fetch asset name from Yahoo Finance if not provided
    let assetName = rest.name;
    if (!assetName) {
      const quote = await getAssetPrice(symbol);
      assetName = quote?.shortName || quote?.longName || symbol;
    }

    const { quantity, avgBuyPrice, currency } = rest;
    const totalAmount = quantity * avgBuyPrice;

    // Create asset and initial trade history in transaction
    const asset = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the investment asset
      const newAsset = await tx.investmentAsset.create({
        data: {
          symbol,
          name: assetName,
          userId: session.user.id,
          quantity,
          avgBuyPrice,
          currency,
        },
      });

      // Create initial BUY trade record
      await tx.tradeHistory.create({
        data: {
          type: "BUY",
          quantity,
          pricePerUnit: avgBuyPrice,
          totalAmount,
          fees: 0,
          assetId: newAsset.id,
          userId: session.user.id,
          date: new Date(),
          notes: `Initial purchase of ${symbol}`,
        },
      });

      return newAsset;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/investments");

    return { success: true, data: asset, created: true };
  } catch (error) {
    console.error("Create investment asset error:", error);
    return { success: false, error: "Failed to create investment asset" };
  }
}

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

    const { assetId, type, quantity, pricePerUnit, fees, ...rest } =
      validatedFields.data;

    // Get existing asset
    const asset = await prisma.investmentAsset.findFirst({
      where: { id: assetId, userId: session.user.id },
    });

    if (!asset) {
      return { success: false, error: "Asset not found" };
    }

    const totalAmount = quantity * pricePerUnit + fees;
    let realizedPnL: number | null = null;

    if (type === "SELL") {
      // Check if user has enough quantity
      if (asset.quantity < quantity) {
        return { success: false, error: "Insufficient quantity to sell" };
      }

      // Calculate realized PnL
      realizedPnL = (pricePerUnit - asset.avgBuyPrice) * quantity - fees;
    }

    // Update asset and create trade history in transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create trade history
      await tx.tradeHistory.create({
        data: {
          type,
          quantity,
          pricePerUnit,
          totalAmount,
          fees,
          realizedPnL,
          assetId,
          userId: session.user.id,
          ...rest,
        },
      });

      if (type === "BUY") {
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
          },
        });
      } else {
        // SELL - just reduce quantity
        const newQuantity = asset.quantity - quantity;

        if (newQuantity === 0) {
          // Delete asset if all sold
          await tx.investmentAsset.delete({ where: { id: assetId } });
        } else {
          await tx.investmentAsset.update({
            where: { id: assetId },
            data: { quantity: newQuantity },
          });
        }
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/investments");

    return { success: true };
  } catch (error) {
    console.error("Record trade error:", error);
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