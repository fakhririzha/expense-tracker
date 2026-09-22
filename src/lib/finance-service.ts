import { unstable_cache } from "next/cache";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"]
});

export interface QuoteResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  currency?: string;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  error?: string;
}

export interface HistoricalDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  typeDisp?: string;
}

// Custom error class for Yahoo Finance errors
export class YahooFinanceError extends Error {
  constructor(
    message: string,
    public code: string,
    public symbol?: string
  ) {
    super(message);
    this.name = "YahooFinanceError";
  }
}

const QUOTE_CACHE_SECONDS = 5 * 60;
const QUOTE_TIMEOUT_MS = 8_000;
const ASSET_PRICE_CACHE_TAG = "asset-price";

type YahooQuoteFields = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number | null;
  regularMarketChange?: number | null;
  regularMarketChangePercent?: number | null;
  regularMarketPreviousClose?: number | null;
  regularMarketOpen?: number | null;
  regularMarketDayHigh?: number | null;
  regularMarketDayLow?: number | null;
  regularMarketVolume?: number | null;
  currency?: string;
  marketCap?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
};

const quoteInFlight = new Map<string, Promise<QuoteResult | null>>();
const quoteBatchInFlight = new Map<string, Promise<Record<string, QuoteResult>>>();

function quoteCacheKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function mapYahooQuote(symbol: string, quote: YahooQuoteFields): QuoteResult {
  return {
    symbol: quote.symbol || symbol,
    shortName: quote.shortName,
    longName: quote.longName,
    regularMarketPrice: quote.regularMarketPrice ?? 0,
    regularMarketChange: quote.regularMarketChange ?? 0,
    regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
    regularMarketPreviousClose: quote.regularMarketPreviousClose ?? 0,
    regularMarketOpen: quote.regularMarketOpen ?? undefined,
    regularMarketDayHigh: quote.regularMarketDayHigh ?? undefined,
    regularMarketDayLow: quote.regularMarketDayLow ?? undefined,
    regularMarketVolume: quote.regularMarketVolume ?? undefined,
    currency: quote.currency,
    marketCap: quote.marketCap ?? undefined,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
  };
}

function assertUsableQuote(symbol: string, quote: YahooQuoteFields | null | undefined): QuoteResult {
  const mapped = quote ? mapYahooQuote(symbol, quote) : null;
  if (
    !mapped ||
    !Number.isFinite(mapped.regularMarketPrice) ||
    mapped.regularMarketPrice <= 0
  ) {
    throw new Error(`Yahoo Finance returned no usable price for ${symbol}`);
  }

  return mapped;
}

function failedQuote(symbol: string, error: unknown): QuoteResult {
  return {
    symbol,
    regularMarketPrice: 0,
    regularMarketChange: 0,
    regularMarketChangePercent: 0,
    regularMarketPreviousClose: 0,
    error: error instanceof Error ? error.message : "Failed to fetch price",
  };
}

// Throws on failure so unstable_cache does not store an unusable price.
const getAssetPriceCached = unstable_cache(
  async (symbol: string): Promise<QuoteResult> => {
    const quote = await yahooFinance.quote(symbol, undefined, {
      fetchOptions: { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) },
    });
    return assertUsableQuote(symbol, quote as YahooQuoteFields);
  },
  ["asset-price"],
  { revalidate: QUOTE_CACHE_SECONDS, tags: [ASSET_PRICE_CACHE_TAG] }
);

/**
 * Read one cached quote. Failed lookups are not cached.
 */
export async function getAssetPrice(symbol: string): Promise<QuoteResult | null> {
  const cacheKey = quoteCacheKey(symbol);
  const pending = quoteInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = getAssetPriceCached(cacheKey)
    .catch((error: unknown) => {
      console.error(`Error fetching price for ${symbol}:`, error);
      return failedQuote(symbol, error);
    })
    .finally(() => {
      quoteInFlight.delete(cacheKey);
    });
  quoteInFlight.set(cacheKey, request);
  return request;
}

function distinctSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  const distinct: string[] = [];

  for (const symbol of symbols) {
    const cacheKey = quoteCacheKey(symbol);
    if (!cacheKey || seen.has(cacheKey)) {
      continue;
    }
    seen.add(cacheKey);
    distinct.push(symbol.trim());
  }

  return distinct;
}

async function fetchYahooQuoteBatch(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const quotes = await yahooFinance.quote(
    symbols,
    { return: "object" },
    { fetchOptions: { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) } }
  );
  const record: Record<string, QuoteResult> = {};

  for (const symbol of symbols) {
    const cacheKey = quoteCacheKey(symbol);
    const quote = quotes[symbol] ?? quotes[cacheKey] ?? quotes[symbol.toUpperCase()];
    record[cacheKey] = assertUsableQuote(symbol, quote as YahooQuoteFields);
  }

  return record;
}

function getCachedQuoteBatch(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const ordered = [...symbols].sort((left, right) =>
    quoteCacheKey(left).localeCompare(quoteCacheKey(right))
  );
  const batchKey = ordered.map((symbol) => quoteCacheKey(symbol)).join(",");
  const pending = quoteBatchInFlight.get(batchKey);
  if (pending) {
    return pending;
  }

  const request = unstable_cache(
    () => fetchYahooQuoteBatch(ordered),
    ["asset-price-batch", batchKey],
    { revalidate: QUOTE_CACHE_SECONDS, tags: [ASSET_PRICE_CACHE_TAG] }
  )().finally(() => {
    quoteBatchInFlight.delete(batchKey);
  });
  quoteBatchInFlight.set(batchKey, request);
  return request;
}

