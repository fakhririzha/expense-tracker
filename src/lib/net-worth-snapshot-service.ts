import {
  Prisma,
  type NetWorthSnapshot as NetWorthSnapshotModel,
} from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import {
  calculateCurrentNetWorthForUser,
  NET_WORTH_SNAPSHOT_CALCULATION_VERSION,
  toSnapshotDecimalMap,
} from "@/lib/net-worth-calculation";
import {
  getFirstDayOfMonthUtc,
  getLastDayOfMonthUtc,
  getPeriodKey,
} from "@/lib/net-worth-period";
import type {
  NetWorthCalculationMode,
  NetWorthExchangeRateMetadata,
  NetWorthPeriod,
  NetWorthSnapshotDetail,
  NetWorthSnapshotListItem,
  NetWorthSnapshotSummary,
  NetWorthSnapshotTrigger,
  NetWorthSourceBreakdown,
} from "@/lib/net-worth-types";

const USER_BATCH_SIZE = 25;

interface SnapshotCreateOptions {
  trigger?: NetWorthSnapshotTrigger;
  calculationMode?: NetWorthCalculationMode;
}

interface SnapshotListParams {
  months?: number;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  currency?: string;
}

function snapshotHasFallbacks(sourceBreakdownJson: Prisma.JsonValue | null): {
  hasFallbacks: boolean;
  fallbackCount: number;
} {
  if (!sourceBreakdownJson || typeof sourceBreakdownJson !== "object") {
    return { hasFallbacks: false, fallbackCount: 0 };
  }

  const source = sourceBreakdownJson as Partial<NetWorthSourceBreakdown>;
  return {
    hasFallbacks: source.hasFallbacks === true,
    fallbackCount:
      typeof source.fallbackCount === "number" ? source.fallbackCount : 0,
  };
}

