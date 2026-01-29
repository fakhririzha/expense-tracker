import { unstable_cache } from "next/cache";
import yahooFinance from "yahoo-finance2";

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
      return null;
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

interface SearchQuoteResult {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  typeDisp?: string;
}

// Search for symbols
export async function searchSymbols(query: string) {
  try {
    const result = await yahooFinance.search(query);
    return (result.quotes as SearchQuoteResult[])
      .filter((quote) => quote.symbol)
      .map((quote) => ({
        symbol: quote.symbol!,
        shortname: quote.shortname,
        longname: quote.longname,
        exchDisp: quote.exchDisp,
        typeDisp: quote.typeDisp,
      }));
  } catch (error) {
    console.error(`Error searching for ${query}:`, error);
    return [];
  }
}

// Get exchange rate between currencies
export const getExchangeRate = unstable_cache(
  async (fromCurrency: string, toCurrency: string): Promise<number | null> => {
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
  },
  ["exchange-rate"],
  { revalidate: 3600 } // 1 hour
);

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
