import { Prisma } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { getExchangeRate, getMultipleAssetPrices } from "@/lib/finance-service";
import { getLastDayOfMonthUtc } from "@/lib/net-worth-period";
import type {
  NetWorthAccountBreakdownItem,
  NetWorthCalculationMode,
  NetWorthExchangeRateMetadata,
  NetWorthInvestmentBreakdownItem,
  NetWorthPeriod,
  NetWorthPersonalAssetBreakdownItem,
  NetWorthSnapshotTrigger,
  NetWorthSnapshotWarning,
  NetWorthSourceBreakdown,
} from "@/lib/net-worth-types";
import { convertPrice, isPreciousMetal } from "@/lib/unit-conversion";

export const NET_WORTH_SNAPSHOT_CALCULATION_VERSION = 1;

interface CalculationUser {
  id: string;
  mainCurrency: string;
}

interface CurrencyConversionContext {
  targetCurrency: string;
  exchangeRates: Map<string, NetWorthExchangeRateMetadata>;
  exchangeRateLookups: Map<string, Promise<NetWorthExchangeRateMetadata>>;
}

interface CalculationOptions {
  period: NetWorthPeriod;
  trigger?: NetWorthSnapshotTrigger;
  calculationMode?: NetWorthCalculationMode;
}

interface CalculationTotals {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  cashTotal: number;
  bankTotal: number;
  investmentCashTotal: number;
  investmentHoldingTotal: number;
  investmentTotal: number;
  personalAssetTotal: number;
  receivableTotal: number;
  loanLiabilityTotal: number;
  creditCardTotal: number;
  liabilityOverpayTotal: number;
}

export interface NetWorthCalculationResult extends CalculationTotals {
  userId: string;
  currency: string;
  period: NetWorthPeriod;
  snapshotDate: Date;
  sourceBreakdownJson: NetWorthSourceBreakdown;
  exchangeRateJson: NetWorthExchangeRateMetadata[];
  calculationVersion: number;
}

function isFinitePositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toQuoteCurrency(symbol: string, quoteCurrency?: string | null): string | null {
  if (quoteCurrency) return quoteCurrency;
  if (isPreciousMetal(symbol)) return "USD";
  return null;
}

function createCurrencyConversionContext(targetCurrency: string): CurrencyConversionContext {
  return {
    targetCurrency,
    exchangeRates: new Map<string, NetWorthExchangeRateMetadata>(),
    exchangeRateLookups: new Map<string, Promise<NetWorthExchangeRateMetadata>>(),
  };
}

async function resolveExchangeRate(
  fromCurrency: string,
  context: CurrencyConversionContext
): Promise<NetWorthExchangeRateMetadata> {
  const toCurrency = context.targetCurrency;
  const key = `${fromCurrency}:${toCurrency}`;
  const liveRate = await getExchangeRate(fromCurrency, toCurrency);

  if (isFinitePositiveNumber(liveRate)) {
    const fetchedAt = new Date();
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency,
          toCurrency,
        },
      },
      create: {
        fromCurrency,
        toCurrency,
        rate: liveRate,
        fetchedAt,
      },
      update: {
        rate: liveRate,
        fetchedAt,
      },
    });

    return {
      pair: key,
      fromCurrency,
      toCurrency,
      rate: liveRate,
      source: "live",
      fetchedAt: fetchedAt.toISOString(),
    };
  }

  const exchangeRateRecord = await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency,
        toCurrency,
      },
    },
    select: {
      rate: true,
      fetchedAt: true,
    },
  });

  if (exchangeRateRecord && isFinitePositiveNumber(exchangeRateRecord.rate)) {
    return {
      pair: key,
      fromCurrency,
      toCurrency,
      rate: exchangeRateRecord.rate,
      source: "cache",
      fetchedAt: exchangeRateRecord.fetchedAt.toISOString(),
    };
  }

  throw new Error(`Exchange rate unavailable for ${fromCurrency}/${toCurrency}`);
}

