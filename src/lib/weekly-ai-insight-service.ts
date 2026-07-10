import { z } from "zod";

import {
  PaymentStatus,
  TransactionType,
  WeeklyAiInsightStatus,
} from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { flattenTransactionAllocationRows } from "@/lib/transaction-allocation-service";
import { decryptUserField, encryptUserField } from "@/lib/user-encryption";

const JAKARTA_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TOP_TRANSACTION_LIMIT = 5;
const RETENTION_WEEKS = 52;
const PROMPT_VERSION = "weekly-balanced-coach-v1";

const observationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
});

const weeklyAiInsightContentSchema = z.object({
  headline: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(700),
  observations: z.array(observationSchema).min(1).max(3),
  nextAction: z.string().trim().min(1).max(300),
  dataAvailability: z.string().trim().min(1).max(300),
});

export type WeeklyAiInsightContent = z.infer<typeof weeklyAiInsightContentSchema>;

export interface WeeklyAiInsightView {
  id: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  content: WeeklyAiInsightContent;
}

export interface WeeklyAiInsightsResponse {
  latest: WeeklyAiInsightView | null;
  archive: WeeklyAiInsightView[];
  latestFailure: boolean;
}

interface InsightPeriod {
  periodStart: Date;
  periodEnd: Date;
  previousPeriodStart: Date;
  previousPeriodEnd: Date;
}

