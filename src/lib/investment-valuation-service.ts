import { Prisma, UnitType } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import {
  calculateInvestmentMetrics,
  getAssetPrice,
  getExchangeRate,
  getMultipleAssetPrices,
  type QuoteResult,
} from "@/lib/finance-service";
import {
  getLatestPegadaianGoldPriceSnapshot,
  type PegadaianGoldPriceSnapshot,
} from "@/lib/pegadaian-gold-service";
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
  pegadaianGoldPrice?: PegadaianGoldPriceSnapshot | null;
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

const investmentAssetSelect = {
  id: true,
  symbol: true,
  name: true,
  quantity: true,
  avgBuyPrice: true,
  currency: true,
  userId: true,
  accountId: true,
  unitType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InvestmentAssetSelect;

type InvestmentAssetRow = Prisma.InvestmentAssetGetPayload<{
  select: typeof investmentAssetSelect;
}>;

type CurrencyPair = {
  fromCurrency: string;
  toCurrency: string;
};

type LiveQuoteDetails = {
  quote: QuoteResult;
  quoteCurrency: string;
};

const PEGADAIAN_GOLD_SYMBOL = "GC=F";

function getCurrencyPairKey(fromCurrency: string, toCurrency: string): string {
  return `${fromCurrency}:${toCurrency}`;
}

async function loadExchangeRates(
  pairs: CurrencyPair[]
): Promise<Map<string, number>> {
  const uniquePairs = new Map<string, CurrencyPair>();

  for (const pair of pairs) {
    if (pair.fromCurrency === pair.toCurrency) continue;
    uniquePairs.set(
      getCurrencyPairKey(pair.fromCurrency, pair.toCurrency),
      pair
    );
  }

  const entries = await Promise.all(
    Array.from(uniquePairs.entries()).map(async ([key, pair]) => {
      const rate = await getExchangeRate(pair.fromCurrency, pair.toCurrency);

      if (!rate || !Number.isFinite(rate) || rate <= 0) {
        throw new InvestmentValuationError(
          `Live exchange rate unavailable for ${pair.fromCurrency}/${pair.toCurrency}`
        );
      }

      return [key, rate] as const;
    })
  );

  return new Map(entries);
}

function createEmptyPortfolioValuation(
  displayCurrency: string
): PortfolioValuation {
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

function convertCurrencyAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Map<string, number>
): number {
  if (amount === 0) return 0;
  if (fromCurrency === toCurrency) return amount;

  const rate = rates.get(getCurrencyPairKey(fromCurrency, toCurrency));
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new InvestmentValuationError(
      `Live exchange rate unavailable for ${fromCurrency}/${toCurrency}`
    );
  }

  return amount * rate;
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

function getLiveQuoteDetails(
  symbol: string,
  quote?: QuoteResult | null
): LiveQuoteDetails {
  const liveQuote = assertLiveQuote(symbol, quote);

  return {
    quote: liveQuote,
    quoteCurrency: getQuoteCurrency(symbol, liveQuote),
  };
}

function convertQuotePrice(
  symbol: string,
  price: number,
  quoteCurrency: string,
  targetCurrency: string,
  unitType: UnitType,
  rates: Map<string, number>
): number {
  const convertedCurrencyPrice = convertCurrencyAmount(
    price,
    quoteCurrency,
    targetCurrency,
    rates
  );

  return isPreciousMetal(symbol) && unitType === "GRAM"
    ? convertPrice(convertedCurrencyPrice, "TROY_OUNCE", "GRAM")
    : convertedCurrencyPrice;
}

function getPegadaianGoldPriceForAsset(
  asset: Pick<InvestmentAssetRow, "symbol" | "quantity">,
  pegadaianGoldPrice: PegadaianGoldPriceSnapshot | null
): PegadaianGoldPriceSnapshot | null {
  if (asset.quantity <= 0) return null;
  if (asset.symbol.toUpperCase() !== PEGADAIAN_GOLD_SYMBOL) return null;

  return pegadaianGoldPrice;
}

export async function getAssetPriceInCurrency(
  symbol: string,
  targetCurrency: string,
  unitType: UnitType = "UNIT"
): Promise<{ currentPrice: number; rawPrice: number; currency: string }> {
  const upperSymbol = symbol.toUpperCase();
  const { quote, quoteCurrency } = getLiveQuoteDetails(
    upperSymbol,
    await getAssetPrice(upperSymbol)
  );
  const rates = await loadExchangeRates([
    { fromCurrency: quoteCurrency, toCurrency: targetCurrency },
  ]);
  const currentPrice = convertQuotePrice(
    upperSymbol,
    quote.regularMarketPrice,
    quoteCurrency,
    targetCurrency,
    unitType,
    rates
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
  const assets: InvestmentAssetRow[] = await prisma.investmentAsset.findMany({
    where: { userId },
    select: investmentAssetSelect,
    orderBy: { createdAt: "desc" },
  });

  if (assets.length === 0) {
    return createEmptyPortfolioValuation(displayCurrency);
  }

  const activeAssets = assets.filter((asset) => asset.quantity > 0);
  const hasActivePegadaianGoldAsset = activeAssets.some(
    (asset) => asset.symbol.toUpperCase() === PEGADAIAN_GOLD_SYMBOL
  );
  const pegadaianGoldPricePromise = hasActivePegadaianGoldAsset
    ? getLatestPegadaianGoldPriceSnapshot().catch((error) => {
        console.error("Get Pegadaian gold price error:", error);
        return null;
      })
    : Promise.resolve(null);
  const [prices, realizedPnLByAsset, pegadaianGoldPrice] = await Promise.all([
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
    pegadaianGoldPricePromise,
  ]);

  const quoteDetailsByAssetId = new Map<string, LiveQuoteDetails>();
  const exchangeRatePairs: CurrencyPair[] = assets.map((asset) => ({
    fromCurrency: asset.currency,
    toCurrency: displayCurrency,
  }));

  for (const asset of activeAssets) {
    const quoteDetails = getLiveQuoteDetails(asset.symbol, prices.get(asset.symbol));
    quoteDetailsByAssetId.set(asset.id, quoteDetails);
    exchangeRatePairs.push({
      fromCurrency: quoteDetails.quoteCurrency,
      toCurrency: asset.currency,
    });
  }

  const exchangeRates = await loadExchangeRates(exchangeRatePairs);
  const realizedPnLMap = new Map(
    realizedPnLByAsset.map((item) => [
      item.assetId,
      item._sum.realizedPnL ?? 0,
    ])
  );

  const valuedAssets = await Promise.all(
    assets.map(async (asset): Promise<PortfolioValuationAsset> => {
      const realizedPnL = convertCurrencyAmount(
        realizedPnLMap.get(asset.id) ?? 0,
        asset.currency,
        displayCurrency,
        exchangeRates
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
          pegadaianGoldPrice: null,
        };
      }

      const quoteDetails = quoteDetailsByAssetId.get(asset.id);
      if (!quoteDetails) {
        throw new InvestmentValuationError(
          `Live market price unavailable for ${asset.symbol}`
        );
      }

      const { quote, quoteCurrency } = quoteDetails;
      const currentPrice = convertQuotePrice(
        asset.symbol,
        quote.regularMarketPrice,
        quoteCurrency,
        asset.currency,
        asset.unitType,
        exchangeRates
      );
      const previousClose = convertQuotePrice(
        asset.symbol,
        quote.regularMarketPreviousClose > 0
          ? quote.regularMarketPreviousClose
          : quote.regularMarketPrice,
        quoteCurrency,
        asset.currency,
        asset.unitType,
        exchangeRates
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
        currentValue: convertCurrencyAmount(
          localMetrics.currentValue,
          asset.currency,
          displayCurrency,
          exchangeRates
        ),
        totalCost: convertCurrencyAmount(
          localMetrics.totalCost,
          asset.currency,
          displayCurrency,
          exchangeRates
        ),
        unrealizedPnL: convertCurrencyAmount(
          localMetrics.unrealizedPnL,
          asset.currency,
          displayCurrency,
          exchangeRates
        ),
        unrealizedPnLPercent: localMetrics.unrealizedPnLPercent,
        dayChange: convertCurrencyAmount(
          localMetrics.dayChange,
          asset.currency,
          displayCurrency,
          exchangeRates
        ),
        dayChangePercent: localMetrics.dayChangePercent,
        realizedPnL,
        quote,
        unitLabel: getUnitLabel(asset.unitType),
        pegadaianGoldPrice: getPegadaianGoldPriceForAsset(
          asset,
          pegadaianGoldPrice
        ),
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
