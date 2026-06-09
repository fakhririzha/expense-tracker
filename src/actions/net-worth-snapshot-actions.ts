"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
  createMissingMonthlyNetWorthSnapshots as createMissingSnapshotsForPeriod,
  createNetWorthSnapshotIfMissing,
  getNetWorthSnapshotByPeriodForUser,
  getNetWorthSnapshotSummaryForUser,
  getNetWorthSnapshotsForUser,
  toTrendPoints,
} from "@/lib/net-worth-snapshot-service";
import { isFuturePeriod } from "@/lib/net-worth-period";
import type {
  NetWorthPeriod,
  NetWorthSnapshotDetail,
  NetWorthSnapshotListItem,
  NetWorthSnapshotSummary,
  NetWorthTrendPoint,
} from "@/lib/net-worth-types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MAX_MONTHS = 120;

const snapshotListSchema = z.object({
  months: z.number().int().min(1).max(MAX_MONTHS).optional(),
  startYear: z.number().int().min(2000).max(9999).optional(),
  startMonth: z.number().int().min(1).max(12).optional(),
  endYear: z.number().int().min(2000).max(9999).optional(),
  endMonth: z.number().int().min(1).max(12).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
});

const snapshotPeriodSchema = z.object({
  year: z.number().int().min(2000).max(9999),
  month: z.number().int().min(1).max(12),
});

const snapshotSummarySchema = z.object({
  months: z.number().int().min(1).max(MAX_MONTHS).optional(),
});

async function requireAuthenticatedUser(): Promise<{
  id: string;
  mainCurrency: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      mainCurrency: true,
    },
  });

  return user ?? null;
}

export async function getNetWorthSnapshots(input: {
  months?: number;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  currency?: string;
} = {}): Promise<{
  success: boolean;
  data?: NetWorthSnapshotListItem[];
  error?: string;
}> {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = snapshotListSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    const data = await getNetWorthSnapshotsForUser(user.id, {
      ...parsed.data,
      months: parsed.data.months ?? 12,
      currency: parsed.data.currency ?? user.mainCurrency,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Get net worth snapshots error:", error);
    return { success: false, error: "Failed to fetch net worth snapshots" };
  }
}

export async function getNetWorthSnapshotTrend(input: {
  months?: number;
  currency?: string;
} = {}): Promise<{
  success: boolean;
  data?: NetWorthTrendPoint[];
  error?: string;
}> {
  const result = await getNetWorthSnapshots(input);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: toTrendPoints(result.data ?? []),
  };
}

export async function getNetWorthSnapshotByPeriod(input: {
  year: number;
  month: number;
}): Promise<{
  success: boolean;
  data?: NetWorthSnapshotDetail | null;
  error?: string;
}> {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = snapshotPeriodSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    const snapshot = await getNetWorthSnapshotByPeriodForUser(
      user.id,
      parsed.data
    );

    return { success: true, data: snapshot };
  } catch (error) {
    console.error("Get net worth snapshot by period error:", error);
    return { success: false, error: "Failed to fetch net worth snapshot" };
  }
}

export async function getNetWorthSnapshotSummary(input: {
  months?: number;
} = {}): Promise<{
  success: boolean;
  data?: NetWorthSnapshotSummary;
  error?: string;
}> {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = snapshotSummarySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    const summary = await getNetWorthSnapshotSummaryForUser(
      user.id,
      parsed.data.months ?? 12
    );

    return {
      success: true,
      data: {
        ...summary,
        hasCurrencyMismatch:
          summary.hasCurrencyMismatch ||
          (summary.latestSnapshot?.currency !== null &&
            summary.latestSnapshot?.currency !== user.mainCurrency),
      },
    };
  } catch (error) {
    console.error("Get net worth snapshot summary error:", error);
    return { success: false, error: "Failed to fetch net worth snapshot summary" };
  }
}

export async function createNetWorthSnapshotForCurrentUser(input: {
  year: number;
  month: number;
}): Promise<{
  success: boolean;
  data?: { created: boolean; snapshot: NetWorthSnapshotDetail | null };
  error?: string;
}> {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = snapshotPeriodSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    if (isFuturePeriod(parsed.data, new Date())) {
      return { success: false, error: "Future periods are not allowed" };
    }

    const result = await createNetWorthSnapshotIfMissing(user.id, parsed.data, {
      trigger: "manual",
      calculationMode: "live_snapshot",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reports");

    return {
      success: true,
      data: {
        created: result.created,
        snapshot: result.snapshot,
      },
    };
  } catch (error) {
    console.error("Create net worth snapshot error:", error);
    return { success: false, error: "Failed to create net worth snapshot" };
  }
}

export async function createMonthlyNetWorthSnapshotForUser(
  userId: string,
  period: NetWorthPeriod
) {
  return createNetWorthSnapshotIfMissing(userId, period, {
    trigger: "cron",
    calculationMode: "live_snapshot",
  });
}

export async function createMissingMonthlyNetWorthSnapshots(period: NetWorthPeriod) {
  return createMissingSnapshotsForPeriod(period);
}
