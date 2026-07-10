"use server";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";

import { auth } from "@/auth";
import {
  SubscriptionStatus,
  TransactionType,
  type RecurringInterval,
} from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { decryptRequiredCompanion } from "@/lib/encrypted-companion-crypto";
import { getExchangeRate } from "@/lib/finance-service";
import { decryptUserField } from "@/lib/user-encryption";

const DEFAULT_WINDOW_DAYS = 30;

export interface UpcomingBankPressureItem {
  id: string;
  label: string;
  dueDate: Date;
  amount: number;
  currency: string;
  convertedAmount: number;
  source: "subscription" | "recurring_rule";
  recurringRuleId: string | null;
  subscriptionId: string | null;
  managedBySubscription: boolean;
}

export interface UpcomingBankPressureAlert {
  accountId: string;
  accountName: string;
  currency: string;
  currentBalance: number;
  upcomingOutflowTotal: number;
  shortfall: number;
  itemCount: number;
  missingConversionCount: number;
  items: UpcomingBankPressureItem[];
}

function addRecurringInterval(date: Date, interval: RecurringInterval): Date {
  switch (interval) {
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addWeeks(date, 1);
    case "BIWEEKLY":
      return addWeeks(date, 2);
    case "MONTHLY":
      return addMonths(date, 1);
    case "QUARTERLY":
      return addMonths(date, 3);
    case "YEARLY":
      return addYears(date, 1);
    default:
      return addMonths(date, 1);
  }
}

function buildOccurrences(args: {
  startDate: Date;
  endDate: Date;
  interval: RecurringInterval;
  cutoffDate?: Date | null;
}): Date[] {
  const occurrences: Date[] = [];
  let cursor = startOfDay(args.startDate);
  const rangeStart = startOfDay(args.startDate);
  const rangeEnd = endOfDay(args.endDate);
  const cutoffDate = args.cutoffDate ? endOfDay(args.cutoffDate) : null;

  while (!isAfter(cursor, rangeEnd)) {
    if (!cutoffDate || !isAfter(cursor, cutoffDate)) {
      if (!isBefore(cursor, rangeStart)) {
        occurrences.push(cursor);
      }
    } else {
      break;
    }

    cursor = startOfDay(addRecurringInterval(cursor, args.interval));
  }

  return occurrences;
}

async function decryptName(
  userId: string,
  field: "account.name" | "recurringRule.name" | "subscription.name",
  encrypted: string | null,
  fallback: string | null
) {
  if (field !== "account.name") {
    return decryptRequiredCompanion(userId, field, encrypted, fallback);
  }

  if (!encrypted) {
    return fallback ?? "";
  }

  try {
    return await decryptUserField(userId, field, encrypted);
  } catch {
    return fallback ?? "";
  }
}