interface WeeklyTotals {
  income: number;
  spending: number;
  transactionCount: number;
  recurringTransactionCount: number;
  categories: Map<string, number>;
  topTransactions: Array<{
    amount: number;
    type: TransactionType;
    date: string;
    category: string;
    description: string | null;
  }>;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

function getChatConfig() {
  const endpoint = process.env.WEEKLY_INSIGHTS_CHAT_API_ENDPOINT?.trim();
  const apiKey = process.env.WEEKLY_INSIGHTS_CHAT_API_KEY?.trim();
  const model = process.env.WEEKLY_INSIGHTS_CHAT_API_MODEL?.trim();

  if (!endpoint || !apiKey || !model) {
    return {
      success: false as const,
      error: "Weekly AI insights are not configured.",
    };
  }

  return { success: true as const, endpoint, apiKey, model };
}

function getCompletedWeeklyInsightPeriod(now: Date): InsightPeriod {
  const jakarta = new Date(now.getTime() + JAKARTA_UTC_OFFSET_MS);
  const daysSinceMonday = (jakarta.getUTCDay() + 6) % 7;
  const currentWeekStart = new Date(
    Date.UTC(
      jakarta.getUTCFullYear(),
      jakarta.getUTCMonth(),
      jakarta.getUTCDate() - daysSinceMonday
    ) - JAKARTA_UTC_OFFSET_MS
  );
  const periodStart = new Date(currentWeekStart.getTime() - WEEK_MS);
  const previousPeriodStart = new Date(periodStart.getTime() - WEEK_MS);

  return {
    periodStart,
    periodEnd: new Date(currentWeekStart.getTime() - 1),
    previousPeriodStart,
    previousPeriodEnd: new Date(periodStart.getTime() - 1),
  };
}

function stripJsonFences(content: string): string {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCategoryComparisons(current: WeeklyTotals, previous: WeeklyTotals | null) {
  const categoryNames = new Set([
    ...current.categories.keys(),
    ...(previous?.categories.keys() ?? []),
  ]);

  return [...categoryNames]
    .map((category) => {
      const currentAmount = roundMoney(current.categories.get(category) ?? 0);
      const previousAmount = roundMoney(previous?.categories.get(category) ?? 0);
      return {
        category,
        currentAmount,
        previousAmount,
        changeAmount: roundMoney(currentAmount - previousAmount),
        changePercent:
          previousAmount > 0
            ? roundMoney(((currentAmount - previousAmount) / previousAmount) * 100)
            : null,
      };
    })
    .filter((item) => item.currentAmount > 0 || item.previousAmount > 0)
    .sort((left, right) => Math.abs(right.changeAmount) - Math.abs(left.changeAmount))
    .slice(0, 8);
}

async function getDescription(
  userId: string,
  transaction: { description: string | null; descriptionEncrypted: string | null }
): Promise<string | null> {
  if (transaction.descriptionEncrypted) {
    return (await decryptUserField(
      userId,
      "transaction.description",
      transaction.descriptionEncrypted
    )).trim() || null;
  }

  return transaction.description?.trim() || null;
}

async function getWeeklyTotals(input: {
  userId: string;
  from: Date;
  to: Date;
  includeDescriptions: boolean;
}): Promise<WeeklyTotals> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      date: { gte: input.from, lte: input.to },
      type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      paymentStatus: PaymentStatus.COMPLETED,
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      exchangeRate: true,
      type: true,
      date: true,
      isRecurring: true,
      description: true,
      descriptionEncrypted: true,
      categoryId: true,
      accountId: true,
      toAccountId: true,
      category: { select: { id: true, name: true, icon: true, color: true } },
      splits: {
        select: {
          id: true,
          amount: true,
          description: true,
          categoryId: true,
          sortOrder: true,
          category: { select: { id: true, name: true, icon: true, color: true } },
        },
      },
    },
  });

  const categories = new Map<string, number>();
  let income = 0;
  let spending = 0;

  for (const transaction of transactions) {
    const normalizedAmount = transaction.amount * transaction.exchangeRate;
    if (transaction.type === TransactionType.INCOME) {
      income += normalizedAmount;
      continue;
    }

    for (const allocation of flattenTransactionAllocationRows([transaction])) {
      const category = allocation.category?.name ?? "Uncategorized";
      spending += allocation.normalizedAmount;
      categories.set(category, (categories.get(category) ?? 0) + allocation.normalizedAmount);
    }
  }

  const topTransactions = await Promise.all(
    [...transactions]
      .sort(
        (left, right) =>
          right.amount * right.exchangeRate - left.amount * left.exchangeRate
      )
      .slice(0, TOP_TRANSACTION_LIMIT)
      .map(async (transaction) => ({
      amount: roundMoney(transaction.amount * transaction.exchangeRate),
      type: transaction.type,
      date: transaction.date.toISOString().slice(0, 10),
      category: transaction.category?.name ?? "Uncategorized",
      description: input.includeDescriptions
        ? await getDescription(input.userId, transaction)
        : null,
      }))
  );

  return {
    income: roundMoney(income),
    spending: roundMoney(spending),
    transactionCount: transactions.length,
    recurringTransactionCount: transactions.filter((transaction) => transaction.isRecurring).length,
    categories,
    topTransactions,
  };
}

function buildSystemPrompt(): string {
  return [
    "You are FinHealth's weekly personal-finance coach. Analyze only the supplied financial data for the completed week and, when available, compare it with the immediately preceding completed week.",
    "Write in English. Be accurate, calm, practical, and non-judgmental. Lead with the most important outcome, then give no more than three evidence-backed observations and one achievable next action.",
    "Cite exact supplied amounts, percentages, categories, merchants, and periods only when provided. Never invent facts, infer causes without stating they are possibilities, shame the user, or give investment, tax, legal, medical, or credit advice.",
    "If the comparison is unavailable or data is limited, state that plainly and focus on the completed week. Treat the supplied classifications as authoritative.",
    "Return JSON only, with this schema: {headline:string,summary:string,observations:[{title:string,detail:string}],nextAction:string,dataAvailability:string}.",
  ].join("\n");
}

