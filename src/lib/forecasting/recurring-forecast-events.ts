import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";

import { TransactionType, type RecurringInterval } from "@/generated/prisma/client/client";
import {
  buildForecastEvent,
  isTrackedLiquidAccount,
  type ForecastAccountRef,
} from "@/lib/forecasting/forecast-events";
import { getDateKey } from "@/lib/forecasting/forecast-periods";
import type {
  ForecastEvent,
  ForecastWarning,
} from "@/lib/forecasting/forecast-types";

export interface RecurringForecastRule {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: TransactionType;
  interval: RecurringInterval;
  nextDueDate: Date;
  endDate: Date | null;
  categoryId: string | null;
  accountId: string | null;
  account: ForecastAccountRef | null;
  category: { name: string } | null;
}

function advanceDate(date: Date, interval: RecurringInterval): Date {
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

export async function buildRecurringForecastEvents(args: {
  rules: RecurringForecastRule[];
  startDate: Date;
  endDate: Date;
  trackedAccountIds: Set<string>;
  existingRecurringTransactionKeys: Set<string>;
  convertAmount: (
    amount: number,
    currency: string,
    options?: { warningDate?: Date; warningSourceId?: string }
  ) => Promise<{
    amountInTargetCurrency: number | null;
    conversionRate: number | null;
    conversionSource: ForecastEvent["conversionSource"];
  }>;
  addWarning: (warning: ForecastWarning) => void;
}): Promise<ForecastEvent[]> {
  const events: ForecastEvent[] = [];

  for (const rule of args.rules) {
    if (!rule.account || !rule.account.isActive || !rule.accountId) {
      continue;
    }

    let occurrence = startOfDay(rule.nextDueDate);
    const lastDate = rule.endDate ? startOfDay(rule.endDate) : null;

    while (!isAfter(occurrence, startOfDay(args.endDate))) {
      if (!isBefore(occurrence, startOfDay(args.startDate))) {
        if (lastDate && isAfter(occurrence, lastDate)) {
          break;
        }

        const duplicateKey = `${rule.id}:${getDateKey(occurrence)}`;
        if (args.existingRecurringTransactionKeys.has(duplicateKey)) {
          occurrence = advanceDate(occurrence, rule.interval);
          continue;
        }

        const trackedLiquid = isTrackedLiquidAccount(rule.account, args.trackedAccountIds);

        if (trackedLiquid || rule.type === TransactionType.TRANSFER) {
          const conversion = await args.convertAmount(rule.amount, rule.currency, {
            warningDate: occurrence,
            warningSourceId: rule.id,
          });

          if (rule.type === TransactionType.TRANSFER) {
            if (trackedLiquid) {
              args.addWarning({
                code: "recurring_transfer_outflow",
                severity: "info",
                message:
                  "Recurring transfers are treated as cash outflows because recurring rules do not store a destination account.",
                date: occurrence,
                sourceId: rule.id,
              });

              events.push(
                buildForecastEvent({
                  id: `recurring-${rule.id}-${getDateKey(occurrence)}`,
                  date: occurrence,
                  type: "transfer_out",
                  label: rule.name,
                  amount: rule.amount,
                  currency: rule.currency,
                  amountInMainCurrency: conversion.amountInTargetCurrency,
                  direction: "outflow",
                  confidence: "medium",
                  source: "recurring_transaction",
                  sourceId: rule.id,
                  categoryId: rule.categoryId,
                  accountId: rule.accountId,
                  conversionRate: conversion.conversionRate,
                  conversionSource: conversion.conversionSource,
                })
              );
            }
          } else if (trackedLiquid) {
            events.push(
              buildForecastEvent({
                id: `recurring-${rule.id}-${getDateKey(occurrence)}`,
                date: occurrence,
                type:
                  rule.type === TransactionType.INCOME
                    ? "recurring_income"
                    : "recurring_expense",
                label: rule.name || rule.category?.name || "Recurring transaction",
                amount: rule.amount,
                currency: rule.currency,
                amountInMainCurrency: conversion.amountInTargetCurrency,
                direction: rule.type === TransactionType.INCOME ? "inflow" : "outflow",
                confidence: "high",
                source: "recurring_transaction",
                sourceId: rule.id,
                categoryId: rule.categoryId,
                accountId: rule.accountId,
                conversionRate: conversion.conversionRate,
                conversionSource: conversion.conversionSource,
              })
            );
          }
        }
      }

      occurrence = advanceDate(occurrence, rule.interval);
      if (lastDate && isAfter(occurrence, lastDate)) {
        break;
      }
    }
  }

  return events;
}
