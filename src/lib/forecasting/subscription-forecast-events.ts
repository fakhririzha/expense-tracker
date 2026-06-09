import {
  addMonths,
  addWeeks,
  addYears,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";

import { SubscriptionBillingCycle, SubscriptionStatus } from "@/generated/prisma/client/client";
import {
  buildForecastEvent,
  isTrackedLiquidAccount,
  type ForecastAccountRef,
} from "@/lib/forecasting/forecast-events";
import { getDateKey } from "@/lib/forecasting/forecast-periods";
import type { ForecastEvent } from "@/lib/forecasting/forecast-types";

export interface ForecastSubscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  nextBillingDate: Date;
  status: SubscriptionStatus;
  recurringRuleId: string | null;
  categoryId: string | null;
  accountId: string | null;
  account: ForecastAccountRef | null;
}

function advanceBillingDate(
  date: Date,
  cycle: SubscriptionBillingCycle
): Date {
  switch (cycle) {
    case "WEEKLY":
      return addWeeks(date, 1);
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

export async function buildSubscriptionForecastEvents(args: {
  subscriptions: ForecastSubscription[];
  startDate: Date;
  endDate: Date;
  trackedAccountIds: Set<string>;
  convertAmount: (
    amount: number,
    currency: string,
    options?: { warningDate?: Date; warningSourceId?: string }
  ) => Promise<{
    amountInTargetCurrency: number | null;
    conversionRate: number | null;
    conversionSource: ForecastEvent["conversionSource"];
  }>;
}): Promise<ForecastEvent[]> {
  const events: ForecastEvent[] = [];

  for (const subscription of args.subscriptions) {
    if (subscription.recurringRuleId) {
      continue;
    }

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.TRIAL
    ) {
      continue;
    }

    if (!subscription.account || !isTrackedLiquidAccount(subscription.account, args.trackedAccountIds)) {
      continue;
    }

    let occurrence = startOfDay(subscription.nextBillingDate);
    while (!isAfter(occurrence, startOfDay(args.endDate))) {
      if (!isBefore(occurrence, startOfDay(args.startDate))) {
        const conversion = await args.convertAmount(
          subscription.amount,
          subscription.currency,
          {
            warningDate: occurrence,
            warningSourceId: subscription.id,
          }
        );

        events.push(
          buildForecastEvent({
            id: `subscription-${subscription.id}-${getDateKey(occurrence)}`,
            date: occurrence,
            type: "subscription",
            label: subscription.name,
            amount: subscription.amount,
            currency: subscription.currency,
            amountInMainCurrency: conversion.amountInTargetCurrency,
            direction: "outflow",
            confidence: "high",
            source: "subscription",
            sourceId: subscription.id,
            categoryId: subscription.categoryId,
            accountId: subscription.accountId,
            conversionRate: conversion.conversionRate,
            conversionSource: conversion.conversionSource,
          })
        );
      }

      occurrence = advanceBillingDate(occurrence, subscription.billingCycle);
    }
  }

  return events;
}