async function generateContent(input: {
  currency: string;
  period: InsightPeriod;
  current: WeeklyTotals;
  previous: WeeklyTotals | null;
}): Promise<{ content: WeeklyAiInsightContent; model: string }> {
  const config = getChatConfig();
  if (!config.success) {
    throw new Error(config.error);
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: JSON.stringify({
            currency: input.currency,
            currentWeek: {
              from: input.period.periodStart.toISOString(),
              to: input.period.periodEnd.toISOString(),
              income: input.current.income,
              spending: input.current.spending,
              net: roundMoney(input.current.income - input.current.spending),
              transactionCount: input.current.transactionCount,
              recurringTransactionCount: input.current.recurringTransactionCount,
              categoryComparisons: getCategoryComparisons(input.current, input.previous),
              topTransactions: input.current.topTransactions,
            },
            previousWeek: input.previous
              ? {
                  income: input.previous.income,
                  spending: input.previous.spending,
                  net: roundMoney(input.previous.income - input.previous.spending),
                  transactionCount: input.previous.transactionCount,
                  recurringTransactionCount: input.previous.recurringTransactionCount,
                }
              : null,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Weekly AI insight failed with status:", response.status);
    throw new Error("Weekly AI insight provider request failed.");
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Weekly AI insight provider returned an unreadable response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripJsonFences(content));
  } catch {
    throw new Error("Weekly AI insight provider returned invalid JSON.");
  }

  const parsed = weeklyAiInsightContentSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Weekly AI insight provider returned an invalid report.");
  }

  return { content: parsed.data, model: config.model };
}

function toView(input: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date | null;
  content: WeeklyAiInsightContent;
}): WeeklyAiInsightView {
  return {
    id: input.id,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    content: input.content,
  };
}

export async function getWeeklyAiInsightsForUser(
  userId: string
): Promise<WeeklyAiInsightsResponse> {
  const records = await prisma.weeklyAiInsight.findMany({
    where: { userId },
    orderBy: { periodStart: "desc" },
    take: RETENTION_WEEKS,
  });

  const generated = await Promise.all(
    records
      .filter(
        (record) =>
          record.status === WeeklyAiInsightStatus.GENERATED && record.contentEncrypted
      )
      .map(async (record) => {
        try {
          const decrypted = await decryptUserField(
            userId,
            "weeklyAiInsight.content",
            record.contentEncrypted!
          );
          const content = weeklyAiInsightContentSchema.safeParse(JSON.parse(decrypted));
          return content.success
            ? toView({ ...record, content: content.data })
            : null;
        } catch (error) {
          console.error(`Weekly AI insight read error for user ${userId}:`, error);
          return null;
        }
      })
  );

  const archive = generated.filter((record): record is WeeklyAiInsightView => record !== null);
  return {
    latest: archive[0] ?? null,
    archive: archive.slice(1),
    latestFailure: records[0]?.status === WeeklyAiInsightStatus.FAILED,
  };
}

