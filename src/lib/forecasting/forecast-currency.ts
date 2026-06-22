import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import type {
  ForecastConversionSource,
  ForecastWarning,
} from "@/lib/forecasting/forecast-types";
import { roundMoney } from "@/lib/forecasting/forecast-periods";

type WarningRecorder = (warning: ForecastWarning) => void;

interface ConverterOptions {
  storedRate?: number | null;
  warningDate?: Date;
  warningSourceId?: string;
}

interface ConversionResult {
  amountInTargetCurrency: number | null;
  conversionRate: number | null;
  conversionSource: ForecastConversionSource;
}

export function createForecastCurrencyConverter(
  targetCurrency: string,
  addWarning: WarningRecorder
) {
  const rateCache = new Map<string, Promise<ConversionResult>>();
  const missingPairs = new Set<string>();

  async function resolveRate(
    fromCurrency: string,
    options?: ConverterOptions
  ): Promise<ConversionResult> {
    if (fromCurrency === targetCurrency) {
      return {
        amountInTargetCurrency: 1,
        conversionRate: 1,
        conversionSource: "identity",
      };
    }

    const cacheKey = `${fromCurrency}:${targetCurrency}`;
    let pending = rateCache.get(cacheKey);
    if (!pending) {
      pending = (async (): Promise<ConversionResult> => {
        const liveRate = await getExchangeRate(fromCurrency, targetCurrency);
        if (liveRate && Number.isFinite(liveRate) && liveRate > 0) {
          return {
            amountInTargetCurrency: liveRate,
            conversionRate: liveRate,
            conversionSource: "live",
          };
        }

        const cachedRate = await prisma.exchangeRate.findUnique({
          where: {
            fromCurrency_toCurrency: {
              fromCurrency,
              toCurrency: targetCurrency,
            },
          },
          select: {
            rate: true,
          },
        });

        if (cachedRate?.rate && Number.isFinite(cachedRate.rate) && cachedRate.rate > 0) {
          return {
            amountInTargetCurrency: cachedRate.rate,
            conversionRate: cachedRate.rate,
            conversionSource: "cached",
          };
        }

        return {
          amountInTargetCurrency: null,
          conversionRate: null,
          conversionSource: "missing",
        };
      })();

      rateCache.set(cacheKey, pending);
    }

    const pairRate = await pending;

    if (pairRate.conversionSource !== "missing") {
      return pairRate;
    }

    if (options?.storedRate && Number.isFinite(options.storedRate) && options.storedRate > 0) {
      return {
        amountInTargetCurrency: options.storedRate,
        conversionRate: options.storedRate,
        conversionSource: "stored_transaction_rate",
      };
    }

    if (!missingPairs.has(cacheKey)) {
      missingPairs.add(cacheKey);
      addWarning({
        code: "missing_fx",
        severity: "warning",
        message: `Some forecast values could not be converted from ${fromCurrency} to ${targetCurrency}.`,
        date: options?.warningDate,
        sourceId: options?.warningSourceId,
      });
    }

    return pairRate;
  }

  return {
    async convertAmount(
      amount: number,
      fromCurrency: string,
      options?: ConverterOptions
    ): Promise<ConversionResult> {
      const resolved = await resolveRate(fromCurrency, options);
      if (resolved.amountInTargetCurrency === null || resolved.conversionRate === null) {
        return resolved;
      }

      return {
        amountInTargetCurrency: roundMoney(
          amount * resolved.amountInTargetCurrency
        ),
        conversionRate: resolved.conversionRate,
        conversionSource: resolved.conversionSource,
      };
    },
  };
}
