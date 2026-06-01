import { UnitType } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import {
  calculateInvestmentMetrics,
  getAssetPrice,
  getExchangeRate,
  getMultipleAssetPrices,
  type QuoteResult,
} from "@/lib/finance-service";
import {
  convertPrice,
  getUnitLabel,
  isPreciousMetal,
} from "@/lib/unit-conversion";

export class InvestmentValuationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvestmentValuationError";
  }
}

export interface PortfolioValuationAsset {
  id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
  userId: string;
  accountId: string | null;
  unitType: UnitType;
  createdAt: Date;
  updatedAt: Date;
  currentPrice: number;
  previousClose: number;
  currentValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  realizedPnL: number;
  quote?: QuoteResult;
  unitLabel: string;
}

export interface PortfolioValuationSummary {
  totalValue: number;
  totalCost: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  totalRealizedPnL: number;
  assetCount: number;
}

export interface PortfolioValuation {
  assets: PortfolioValuationAsset[];
  summary: PortfolioValuationSummary;
  displayCurrency: string;
}

function createCurrencyConverter() {
  const ratePromises = new Map<string, Promise<number>>();

  return async (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> => {
    if (amount === 0) return 0;
    if (fromCurrency === toCurrency) return amount;

    const key = `${fromCurrency}:${toCurrency}`;
    let ratePromise = ratePromises.get(key);

    if (!ratePromise) {
      ratePromise = getExchangeRate(fromCurrency, toCurrency).then((rate) => {
        if (!rate || !Number.isFinite(rate) || rate <= 0) {
          throw new InvestmentValuationError(
            `Live exchange rate unavailable for ${fromCurrency}/${toCurrency}`
          );
        }
        return rate;
      });
      ratePromises.set(key, ratePromise);
    }

    return amount * (await ratePromise);
  };
}

function assertLiveQuote(
  symbol: string,
  quote?: QuoteResult | null
): QuoteResult {
  if (
    !quote ||
    quote.error ||
    !Number.isFinite(quote.regularMarketPrice) ||
    quote.regularMarketPrice <= 0
  ) {
    throw new InvestmentValuationError(
      `Live market price unavailable for ${symbol}`
    );
  }

  return quote;
}

function getQuoteCurrency(symbol: string, quote: QuoteResult): string {
  if (quote.currency) return quote.currency;
  if (isPreciousMetal(symbol)) return "USD";

  throw new InvestmentValuationError(
    `Quote currency unavailable for ${symbol}`
  );
}

async function convertQuotePrice(
  symbol: string,
  price: number,
  quoteCurrency: string,
  targetCurrency: string,
  unitType: UnitType,
  convertCurrency: ReturnType<typeof createCurrencyConverter>
): Promise<number> {
  const convertedCurrencyPrice = await convertCurrency(
    price,
    quoteCurrency,
    targetCurrency
  );

  return isPreciousMetal(symbol) && unitType === "GRAM"
    ? convertPrice(convertedCurrencyPrice, "TROY_OUNCE", "GRAM")
    : convertedCurrencyPrice;
}

export async function getAssetPriceInCurrency(
  symbol: string,
  targetCurrency: string,
  unitType: UnitType = "UNIT"
): Promise<{ currentPrice: number; rawPrice: number; currency: string }> {
  const upperSymbol = symbol.toUpperCase();
  const quote = assertLiveQuote(upperSymbol, await getAssetPrice(upperSymbol));
  const convertCurrency = createCurrencyConverter();
  const currentPrice = await convertQuotePrice(
    upperSymbol,
    quote.regularMarketPrice,
    getQuoteCurrency(upperSymbol, quote),
    targetCurrency,
    unitType,
    convertCurrency
  );

  return {
    currentPrice,
    rawPrice: quote.regularMarketPrice,
    currency: targetCurrency,
  };
}

export async function getCurrentPortfolioValuation(
  userId: string,
  displayCurrency: string
): Promise<PortfolioValuation> {
  const assets = await prisma.investmentAsset.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (assets.length === 0) {
    return {
      assets: [],
      summary: {
        totalValue: 0,
        totalCost: 0,
        totalUnrealizedPnL: 0,
        totalUnrealizedPnLPercent: 0,
        totalDayChange: 0,
        totalDayChangePercent: 0,
        totalRealizedPnL: 0,
        assetCount: 0,
      },
      displayCurrency,
    };
  }

  const activeAssets = assets.filter((asset) => asset.quantity > 0);
  const [prices, realizedPnLByAsset] = await Promise.all([
    getMultipleAssetPrices(activeAssets.map((asset) => asset.symbol)),
    prisma.tradeHistory.groupBy({
      by: ["assetId"],
      where: {
        userId,
        assetId: { in: assets.map((asset) => asset.id) },
        type: "SELL",
        realizedPnL: { not: null },
      },
      _sum: { realizedPnL: true },
    }),
  ]);

  const realizedPnLMap = new Map(
    realizedPnLByAsset.map((item) => [
      item.assetId,
      item._sum.realizedPnL ?? 0,
    ])
  );
  const convertCurrency = createCurrencyConverter();

  const valuedAssets = await Promise.all(
    assets.map(async (asset): Promise<PortfolioValuationAsset> => {
      const realizedPnL = await convertCurrency(
        realizedPnLMap.get(asset.id) ?? 0,
        asset.currency,
        displayCurrency
      );

      if (asset.quantity <= 0) {
        return {
          ...asset,
          currentPrice: 0,
          previousClose: 0,
          currentValue: 0,
          totalCost: 0,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          dayChange: 0,
          dayChangePercent: 0,
          realizedPnL,
          unitLabel: getUnitLabel(asset.unitType),
        };
      }

      const quote = assertLiveQuote(asset.symbol, prices.get(asset.symbol));
      const quoteCurrency = getQuoteCurrency(asset.symbol, quote);
      const currentPrice = await convertQuotePrice(
        asset.symbol,
        quote.regularMarketPrice,
        quoteCurrency,
        asset.currency,
        asset.unitType,
        convertCurrency
      );
      const previousClose = await convertQuotePrice(
        asset.symbol,
        quote.regularMarketPreviousClose > 0
          ? quote.regularMarketPreviousClose
          : quote.regularMarketPrice,
        quoteCurrency,
        asset.currency,
        asset.unitType,
        convertCurrency
      );
      const localMetrics = calculateInvestmentMetrics(
        asset.quantity,
        asset.avgBuyPrice,
        currentPrice,
        previousClose
      );

      return {
        ...asset,
        currentPrice,
        previousClose,
        currentValue: await convertCurrency(
          localMetrics.currentValue,
          asset.currency,
          displayCurrency
        ),
        totalCost: await convertCurrency(
          localMetrics.totalCost,
          asset.currency,
          displayCurrency
        ),
        unrealizedPnL: await convertCurrency(
          localMetrics.unrealizedPnL,
          asset.currency,
          displayCurrency
        ),
        unrealizedPnLPercent: localMetrics.unrealizedPnLPercent,
        dayChange: await convertCurrency(
          localMetrics.dayChange,
          asset.currency,
          displayCurrency
        ),
        dayChangePercent: localMetrics.dayChangePercent,
        realizedPnL,
        quote,
        unitLabel: getUnitLabel(asset.unitType),
      };
    })
  );

  const summary = valuedAssets.reduce<PortfolioValuationSummary>(
    (result, asset) => {
      result.totalRealizedPnL += asset.realizedPnL;
      if (asset.quantity <= 0) return result;

      result.totalValue += asset.currentValue;
      result.totalCost += asset.totalCost;
      result.totalUnrealizedPnL += asset.unrealizedPnL;
      result.totalDayChange += asset.dayChange;
      result.assetCount += 1;
      return result;
    },
    {
      totalValue: 0,
      totalCost: 0,
      totalUnrealizedPnL: 0,
      totalUnrealizedPnLPercent: 0,
      totalDayChange: 0,
      totalDayChangePercent: 0,
      totalRealizedPnL: 0,
      assetCount: 0,
    }
  );

  summary.totalUnrealizedPnLPercent =
    summary.totalCost > 0
      ? (summary.totalUnrealizedPnL / summary.totalCost) * 100
      : 0;
  summary.totalDayChangePercent =
    summary.totalValue - summary.totalDayChange > 0
      ? (summary.totalDayChange /
          (summary.totalValue - summary.totalDayChange)) *
        100
      : 0;

  return { assets: valuedAssets, summary, displayCurrency };
}