export async function convertToMainCurrency(
  amount: number,
  fromCurrency: string,
  context: CurrencyConversionContext
): Promise<number> {
  if (amount === 0) return 0;

  if (fromCurrency === context.targetCurrency) {
    const key = `${fromCurrency}:${context.targetCurrency}`;
    if (!context.exchangeRates.has(key)) {
      context.exchangeRates.set(key, {
        pair: key,
        fromCurrency,
        toCurrency: context.targetCurrency,
        rate: 1,
        source: "identity",
        fetchedAt: new Date().toISOString(),
      });
    }

    return amount;
  }

  const key = `${fromCurrency}:${context.targetCurrency}`;
  const cachedMetadata = context.exchangeRates.get(key);

  if (cachedMetadata) {
    return amount * cachedMetadata.rate;
  }

  let lookup = context.exchangeRateLookups.get(key);
  if (!lookup) {
    lookup = resolveExchangeRate(fromCurrency, context);
    context.exchangeRateLookups.set(key, lookup);
  }

  const metadata = await lookup;
  context.exchangeRates.set(key, metadata);
  return amount * metadata.rate;
}

export function buildNetWorthBreakdown(input: {
  period: NetWorthPeriod;
  snapshotDate: Date;
  trigger: NetWorthSnapshotTrigger;
  calculationMode: NetWorthCalculationMode;
  accounts: NetWorthAccountBreakdownItem[];
  investmentHoldings: NetWorthInvestmentBreakdownItem[];
  personalAssets: NetWorthPersonalAssetBreakdownItem[];
  warnings: NetWorthSnapshotWarning[];
}): NetWorthSourceBreakdown {
  const fallbackCount = input.warnings.filter(
    (warning) => warning.code === "missing_quote_fallback_cost_basis"
  ).length;

  return {
    trigger: input.trigger,
    calculationMode: input.calculationMode,
    period: input.period,
    snapshotDate: input.snapshotDate.toISOString(),
    accounts: input.accounts,
    investmentHoldings: input.investmentHoldings,
    personalAssets: input.personalAssets,
    warnings: input.warnings,
    hasFallbacks: fallbackCount > 0,
    fallbackCount,
  };
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(4));
}

export function toSnapshotDecimalMap(values: CalculationTotals) {
  return {
    totalAssets: decimal(values.totalAssets),
    totalLiabilities: decimal(values.totalLiabilities),
    netWorth: decimal(values.netWorth),
    cashTotal: decimal(values.cashTotal),
    bankTotal: decimal(values.bankTotal),
    investmentCashTotal: decimal(values.investmentCashTotal),
    investmentHoldingTotal: decimal(values.investmentHoldingTotal),
    investmentTotal: decimal(values.investmentTotal),
    personalAssetTotal: decimal(values.personalAssetTotal),
    receivableTotal: decimal(values.receivableTotal),
    loanLiabilityTotal: decimal(values.loanLiabilityTotal),
    creditCardTotal: decimal(values.creditCardTotal),
    liabilityOverpayTotal: decimal(values.liabilityOverpayTotal),
  };
}

async function getCalculationUser(userId: string): Promise<CalculationUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mainCurrency: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

async function valueInvestmentHoldings(
  userId: string,
  targetCurrency: string,
  context: CurrencyConversionContext,
  warnings: NetWorthSnapshotWarning[]
): Promise<{
  total: number;
  breakdown: NetWorthInvestmentBreakdownItem[];
}> {
  const assets = await prisma.investmentAsset.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
    },
    select: {
      id: true,
      symbol: true,
      quantity: true,
      avgBuyPrice: true,
      currency: true,
      unitType: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (assets.length === 0) {
    return { total: 0, breakdown: [] };
  }

  const quotes = await getMultipleAssetPrices(assets.map((asset) => asset.symbol));
  const breakdown: NetWorthInvestmentBreakdownItem[] = [];
  let total = 0;

  for (const asset of assets) {
    const quote = quotes.get(asset.symbol);
    const quoteCurrency = toQuoteCurrency(asset.symbol, quote?.currency);
    const hasLiveQuote =
      quote &&
      !quote.error &&
      isFinitePositiveNumber(quote.regularMarketPrice) &&
      !!quoteCurrency;

    if (!hasLiveQuote) {
      const fallbackValue = await convertToMainCurrency(
        asset.quantity * asset.avgBuyPrice,
        asset.currency,
        context
      );

      warnings.push({
        code: "missing_quote_fallback_cost_basis",
        message: `Used cost basis fallback for ${asset.symbol}`,
        assetId: asset.id,
        symbol: asset.symbol,
      });

      breakdown.push({
        assetId: asset.id,
        symbol: asset.symbol,
        currency: asset.currency,
        quantity: asset.quantity,
        avgBuyPrice: asset.avgBuyPrice,
        unitType: asset.unitType,
        valuationCurrency: targetCurrency,
        quoteSource: "cost_basis",
        convertedValue: fallbackValue,
      });
      total += fallbackValue;
      continue;
    }

    const convertedQuote = await convertToMainCurrency(
      quote.regularMarketPrice,
      quoteCurrency,
      context
    );
    const normalizedQuote =
      isPreciousMetal(asset.symbol) && asset.unitType === "GRAM"
        ? convertPrice(convertedQuote, "TROY_OUNCE", "GRAM")
        : convertedQuote;
    const convertedValue = normalizedQuote * asset.quantity;

    breakdown.push({
      assetId: asset.id,
      symbol: asset.symbol,
      currency: asset.currency,
      quantity: asset.quantity,
      avgBuyPrice: asset.avgBuyPrice,
      unitType: asset.unitType,
      valuationCurrency: targetCurrency,
      quoteCurrency,
      quotePrice: quote.regularMarketPrice,
      quoteSource: "live",
      convertedValue,
    });
    total += convertedValue;
  }

  return { total, breakdown };
}