// One quote request for the distinct symbols. Cached batches do not sleep.
export async function getMultipleAssetPrices(
  symbols: string[]
): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();
  const distinct = distinctSymbols(symbols);
  if (distinct.length === 0) {
    return results;
  }

  let fetched: Record<string, QuoteResult> | null = null;
  try {
    fetched = await getCachedQuoteBatch(distinct);
  } catch (error) {
    console.error("Error fetching quote batch:", error);
    const individual = await Promise.all(
      distinct.map(async (symbol) => [quoteCacheKey(symbol), await getAssetPrice(symbol)] as const)
    );
    fetched = {};
    for (const [cacheKey, quote] of individual) {
      if (quote) {
        fetched[cacheKey] = quote;
      }
    }
  }

  for (const symbol of symbols) {
    const quote = fetched[quoteCacheKey(symbol)];
    if (quote) {
      results.set(symbol, quote);
    }
  }

  return results;
}

export const assetPriceCacheTag = ASSET_PRICE_CACHE_TAG;

// Get historical data for charting
export const getHistoricalData = unstable_cache(
  async (
    symbol: string,
    period1: Date,
    period2: Date = new Date(),
    interval: "1d" | "1wk" | "1mo" = "1d"
  ): Promise<HistoricalDataPoint[]> => {
    try {
      const result = await yahooFinance.historical(symbol, {
        period1,
        period2,
        interval,
      });

      return result.map((item) => ({
        date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        adjClose: item.adjClose,
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  },
  ["historical-data"],
  { revalidate: 3600 } // 1 hour
);

/**
 * Search for matching financial symbols and basic metadata.
 *
 * Returns an array of matching SearchResult objects or an empty array when the query is too short, no matches are found, or an error occurs.
 *
 * @param query - The search term; must be at least 2 characters long
 * @returns An array of up to 10 SearchResult items containing `symbol` and optional `shortname`, `longname`, `exchDisp`, and `typeDisp` fields
 */
export async function searchSymbols(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const result = await yahooFinance.search(query, {
      newsCount: 0,
      enableFuzzyQuery: true,
    });
    
    return (result.quotes || [])
      .filter((quote: unknown) => {
        const q = quote as Record<string, unknown>;
        return typeof q.symbol === "string" && q.symbol.length > 0 && q.isYahooFinance !== false;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((quote: any) => ({
        symbol: quote.symbol as string,
        shortname: quote.shortname as string | undefined,
        longname: quote.longname as string | undefined,
        exchDisp: quote.exchDisp as string | undefined,
        typeDisp: quote.typeDisp as string | undefined,
      }))
      .slice(0, 10); // Limit to 10 results for performance
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
    return [];
  }
}

// Get exchange rate between currencies
const EXCHANGE_RATE_CACHE_SECONDS = 5 * 60;
const EXCHANGE_RATE_TIMEOUT_MS = 8_000;

export interface ExchangeRateQuote {
  rate: number;
  fetchedAt: string;
}

const exchangeRateInFlight = new Map<string, Promise<ExchangeRateQuote | null>>();

const getExchangeRateCached = unstable_cache(
  async (fromCurrency: string, toCurrency: string): Promise<ExchangeRateQuote> => {
    try {
      const symbol = `${fromCurrency}${toCurrency}=X`;
      const quote = await yahooFinance.quote(symbol, undefined, {
        fetchOptions: { signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS) },
      });
      const rate = quote?.regularMarketPrice;

      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Yahoo Finance returned no usable rate for ${symbol}`);
      }

      // Keep the provider-fetch timestamp in the cached value. Consumers that
      // persist this quote must not turn an old cache entry into a fresh rate.
      return { rate, fetchedAt: new Date().toISOString() };
    } catch (error) {
      console.error(
        `Error fetching exchange rate ${fromCurrency}/${toCurrency}:`,
        error
      );
      // Throw rather than returning null so failed and empty responses are not
      // stored by unstable_cache.
      throw error;
    }
  },
  ["exchange-rate"],
  { revalidate: EXCHANGE_RATE_CACHE_SECONDS }
);

export async function getExchangeRateQuote(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateQuote | null> {
  if (fromCurrency === toCurrency) {
    return { rate: 1, fetchedAt: new Date().toISOString() };
  }

  const cacheKey = `${fromCurrency}/${toCurrency}`;
  const inFlight = exchangeRateInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = getExchangeRateCached(fromCurrency, toCurrency)
    .catch(() => null)
    .finally(() => {
      exchangeRateInFlight.delete(cacheKey);
    });
  exchangeRateInFlight.set(cacheKey, request);

  return request;
}

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  const quote = await getExchangeRateQuote(fromCurrency, toCurrency);
  return quote?.rate ?? null;
}

// Calculate investment metrics
export interface InvestmentMetrics {
  currentValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export function calculateInvestmentMetrics(
  quantity: number,
  avgBuyPrice: number,
  currentPrice: number,
  previousClose: number
): InvestmentMetrics {
  const currentValue = quantity * currentPrice;
  const totalCost = quantity * avgBuyPrice;
  const unrealizedPnL = currentValue - totalCost;
  const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;
  const dayChange = quantity * (currentPrice - previousClose);
  const dayChangePercent = previousClose > 0 
    ? ((currentPrice - previousClose) / previousClose) * 100 
    : 0;

  return {
    currentValue,
    totalCost,
    unrealizedPnL,
    unrealizedPnLPercent,
    dayChange,
    dayChangePercent,
  };
}