function mapSnapshotBase(
  snapshot: NetWorthSnapshotModel
): NetWorthSnapshotListItem {
  const { hasFallbacks, fallbackCount } = snapshotHasFallbacks(
    snapshot.sourceBreakdownJson
  );

  return {
    id: snapshot.id,
    periodYear: snapshot.periodYear,
    periodMonth: snapshot.periodMonth,
    date: getPeriodKey({
      year: snapshot.periodYear,
      month: snapshot.periodMonth,
    }),
    snapshotDate: snapshot.snapshotDate.toISOString(),
    currency: snapshot.currency,
    totalAssets: snapshot.totalAssets.toNumber(),
    totalLiabilities: snapshot.totalLiabilities.toNumber(),
    netWorth: snapshot.netWorth.toNumber(),
    cashTotal: snapshot.cashTotal.toNumber(),
    bankTotal: snapshot.bankTotal.toNumber(),
    investmentCashTotal: snapshot.investmentCashTotal.toNumber(),
    investmentHoldingTotal: snapshot.investmentHoldingTotal.toNumber(),
    investmentTotal: snapshot.investmentTotal.toNumber(),
    personalAssetTotal: snapshot.personalAssetTotal.toNumber(),
    receivableTotal: snapshot.receivableTotal.toNumber(),
    loanLiabilityTotal: snapshot.loanLiabilityTotal.toNumber(),
    creditCardTotal: snapshot.creditCardTotal.toNumber(),
    liabilityOverpayTotal: snapshot.liabilityOverpayTotal.toNumber(),
    hasFallbacks,
    fallbackCount,
    calculationVersion: snapshot.calculationVersion,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

function mapSnapshotDetail(
  snapshot: NetWorthSnapshotModel
): NetWorthSnapshotDetail {
  return {
    ...mapSnapshotBase(snapshot),
    sourceBreakdownJson:
      (snapshot.sourceBreakdownJson as NetWorthSourceBreakdown | null) ?? null,
    exchangeRateJson:
      (snapshot.exchangeRateJson as NetWorthExchangeRateMetadata[] | null) ??
      null,
  };
}

export async function createNetWorthSnapshotIfMissing(
  userId: string,
  period: NetWorthPeriod,
  options: SnapshotCreateOptions = {}
): Promise<{
  created: boolean;
  skippedExisting: boolean;
  snapshot: NetWorthSnapshotDetail | null;
}> {
  const existing = await prisma.netWorthSnapshot.findUnique({
    where: {
      userId_periodYear_periodMonth: {
        userId,
        periodYear: period.year,
        periodMonth: period.month,
      },
    },
  });

  if (existing) {
    return {
      created: false,
      skippedExisting: true,
      snapshot: mapSnapshotDetail(existing),
    };
  }

  const calculation = await calculateCurrentNetWorthForUser(userId, {
    period,
    trigger: options.trigger,
    calculationMode: options.calculationMode,
  });

  try {
    const createdSnapshot = await prisma.netWorthSnapshot.create({
      data: {
        userId,
        periodYear: period.year,
        periodMonth: period.month,
        snapshotDate: calculation.snapshotDate,
        currency: calculation.currency,
        ...toSnapshotDecimalMap(calculation),
        sourceBreakdownJson:
          calculation.sourceBreakdownJson as unknown as Prisma.InputJsonValue,
        exchangeRateJson:
          calculation.exchangeRateJson as unknown as Prisma.InputJsonValue,
        calculationVersion:
          calculation.calculationVersion ??
          NET_WORTH_SNAPSHOT_CALCULATION_VERSION,
      },
    });

    return {
      created: true,
      skippedExisting: false,
      snapshot: mapSnapshotDetail(createdSnapshot),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.netWorthSnapshot.findUnique({
        where: {
          userId_periodYear_periodMonth: {
            userId,
            periodYear: period.year,
            periodMonth: period.month,
          },
        },
      });

      return {
        created: false,
        skippedExisting: true,
        snapshot: duplicate ? mapSnapshotDetail(duplicate) : null,
      };
    }

    throw error;
  }
}

export async function createMissingMonthlyNetWorthSnapshots(
  period: NetWorthPeriod
): Promise<{
  period: string;
  attempted: number;
  created: number;
  skippedExisting: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const errors: Array<{ userId: string; error: string }> = [];
  let attempted = 0;
  let created = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (let skip = 0; ; skip += USER_BATCH_SIZE) {
    const users = await prisma.user.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" },
      skip,
      take: USER_BATCH_SIZE,
    });

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      attempted += 1;
      try {
        const result = await createNetWorthSnapshotIfMissing(user.id, period, {
          trigger: "cron",
          calculationMode: "live_snapshot",
        });

        if (result.created) {
          created += 1;
        } else if (result.skippedExisting) {
          skippedExisting += 1;
        }
      } catch (error) {
        failed += 1;
        errors.push({
          userId: user.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return {
    period: getPeriodKey(period),
    attempted,
    created,
    skippedExisting,
    failed,
    errors,
    durationMs: Date.now() - startedAt,
  };
}

export async function getNetWorthSnapshotsForUser(
  userId: string,
  params: SnapshotListParams
): Promise<NetWorthSnapshotListItem[]> {
  const months = params.months ?? 12;
  const baseWhere: Prisma.NetWorthSnapshotWhereInput = { userId };

  if (params.currency) {
    baseWhere.currency = params.currency;
  }

  let snapshots: NetWorthSnapshotModel[];

  if (
    params.startYear &&
    params.startMonth &&
    params.endYear &&
    params.endMonth
  ) {
    snapshots = await prisma.netWorthSnapshot.findMany({
      where: {
        ...baseWhere,
        snapshotDate: {
          gte: getFirstDayOfMonthUtc(params.startYear, params.startMonth),
          lte: getLastDayOfMonthUtc(params.endYear, params.endMonth),
        },
      },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
  } else {
    snapshots = await prisma.netWorthSnapshot.findMany({
      where: baseWhere,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: months,
    });
    snapshots.reverse();
  }

  return snapshots.map(mapSnapshotBase);
}

export async function getNetWorthSnapshotByPeriodForUser(
  userId: string,
  period: NetWorthPeriod
): Promise<NetWorthSnapshotDetail | null> {
  const snapshot = await prisma.netWorthSnapshot.findUnique({
    where: {
      userId_periodYear_periodMonth: {
        userId,
        periodYear: period.year,
        periodMonth: period.month,
      },
    },
  });

  return snapshot ? mapSnapshotDetail(snapshot) : null;
}

export async function getNetWorthSnapshotSummaryForUser(
  userId: string,
  months: number
): Promise<NetWorthSnapshotSummary> {
  const rawSnapshots = await prisma.netWorthSnapshot.findMany({
    where: { userId },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: months,
  });

  if (rawSnapshots.length === 0) {
    return {
      latestSnapshot: null,
      previousSnapshot: null,
      netWorthChange: null,
      netWorthChangePercent: null,
      highNetWorth: null,
      lowNetWorth: null,
      count: 0,
      currency: null,
      hasCurrencyMismatch: false,
    };
  }

  const currencies = new Set(rawSnapshots.map((snapshot) => snapshot.currency));
  const latestRaw = rawSnapshots[0];
  const sameCurrencySnapshots = rawSnapshots.filter(
    (snapshot) => snapshot.currency === latestRaw.currency
  );
  const latestSnapshot = mapSnapshotBase(latestRaw);
  const previousRaw = sameCurrencySnapshots[1] ?? null;
  const previousSnapshot = previousRaw ? mapSnapshotBase(previousRaw) : null;
  const netWorthChange =
    previousSnapshot !== null
      ? latestSnapshot.netWorth - previousSnapshot.netWorth
      : null;
  const netWorthChangePercent =
    previousSnapshot && previousSnapshot.netWorth !== 0
      ? (netWorthChange! / Math.abs(previousSnapshot.netWorth)) * 100
      : null;
  const sameCurrencyNetWorths = sameCurrencySnapshots.map((snapshot) =>
    snapshot.netWorth.toNumber()
  );

  return {
    latestSnapshot,
    previousSnapshot,
    netWorthChange,
    netWorthChangePercent,
    highNetWorth:
      sameCurrencyNetWorths.length > 0
        ? Math.max(...sameCurrencyNetWorths)
        : null,
    lowNetWorth:
      sameCurrencyNetWorths.length > 0
        ? Math.min(...sameCurrencyNetWorths)
        : null,
    count: rawSnapshots.length,
    currency: latestSnapshot.currency,
    hasCurrencyMismatch: currencies.size > 1,
  };
}

export function toTrendPoints(
  snapshots: NetWorthSnapshotListItem[]
) {
  return snapshots.map((snapshot) => ({
    date: snapshot.date,
    assets: snapshot.totalAssets,
    liabilities: snapshot.totalLiabilities,
    netWorth: snapshot.netWorth,
    periodYear: snapshot.periodYear,
    periodMonth: snapshot.periodMonth,
    snapshotDate: snapshot.snapshotDate,
    currency: snapshot.currency,
    hasFallbacks: snapshot.hasFallbacks,
  }));
}