async function valuePersonalAssets(
  userId: string,
  snapshotDate: Date,
  context: CurrencyConversionContext,
  warnings: NetWorthSnapshotWarning[]
): Promise<{
  total: number;
  breakdown: NetWorthPersonalAssetBreakdownItem[];
}> {
  const assets = await prisma.personalAsset.findMany({
    where: { userId },
    select: {
      id: true,
      currentValue: true,
      currency: true,
      currentValuedAt: true,
      disposedAt: true,
      valuations: {
        select: {
          value: true,
          currency: true,
          valuedAt: true,
        },
        orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  const breakdown: NetWorthPersonalAssetBreakdownItem[] = [];
  let total = 0;

  for (const asset of assets) {
    if (asset.disposedAt && asset.disposedAt <= snapshotDate) {
      continue;
    }

    const valuation = asset.valuations.find((item) => item.valuedAt <= snapshotDate);
    const currentValueEligible = asset.currentValuedAt <= snapshotDate;
    const chosenValue = valuation
      ? {
          rawValue: valuation.value,
          currency: valuation.currency,
          valuedAt: valuation.valuedAt,
          source: "valuation_history" as const,
        }
      : currentValueEligible
        ? {
            rawValue: asset.currentValue,
            currency: asset.currency,
            valuedAt: asset.currentValuedAt,
            source: "current_value" as const,
          }
        : null;

    if (!chosenValue) {
      warnings.push({
        code: "missing_personal_asset_valuation",
        message: `Skipped personal asset ${asset.id} because no valuation existed on or before ${snapshotDate.toISOString()}`,
        assetId: asset.id,
      });
      continue;
    }

    const convertedValue = await convertToMainCurrency(
      chosenValue.rawValue,
      chosenValue.currency,
      context
    );

    breakdown.push({
      assetId: asset.id,
      currency: chosenValue.currency,
      rawValue: chosenValue.rawValue,
      convertedValue,
      valuedAt: chosenValue.valuedAt.toISOString(),
      source: chosenValue.source,
    });
    total += convertedValue;
  }

  return { total, breakdown };
}

export async function calculateCurrentNetWorthForUser(
  userId: string,
  options: CalculationOptions
): Promise<NetWorthCalculationResult> {
  const user = await getCalculationUser(userId);
  const snapshotDate = getLastDayOfMonthUtc(
    options.period.year,
    options.period.month
  );
  const trigger = options.trigger ?? "cron";
  const calculationMode = options.calculationMode ?? "live_snapshot";
  const conversionContext = createCurrencyConversionContext(user.mainCurrency);
  const warnings: NetWorthSnapshotWarning[] = [];

  const [accounts, investmentHoldings, personalAssets] = await Promise.all([
    prisma.financialAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        balance: true,
        currency: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    valueInvestmentHoldings(
      userId,
      user.mainCurrency,
      conversionContext,
      warnings
    ),
    valuePersonalAssets(userId, snapshotDate, conversionContext, warnings),
  ]);

  const accountBreakdown: NetWorthAccountBreakdownItem[] = [];
  const totals: CalculationTotals = {
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    cashTotal: 0,
    bankTotal: 0,
    investmentCashTotal: 0,
    investmentHoldingTotal: investmentHoldings.total,
    investmentTotal: 0,
    personalAssetTotal: personalAssets.total,
    receivableTotal: 0,
    loanLiabilityTotal: 0,
    creditCardTotal: 0,
    liabilityOverpayTotal: 0,
  };

  for (const account of accounts) {
    const convertedBalance = await convertToMainCurrency(
      account.balance,
      account.currency,
      conversionContext
    );

    switch (account.type) {
      case "CASH":
        totals.cashTotal += convertedBalance;
        accountBreakdown.push({
          accountId: account.id,
          type: account.type,
          currency: account.currency,
          rawBalance: account.balance,
          convertedBalance,
          bucket: "cash",
        });
        break;
      case "BANK":
        totals.bankTotal += convertedBalance;
        accountBreakdown.push({
          accountId: account.id,
          type: account.type,
          currency: account.currency,
          rawBalance: account.balance,
          convertedBalance,
          bucket: "bank",
        });
        break;
      case "INVESTMENT":
        totals.investmentCashTotal += convertedBalance;
        accountBreakdown.push({
          accountId: account.id,
          type: account.type,
          currency: account.currency,
          rawBalance: account.balance,
          convertedBalance,
          bucket: "investment_cash",
        });
        break;
      case "LOAN_RECEIVABLE": {
        const normalizedValue = Math.abs(convertedBalance);
        totals.receivableTotal += normalizedValue;
        accountBreakdown.push({
          accountId: account.id,
          type: account.type,
          currency: account.currency,
          rawBalance: account.balance,
          convertedBalance: normalizedValue,
          bucket: "receivable",
        });
        break;
      }
      case "LOAN": {
        if (convertedBalance >= 0) {
          totals.liabilityOverpayTotal += convertedBalance;
          accountBreakdown.push({
            accountId: account.id,
            type: account.type,
            currency: account.currency,
            rawBalance: account.balance,
            convertedBalance,
            bucket: "liability_overpay",
          });
        } else {
          totals.loanLiabilityTotal += Math.abs(convertedBalance);
          accountBreakdown.push({
            accountId: account.id,
            type: account.type,
            currency: account.currency,
            rawBalance: account.balance,
            convertedBalance: Math.abs(convertedBalance),
            bucket: "loan_liability",
          });
        }
        break;
      }
      case "CREDIT_CARD": {
        if (convertedBalance >= 0) {
          totals.liabilityOverpayTotal += convertedBalance;
          accountBreakdown.push({
            accountId: account.id,
            type: account.type,
            currency: account.currency,
            rawBalance: account.balance,
            convertedBalance,
            bucket: "liability_overpay",
          });
        } else {
          totals.creditCardTotal += Math.abs(convertedBalance);
          accountBreakdown.push({
            accountId: account.id,
            type: account.type,
            currency: account.currency,
            rawBalance: account.balance,
            convertedBalance: Math.abs(convertedBalance),
            bucket: "credit_card_liability",
          });
        }
        break;
      }
    }
  }

  totals.investmentTotal =
    totals.investmentCashTotal + totals.investmentHoldingTotal;
  totals.totalAssets =
    totals.cashTotal +
    totals.bankTotal +
    totals.investmentTotal +
    totals.personalAssetTotal +
    totals.receivableTotal +
    totals.liabilityOverpayTotal;
  totals.totalLiabilities =
    totals.loanLiabilityTotal + totals.creditCardTotal;
  totals.netWorth = totals.totalAssets - totals.totalLiabilities;

  return {
    userId: user.id,
    currency: user.mainCurrency,
    period: options.period,
    snapshotDate,
    ...totals,
    sourceBreakdownJson: buildNetWorthBreakdown({
      period: options.period,
      snapshotDate,
      trigger,
      calculationMode,
      accounts: accountBreakdown,
      investmentHoldings: investmentHoldings.breakdown,
      personalAssets: personalAssets.breakdown,
      warnings,
    }),
    exchangeRateJson: Array.from(conversionContext.exchangeRates.values()),
    calculationVersion: NET_WORTH_SNAPSHOT_CALCULATION_VERSION,
  };
}