export async function generateWeeklyAiInsightForUser(input: {
  userId: string;
  period?: InsightPeriod;
}): Promise<"generated" | "skipped" | "no_activity" | "failed"> {
  const period = input.period ?? getCompletedWeeklyInsightPeriod(new Date());
  const existing = await prisma.weeklyAiInsight.findUnique({
    where: {
      userId_periodStart: { userId: input.userId, periodStart: period.periodStart },
    },
    select: { id: true, status: true },
  });

  if (existing?.status === WeeklyAiInsightStatus.GENERATED) {
    return "skipped";
  }

  const [user, current, previous] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { mainCurrency: true },
    }),
    getWeeklyTotals({
      userId: input.userId,
      from: period.periodStart,
      to: period.periodEnd,
      includeDescriptions: true,
    }),
    getWeeklyTotals({
      userId: input.userId,
      from: period.previousPeriodStart,
      to: period.previousPeriodEnd,
      includeDescriptions: false,
    }),
  ]);

  if (!user || current.transactionCount === 0) {
    return "no_activity";
  }

  const previousWithActivity = previous.transactionCount > 0 ? previous : null;
  const insight = existing
    ? await prisma.weeklyAiInsight.update({
        where: { id: existing.id },
        data: { status: WeeklyAiInsightStatus.PENDING, failureReason: null },
      })
    : await prisma.weeklyAiInsight.create({
        data: {
          userId: input.userId,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          previousPeriodStart: period.previousPeriodStart,
          previousPeriodEnd: period.previousPeriodEnd,
        },
      });

  try {
    const result = await generateContent({
      currency: user.mainCurrency,
      period,
      current,
      previous: previousWithActivity,
    });
    const contentEncrypted = await encryptUserField(
      input.userId,
      "weeklyAiInsight.content",
      JSON.stringify(result.content)
    );

    await prisma.weeklyAiInsight.update({
      where: { id: insight.id },
      data: {
        status: WeeklyAiInsightStatus.GENERATED,
        contentEncrypted,
        model: result.model,
        promptVersion: PROMPT_VERSION,
        generatedAt: new Date(),
        failureReason: null,
      },
    });

    return "generated";
  } catch (error) {
    console.error(`Weekly AI insight generation error for user ${input.userId}:`, error);
    await prisma.weeklyAiInsight.update({
      where: { id: insight.id },
      data: {
        status: WeeklyAiInsightStatus.FAILED,
        failureReason: "Weekly insight could not be generated. It will retry automatically.",
      },
    });
    return "failed";
  }
}

export async function generateMissingWeeklyAiInsights(now: Date = new Date()) {
  const period = getCompletedWeeklyInsightPeriod(now);
  const users = await prisma.user.findMany({
    where: {
      transactions: {
        some: {
          date: { gte: period.periodStart, lte: period.periodEnd },
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          paymentStatus: PaymentStatus.COMPLETED,
        },
      },
    },
    select: { id: true },
  });
  const candidates = new Map<string, InsightPeriod[]>();
  const addCandidate = (userId: string, candidatePeriod: InsightPeriod) => {
    const periods = candidates.get(userId) ?? [];
    if (!periods.some((item) => item.periodStart.getTime() === candidatePeriod.periodStart.getTime())) {
      periods.push(candidatePeriod);
      candidates.set(userId, periods);
    }
  };

  for (const user of users) {
    addCandidate(user.id, period);
  }

  const failedInsights = await prisma.weeklyAiInsight.findMany({
    where: {
      status: WeeklyAiInsightStatus.FAILED,
      periodStart: { gte: new Date(period.periodStart.getTime() - RETENTION_WEEKS * WEEK_MS) },
    },
    select: {
      userId: true,
      periodStart: true,
      periodEnd: true,
      previousPeriodStart: true,
      previousPeriodEnd: true,
    },
  });
  for (const failedInsight of failedInsights) {
    if (failedInsight.previousPeriodStart && failedInsight.previousPeriodEnd) {
      addCandidate(failedInsight.userId, {
        periodStart: failedInsight.periodStart,
        periodEnd: failedInsight.periodEnd,
        previousPeriodStart: failedInsight.previousPeriodStart,
        previousPeriodEnd: failedInsight.previousPeriodEnd,
      });
    }
  }

  const createdInsights: Array<{ userId: string; periodStart: string }> = [];
  let failed = 0;
  let skipped = 0;

  for (const [userId, periods] of candidates) {
    for (const candidatePeriod of periods) {
      const result = await generateWeeklyAiInsightForUser({ userId, period: candidatePeriod });
      if (result === "generated") {
        createdInsights.push({ userId, periodStart: candidatePeriod.periodStart.toISOString() });
      } else if (result === "failed") {
        failed += 1;
      } else {
        skipped += 1;
      }
    }
  }

  await prisma.weeklyAiInsight.deleteMany({
    where: { periodStart: { lt: new Date(period.periodStart.getTime() - RETENTION_WEEKS * WEEK_MS) } },
  });

  return {
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    generated: createdInsights.length,
    createdInsights,
    failed,
    skipped,
  };
}
