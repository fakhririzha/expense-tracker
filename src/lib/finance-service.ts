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

// Cache asset prices for 5 minutes
export const getAssetPrice = unstable_cache(
  async (symbol: string): Promise<QuoteResult | null> => {
    try {
      const quote = await yahooFinance.quote(symbol);
      
      if (!quote) {
        return null;
      }

      return {
        symbol: quote.symbol,
        shortName: quote.shortName,
        longName: quote.longName,
        regularMarketPrice: quote.regularMarketPrice ?? 0,
        regularMarketChange: quote.regularMarketChange ?? 0,
        regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
        regularMarketPreviousClose: quote.regularMarketPreviousClose ?? 0,
        regularMarketOpen: quote.regularMarketOpen,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,
        regularMarketVolume: quote.regularMarketVolume,
        currency: quote.currency,
        marketCap: quote.marketCap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      };
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      // Return error info instead of null for better UX
      return {
        symbol,
        regularMarketPrice: 0,
        regularMarketChange: 0,
        regularMarketChangePercent: 0,
        regularMarketPreviousClose: 0,
        error: error instanceof Error ? error.message : "Failed to fetch price",
      };
    }
  },
  ["asset-price"],
  { revalidate: 300 } // 5 minutes
);

// Get multiple asset prices at once
export async function getMultipleAssetPrices(
  symbols: string[]
): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();
  
  // Fetch in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map((symbol) => getAssetPrice(symbol));
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach((result, index) => {
      if (result) {
        results.set(batch[index], result);
      }
    });
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

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
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;

  try {
    const symbol = `${fromCurrency}${toCurrency}=X`;
    const quote = await yahooFinance.quote(symbol);
    return quote?.regularMarketPrice ?? null;
  } catch (error) {
    console.error(
      `Error fetching exchange rate ${fromCurrency}/${toCurrency}:`,
      error
    );
    return null;
  }
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