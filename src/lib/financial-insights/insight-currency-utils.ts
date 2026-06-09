import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";

export type CurrencyConversionSource = "identity" | "live" | "cached" | "missing";

export interface CurrencyConversionResult {
  amount: number | null;
  rate: number | null;
  source: CurrencyConversionSource;
}

export interface InsightCurrencyConverterStats {
  liveRateCount: number;
  cachedRateCount: number;
  missingRateCount: number;
}

export interface InsightCurrencyConverter {
  targetCurrency: string;
  convert(amount: number, fromCurrency: string): Promise<CurrencyConversionResult>;
  getStats(): InsightCurrencyConverterStats;
}

export function normalizeTransactionAmount(transaction: {
  amount: number;
  exchangeRate: number;
}): number {
  return transaction.amount * transaction.exchangeRate;
}

export async function createInsightCurrencyConverter(input: {
  targetCurrency: string;
  sourceCurrencies: string[];
}): Promise<InsightCurrencyConverter> {
  const sourceCurrencies = Array.from(
    new Set(
      input.sourceCurrencies
        .map((currency) => currency.trim().toUpperCase())
        .filter((currency) => currency && currency !== input.targetCurrency)
    )
  );

  const cachedRates =
    sourceCurrencies.length > 0
      ? await prisma.exchangeRate.findMany({
          where: {
            fromCurrency: { in: sourceCurrencies },
            toCurrency: input.targetCurrency,
          },
          select: {
            fromCurrency: true,
            toCurrency: true,
            rate: true,
          },
        })
      : [];

  const cachedRateMap = new Map(
    cachedRates.map((rate) => [`${rate.fromCurrency}:${rate.toCurrency}`, rate.rate])
  );
  const rateCache = new Map<
    string,
    Promise<{ rate: number | null; source: CurrencyConversionSource }>
  >();
  const livePairs = new Set<string>();
  const cachedPairs = new Set<string>();
  const missingPairs = new Set<string>();

  async function resolveRate(
    fromCurrency: string
  ): Promise<{ rate: number | null; source: CurrencyConversionSource }> {
    if (fromCurrency === input.targetCurrency) {
      return { rate: 1, source: "identity" };
    }

    const key = `${fromCurrency}:${input.targetCurrency}`;
    const existing = rateCache.get(key);
    if (existing) {
      return existing;
    }

    const next = (async () => {
      const liveRate = await getExchangeRate(fromCurrency, input.targetCurrency);
      if (liveRate && Number.isFinite(liveRate) && liveRate > 0) {
        livePairs.add(key);
        return { rate: liveRate, source: "live" as const };
      }

      const cachedRate = cachedRateMap.get(key);
      if (cachedRate && Number.isFinite(cachedRate) && cachedRate > 0) {
        cachedPairs.add(key);
        return { rate: cachedRate, source: "cached" as const };
      }

      missingPairs.add(key);
      return { rate: null, source: "missing" as const };
    })();

    rateCache.set(key, next);
    return next;
  }

  return {
    targetCurrency: input.targetCurrency,
    async convert(amount: number, fromCurrency: string) {
      const normalizedCurrency = fromCurrency.trim().toUpperCase();
      if (normalizedCurrency === input.targetCurrency) {
        return { amount, rate: 1, source: "identity" };
      }

      const resolved = await resolveRate(normalizedCurrency);
      return {
        amount:
          resolved.rate && Number.isFinite(resolved.rate)
            ? amount * resolved.rate
            : null,
        rate: resolved.rate,
        source: resolved.source,
      };
    },
    getStats() {
      return {
        liveRateCount: livePairs.size,
        cachedRateCount: cachedPairs.size,
        missingRateCount: missingPairs.size,
      };
    },
  };
}