export async function getUpcomingBankPressureForUser(
  userId: string,
  days: number = DEFAULT_WINDOW_DAYS
) {
  try {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_WINDOW_DAYS;
    const rangeStart = startOfDay(new Date());
    const rangeEnd = endOfDay(addDays(rangeStart, safeDays - 1));

    const bankAccounts = await prisma.financialAccount.findMany({
      where: {
        userId,
        isActive: true,
        type: "BANK",
      },
      select: {
        id: true,
        nameEncrypted: true,
        currency: true,
        balance: true,
      },
    });

    if (bankAccounts.length === 0) {
      return { success: true, data: [] as UpcomingBankPressureAlert[] };
    }

    const bankAccountIds = bankAccounts.map((account) => account.id);
    const [recurringRules, subscriptions] = await Promise.all([
      prisma.recurringRule.findMany({
        where: {
          userId,
          isActive: true,
          accountId: { in: bankAccountIds },
          type: { in: [TransactionType.EXPENSE, TransactionType.TRANSFER] },
          nextDueDate: { lte: rangeEnd },
          OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
        },
        select: {
          id: true,
          name: true,
          nameEncrypted: true,
          amount: true,
          currency: true,
          type: true,
          interval: true,
          nextDueDate: true,
          endDate: true,
          accountId: true,
          subscription: {
            select: { id: true },
          },
        },
      }),
      prisma.subscription.findMany({
        where: {
          userId,
          recurringRuleId: null,
          accountId: { in: bankAccountIds },
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
          nextBillingDate: { lte: rangeEnd },
        },
        select: {
          id: true,
          name: true,
          nameEncrypted: true,
          amount: true,
          currency: true,
          nextBillingDate: true,
          billingCycle: true,
          status: true,
          accountId: true,
        },
      }),
    ]);

    const decryptedAccountEntries = await Promise.all(
      bankAccounts.map(async (account) => [
        account.id,
        {
          ...account,
          name: await decryptName(
            userId,
            "account.name",
            account.nameEncrypted,
            ""
          ),
        },
      ] as const)
    );
    const accountMap = new Map(decryptedAccountEntries);

    const decryptedRuleEntries = await Promise.all(
      recurringRules.map(async (rule) => [
        rule.id,
        {
          ...rule,
          name: await decryptName(
            userId,
            "recurringRule.name",
            rule.nameEncrypted,
            rule.name
          ),
        },
      ] as const)
    );
    const recurringRuleMap = new Map(decryptedRuleEntries);

    const decryptedSubscriptionEntries = await Promise.all(
      subscriptions.map(async (subscription) => [
        subscription.id,
        {
          ...subscription,
          name: await decryptName(
            userId,
            "subscription.name",
            subscription.nameEncrypted,
            subscription.name
          ),
        },
      ] as const)
    );
    const subscriptionMap = new Map(decryptedSubscriptionEntries);

    const rateCache = new Map<string, number | null>();
    const cachedRateRows = await prisma.exchangeRate.findMany({
      where: {
        OR: bankAccounts.flatMap((account) => [
          { toCurrency: account.currency },
          { fromCurrency: account.currency },
        ]),
      },
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
      },
    });

    for (const rate of cachedRateRows) {
      rateCache.set(`${rate.fromCurrency}:${rate.toCurrency}`, rate.rate);
    }

    const convertAmount = async (
      amount: number,
      fromCurrency: string,
      toCurrency: string
    ) => {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      const key = `${fromCurrency}:${toCurrency}`;
      if (rateCache.has(key)) {
        const cached = rateCache.get(key);
        return cached && Number.isFinite(cached) && cached > 0 ? amount * cached : null;
      }

      const liveRate = await getExchangeRate(fromCurrency, toCurrency);
      if (liveRate && Number.isFinite(liveRate) && liveRate > 0) {
        rateCache.set(key, liveRate);
        return amount * liveRate;
      }

      const cachedRate = await prisma.exchangeRate.findUnique({
        where: {
          fromCurrency_toCurrency: {
            fromCurrency,
            toCurrency,
          },
        },
        select: { rate: true },
      });

      const nextRate =
        cachedRate?.rate && Number.isFinite(cachedRate.rate) && cachedRate.rate > 0
          ? cachedRate.rate
          : null;

      rateCache.set(key, nextRate);
      return nextRate ? amount * nextRate : null;
    };

    const pressureByAccountId = new Map<
      string,
      {
        upcomingOutflowTotal: number;
        missingConversionCount: number;
        items: UpcomingBankPressureItem[];
      }
    >();

    for (const account of bankAccounts) {
      pressureByAccountId.set(account.id, {
        upcomingOutflowTotal: 0,
        missingConversionCount: 0,
        items: [],
      });
    }

    for (const rule of recurringRules) {
      if (!rule.accountId) {
        continue;
      }

      const account = accountMap.get(rule.accountId);
      const entry = pressureByAccountId.get(rule.accountId);
      const decryptedRule = recurringRuleMap.get(rule.id);
      if (!account || !entry || !decryptedRule) {
        continue;
      }

      const occurrences = buildOccurrences({
        startDate: rule.nextDueDate,
        endDate: rangeEnd,
        interval: rule.interval,
        cutoffDate: rule.endDate,
      }).filter((date) => !isBefore(date, rangeStart));

      for (const dueDate of occurrences) {
        const convertedAmount = await convertAmount(
          rule.amount,
          rule.currency,
          account.currency
        );

        if (convertedAmount === null) {
          entry.missingConversionCount += 1;
          continue;
        }

        entry.upcomingOutflowTotal += convertedAmount;
        entry.items.push({
          id: `${rule.id}:${dueDate.toISOString()}`,
          label: decryptedRule.name,
          dueDate,
          amount: rule.amount,
          currency: rule.currency,
          convertedAmount,
          source: "recurring_rule",
          recurringRuleId: rule.id,
          subscriptionId: rule.subscription?.id ?? null,
          managedBySubscription: !!rule.subscription,
        });
      }
    }

    for (const subscription of subscriptions) {
      if (!subscription.accountId) {
        continue;
      }

      const account = accountMap.get(subscription.accountId);
      const entry = pressureByAccountId.get(subscription.accountId);
      const decryptedSubscription = subscriptionMap.get(subscription.id);
      if (!account || !entry || !decryptedSubscription) {
        continue;
      }

      const occurrences = buildOccurrences({
        startDate: subscription.nextBillingDate,
        endDate: rangeEnd,
        interval: subscription.billingCycle,
      }).filter((date) => !isBefore(date, rangeStart));

      for (const dueDate of occurrences) {
        const convertedAmount = await convertAmount(
          subscription.amount,
          subscription.currency,
          account.currency
        );

        if (convertedAmount === null) {
          entry.missingConversionCount += 1;
          continue;
        }

        entry.upcomingOutflowTotal += convertedAmount;
        entry.items.push({
          id: `${subscription.id}:${dueDate.toISOString()}`,
          label: decryptedSubscription.name,
          dueDate,
          amount: subscription.amount,
          currency: subscription.currency,
          convertedAmount,
          source: "subscription",
          recurringRuleId: null,
          subscriptionId: subscription.id,
          managedBySubscription: false,
        });
      }
    }

    const alerts = bankAccounts
      .map((account) => {
        const pressure = pressureByAccountId.get(account.id);
        const decryptedAccount = accountMap.get(account.id);
        if (!pressure || !decryptedAccount) {
          return null;
        }

        const upcomingOutflowTotal = Number(
          pressure.upcomingOutflowTotal.toFixed(4)
        );
        const shortfall = Number(
          Math.max(0, upcomingOutflowTotal - account.balance).toFixed(4)
        );

        if (shortfall <= 0) {
          return null;
        }

        return {
          accountId: account.id,
          accountName: decryptedAccount.name,
          currency: account.currency,
          currentBalance: account.balance,
          upcomingOutflowTotal,
          shortfall,
          itemCount: pressure.items.length,
          missingConversionCount: pressure.missingConversionCount,
          items: pressure.items.sort(
            (left, right) => left.dueDate.getTime() - right.dueDate.getTime()
          ),
        } satisfies UpcomingBankPressureAlert;
      })
      .filter((alert): alert is UpcomingBankPressureAlert => !!alert)
      .sort((left, right) => right.shortfall - left.shortfall);

    return { success: true, data: alerts };
  } catch (error) {
    console.error("Get upcoming bank pressure error:", error);
    return { success: false, error: "Failed to fetch upcoming bank pressure" };
  }
}

export async function getUpcomingBankPressure(days: number = DEFAULT_WINDOW_DAYS) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    return getUpcomingBankPressureForUser(session.user.id, days);
  } catch (error) {
    console.error("Get upcoming bank pressure action error:", error);
    return { success: false, error: "Failed to fetch upcoming bank pressure" };
  }
}
