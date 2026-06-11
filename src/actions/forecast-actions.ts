"use server";

import { z } from "zod";

import { auth } from "@/auth";
import {
  decryptAccountName,
  decryptAccountRecords,
  sortAccountsByName,
} from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { isLiquidAccountType } from "@/lib/account-types";
import { buildBudgetForecastEvents } from "@/lib/forecasting/budget-forecast-events";
import { createForecastCurrencyConverter } from "@/lib/forecasting/forecast-currency";
import {
  buildForecastEvent,
  classifyTransactionEventShape,
  type ForecastAccountRef,
  type TransactionForecastSource,
} from "@/lib/forecasting/forecast-events";
import { getForecastRiskSummary } from "@/lib/forecasting/forecast-risk";
import {
  getForecastDateRange,
  roundMoney,
} from "@/lib/forecasting/forecast-periods";
import { projectCashFlow, sortForecastEvents } from "@/lib/forecasting/project-cash-flow";
import { buildRecurringForecastEvents } from "@/lib/forecasting/recurring-forecast-events";
import { getStartingBalanceBeforeFutureTransactions, getTrackedLiquidAccountIds } from "@/lib/forecasting/liquid-balance";
import {
  buildSubscriptionForecastEvents,
  type ForecastSubscription,
} from "@/lib/forecasting/subscription-forecast-events";
import { summarizeForecast } from "@/lib/forecasting/summarize-forecast";
import {
  FORECAST_VARIABLE_SPENDING_MODES,
  type CashFlowForecastResult,
  type ForecastAssumption,
  type ForecastEvent,
  type ForecastWarning,
  type GetCashFlowForecastInput,
} from "@/lib/forecasting/forecast-types";
import {
  buildHistoricalSpendingEstimate,
  getHistoricalLookbackStart,
} from "@/lib/forecasting/historical-spending-estimator";
import {
  BudgetPeriod,
  SubscriptionStatus,
  TransactionType,
} from "@/generated/prisma/client/client";

const getCashFlowForecastSchema = z.object({
  horizonDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
  accountIds: z.array(z.string()).optional(),
  includeFutureTransactions: z.boolean().default(true),
  includeRecurringTransactions: z.boolean().default(true),
  includeSubscriptions: z.boolean().default(true),
  variableSpendingMode: z
    .enum(FORECAST_VARIABLE_SPENDING_MODES)
    .default("historical"),
});

type ValidatedInput = z.infer<typeof getCashFlowForecastSchema>;

function addUniqueWarning(
  warnings: ForecastWarning[],
  seenWarnings: Set<string>,
  warning: ForecastWarning
) {
  const key = `${warning.code}:${warning.message}:${warning.date?.toISOString() ?? ""}:${warning.sourceId ?? ""}`;
  if (seenWarnings.has(key)) {
    return;
  }

  seenWarnings.add(key);
  warnings.push(warning);
}

function createAssumptions(input: {
  includeFutureTransactions: boolean;
  includeRecurringTransactions: boolean;
  includeSubscriptions: boolean;
  variableSpendingMode: ValidatedInput["variableSpendingMode"];
}): ForecastAssumption[] {
  const assumptions: ForecastAssumption[] = [
    {
      code: "forecast_fx",
      label: "Current FX rates",
      detail: "Future conversions use current known exchange rates rather than future dated rates.",
    },
    {
      code: "forecast_scope",
      label: "Liquid cash only",
      detail:
        "Forecasting focuses on active bank and cash accounts. Investments, personal assets, and other non-liquid balances are excluded.",
    },
    {
      code: "credit_card_timing",
      label: "Credit card timing",
      detail:
        "Credit card spending is not treated as immediate cash outflow unless a future liability payment from a liquid account exists.",
    },
  ];

  if (input.includeFutureTransactions) {
    assumptions.push({
      code: "future_transactions",
      label: "Known future transactions",
      detail:
        "Future-dated transactions are adjusted out of the current balance before they are projected back into the timeline.",
    });
  }

  if (input.includeRecurringTransactions) {
    assumptions.push({
      code: "recurring_rules",
      label: "Recurring rules",
      detail:
        "Recurring transactions are projected from each active rule's current next due date.",
    });
  }

  if (input.includeSubscriptions) {
    assumptions.push({
      code: "subscriptions",
      label: "Unlinked subscriptions",
      detail:
        "Active or trial subscriptions are projected only when they are not already linked to a recurring rule.",
    });
  }

  if (input.variableSpendingMode === "historical") {
    assumptions.push({
      code: "historical_spending",
      label: "Historical daily spending",
      detail:
        "Variable spending is estimated from recent non-recurring liquid expenses and treated as low-confidence projected outflow.",
    });
  }

  if (input.variableSpendingMode === "budget") {
    assumptions.push({
      code: "budget_spending",
      label: "Budget pacing",
      detail:
        "Budget mode spreads remaining active budget across the remaining days and treats it as a spending ceiling, not a guaranteed outcome.",
    });
  }

  return assumptions;
}

async function buildTransactionEvent(
  transaction: TransactionForecastSource,
  trackedAccountIds: Set<string>,
  convertAmount: ReturnType<typeof createForecastCurrencyConverter>["convertAmount"]
): Promise<ForecastEvent | null> {
  const shape = classifyTransactionEventShape(transaction, trackedAccountIds);
  if (!shape) {
    return null;
  }

  const conversion = await convertAmount(transaction.amount, transaction.currency, {
    storedRate: transaction.exchangeRate,
    warningDate: transaction.date,
    warningSourceId: transaction.id,
  });

  return buildForecastEvent({
    id: `transaction-${transaction.id}`,
    date: transaction.date,
    type: shape.type,
    label: shape.label,
    amount: transaction.amount,
    currency: transaction.currency,
    amountInMainCurrency: conversion.amountInTargetCurrency,
    direction: shape.direction,
    confidence: "high",
    source: shape.source,
    sourceId: transaction.id,
    categoryId: transaction.categoryId,
    accountId: shape.accountId,
    conversionRate: conversion.conversionRate,
    conversionSource: conversion.conversionSource,
    excludedFromProjection: shape.excludedFromProjection,
  });
}

function getBudgetPeriodRange(period: BudgetPeriod, now: Date) {
  switch (period) {
    case "MONTHLY":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case "QUARTERLY": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), quarterStartMonth, 1),
        end: new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999),
      };
    }
    case "YEARLY":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
  }
}

export async function getCashFlowForecast(
  input: Partial<GetCashFlowForecastInput> = {}
): Promise<{ success: boolean; data?: CashFlowForecastResult; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = getCashFlowForecastSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const args = validated.data;
    const { startDate, endDate } = getForecastDateRange(args.horizonDays);
    const historicalStart = getHistoricalLookbackStart(startDate);
    const warnings: ForecastWarning[] = [];
    const seenWarnings = new Set<string>();
    const addWarning = (warning: ForecastWarning) =>
      addUniqueWarning(warnings, seenWarnings, warning);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        mainCurrency: true,
        monthlyBudget: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        id: true,
        nameEncrypted: true,
        descriptionEncrypted: true,
        type: true,
        currency: true,
        balance: true,
        isActive: true,
      },
    });
    const decryptedAccounts = sortAccountsByName(
      await decryptAccountRecords(session.user.id, accounts)
    );

    const liquidAccounts = decryptedAccounts.filter((account) =>
      isLiquidAccountType(account.type)
    );
    if (args.accountIds?.length) {
      const selectedAccountIdSet = new Set(args.accountIds);
      const selectedLiquidAccounts = liquidAccounts.filter((account) =>
        selectedAccountIdSet.has(account.id)
      );

      if (selectedLiquidAccounts.length !== selectedAccountIdSet.size) {
        return {
          success: false,
          error: "Selected accounts must be active bank or cash accounts that belong to you.",
        };
      }
    }

    const trackedAccountIds = getTrackedLiquidAccountIds(
      liquidAccounts as ForecastAccountRef[],
      args.accountIds
    );

    if (trackedAccountIds.size === 0) {
      addWarning({
        code: "no_liquid_accounts",
        severity: "info",
        message:
          liquidAccounts.length === 0
            ? "No active bank or cash accounts are available for forecasting."
            : "No tracked liquid accounts were selected for forecasting.",
      });

      return {
        success: true,
        data: {
          startDate,
          endDate,
          horizonDays: args.horizonDays,
          currency: user.mainCurrency,
          startingLiquidBalance: 0,
          endingProjectedBalance: 0,
          lowestProjectedBalance: 0,
          lowestProjectedBalanceDate: null,
          totalInflow: 0,
          totalOutflow: 0,
          netCashFlow: 0,
          status: "safe",
          dailyBalances: [],
          events: [],
          assumptions: createAssumptions(args),
          warnings,
        },
      };
    }

    const converter = createForecastCurrencyConverter(user.mainCurrency, addWarning);
    const accountMap = new Map(
      decryptedAccounts.map((account) => [account.id, account])
    );

    const [
      futureTransactions,
      recurringRules,
      subscriptions,
      historyTransactions,
      budgets,
    ] = await Promise.all([
      args.includeFutureTransactions
        ? prisma.transaction.findMany({
            where: {
              userId: session.user.id,
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            select: {
              id: true,
              amount: true,
              currency: true,
              exchangeRate: true,
              type: true,
              date: true,
              categoryId: true,
              isRecurring: true,
              recurringRuleId: true,
              paymentStatus: true,
              category: {
                select: {
                  name: true,
                },
              },
              account: {
                select: {
                  id: true,
                  nameEncrypted: true,
                  type: true,
                  currency: true,
                  isActive: true,
                },
              },
              toAccount: {
                select: {
                  id: true,
                  nameEncrypted: true,
                  type: true,
                  currency: true,
                  isActive: true,
                },
              },
            },
            orderBy: { date: "asc" },
          })
        : Promise.resolve([]),
      args.includeRecurringTransactions
        ? prisma.recurringRule.findMany({
            where: {
              userId: session.user.id,
              isActive: true,
              nextDueDate: {
                lte: endDate,
              },
              OR: [{ endDate: null }, { endDate: { gte: startDate } }],
            },
            select: {
              id: true,
              name: true,
              amount: true,
              currency: true,
              type: true,
              interval: true,
              nextDueDate: true,
              endDate: true,
              categoryId: true,
              accountId: true,
            },
          })
        : Promise.resolve([]),
      args.includeSubscriptions
        ? prisma.subscription.findMany({
            where: {
              userId: session.user.id,
              status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
              nextBillingDate: {
                lte: endDate,
              },
            },
            select: {
              id: true,
              name: true,
              amount: true,
              currency: true,
              billingCycle: true,
              nextBillingDate: true,
              status: true,
              recurringRuleId: true,
              categoryId: true,
              accountId: true,
              account: {
                select: {
                  id: true,
                  nameEncrypted: true,
                  type: true,
                  currency: true,
                  isActive: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      prisma.transaction.findMany({
        where: {
          userId: session.user.id,
          date: {
            gte: historicalStart,
            lt: startDate,
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          exchangeRate: true,
          type: true,
          date: true,
          categoryId: true,
          isRecurring: true,
          recurringRuleId: true,
          paymentStatus: true,
          account: {
            select: {
              id: true,
              nameEncrypted: true,
              type: true,
              currency: true,
              isActive: true,
            },
          },
          toAccount: {
            select: {
              id: true,
              nameEncrypted: true,
              type: true,
              currency: true,
              isActive: true,
            },
          },
        },
      }),
      args.variableSpendingMode === "budget"
        ? prisma.budget.findMany({
            where: {
              userId: session.user.id,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              amount: true,
              period: true,
              startDate: true,
              endDate: true,
              categoryId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const [decryptedFutureTransactions, decryptedSubscriptions, decryptedHistoryTransactions] =
      await Promise.all([
        Promise.all(
          futureTransactions.map(async (transaction) => ({
            ...transaction,
            account: {
              ...transaction.account,
              name: await decryptAccountName(
                session.user.id,
                transaction.account.nameEncrypted
              ),
            },
            toAccount: transaction.toAccount
              ? {
                  ...transaction.toAccount,
                  name: await decryptAccountName(
                    session.user.id,
                    transaction.toAccount.nameEncrypted
                  ),
                }
              : null,
          }))
        ),
        Promise.all(
          subscriptions.map(async (subscription) => ({
            ...subscription,
            account: subscription.account
              ? {
                  ...subscription.account,
                  name: await decryptAccountName(
                    session.user.id,
                    subscription.account.nameEncrypted
                  ),
                }
              : null,
          }))
        ),
        Promise.all(
          historyTransactions.map(async (transaction) => ({
            ...transaction,
            account: {
              ...transaction.account,
              name: await decryptAccountName(
                session.user.id,
                transaction.account.nameEncrypted
              ),
            },
            toAccount: transaction.toAccount
              ? {
                  ...transaction.toAccount,
                  name: await decryptAccountName(
                    session.user.id,
                    transaction.toAccount.nameEncrypted
                  ),
                }
              : null,
          }))
        ),
      ]);

    let currentLiquidBalance = 0;
    for (const account of liquidAccounts) {
      if (!trackedAccountIds.has(account.id)) {
        continue;
      }

      const converted = await converter.convertAmount(
        account.balance,
        account.currency,
        { warningSourceId: account.id }
      );

      if (converted.amountInTargetCurrency !== null) {
        currentLiquidBalance = roundMoney(
          currentLiquidBalance + converted.amountInTargetCurrency
        );
      }
    }

    const futureTransactionEvents = (
      await Promise.all(
        decryptedFutureTransactions.map((transaction) =>
          buildTransactionEvent(
            transaction as unknown as TransactionForecastSource,
            trackedAccountIds,
            converter.convertAmount
          )
        )
      )
    ).filter((event): event is ForecastEvent => !!event);

    const { startingBalance, adjustedAmount } =
      getStartingBalanceBeforeFutureTransactions(
        currentLiquidBalance,
        futureTransactionEvents
      );

    const existingRecurringTransactionKeys = new Set(
      decryptedFutureTransactions
        .filter((transaction) => transaction.recurringRuleId)
        .map(
          (transaction) =>
            `${transaction.recurringRuleId}:${transaction.date.toISOString().slice(0, 10)}`
        )
    );

    const recurringEvents = await buildRecurringForecastEvents({
      rules: recurringRules.map((rule) => ({
        ...rule,
        account: rule.accountId ? accountMap.get(rule.accountId) ?? null : null,
        category: null,
      })),
      startDate,
      endDate,
      trackedAccountIds,
      existingRecurringTransactionKeys,
      convertAmount: (amount, currency, options) =>
        converter.convertAmount(amount, currency, options),
      addWarning,
    });

    const subscriptionEvents = await buildSubscriptionForecastEvents({
      subscriptions: decryptedSubscriptions as ForecastSubscription[],
      startDate,
      endDate,
      trackedAccountIds,
      convertAmount: (amount, currency, options) =>
        converter.convertAmount(amount, currency, options),
    });

    const historicalForecastCandidates: { amountInMainCurrency: number; date: Date }[] = [];
    let historicalOutflowBasis = 0;

    for (const transaction of decryptedHistoryTransactions) {
      const event = await buildTransactionEvent(
        transaction as unknown as TransactionForecastSource,
        trackedAccountIds,
        async (amount, _currency, options) => ({
          amountInTargetCurrency:
            options?.storedRate && options.storedRate > 0
              ? roundMoney(amount * options.storedRate)
              : roundMoney(amount * transaction.exchangeRate),
          conversionRate:
            options?.storedRate && options.storedRate > 0
              ? options.storedRate
              : transaction.exchangeRate,
          conversionSource: "stored_transaction_rate",
        })
      );

      if (!event || event.excludedFromProjection || event.amountInMainCurrency === null) {
        continue;
      }

      if (event.direction === "outflow") {
        historicalOutflowBasis = roundMoney(
          historicalOutflowBasis + event.amountInMainCurrency
        );
      }

      if (
        args.variableSpendingMode === "historical" &&
        transaction.type === TransactionType.EXPENSE &&
        !transaction.isRecurring &&
        !transaction.recurringRuleId &&
        event.direction === "outflow"
      ) {
        historicalForecastCandidates.push({
          amountInMainCurrency: event.amountInMainCurrency,
          date: transaction.date,
        });
      }
    }

    const actualMonthlyOutflow = roundMoney(historicalOutflowBasis / 3);

    const variableSpendingEvents: ForecastEvent[] = [];
    if (args.variableSpendingMode === "historical") {
      const estimate = buildHistoricalSpendingEstimate({
        history: historicalForecastCandidates,
        startDate,
        endDate,
        currency: user.mainCurrency,
      });
      estimate.warnings.forEach(addWarning);
      variableSpendingEvents.push(...estimate.events);
    }

    if (args.variableSpendingMode === "budget") {
      const actualSpentByBudgetId = new Map<string, number>();
      const plannedExpenseByCategoryId = new Map<string, number>();
      let uncategorizedPlannedExpense = 0;

      for (const budget of budgets) {
        const range = getBudgetPeriodRange(budget.period, startDate);
        const spentTransactions = await prisma.transaction.findMany({
          where: {
            userId: session.user.id,
            date: {
              gte: range.start,
              lt: startDate,
            },
            type: {
              in: budget.categoryId
                ? [TransactionType.EXPENSE]
                : [TransactionType.EXPENSE, TransactionType.LIABILITY_PAYMENT],
            },
            ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
          },
          select: {
            amount: true,
            exchangeRate: true,
            currency: true,
          },
        });

        const spent = spentTransactions.reduce((sum, transaction) => {
          const normalized =
            transaction.currency === user.mainCurrency
              ? transaction.amount
              : transaction.amount * transaction.exchangeRate;
          return sum + normalized;
        }, 0);

        actualSpentByBudgetId.set(budget.id, roundMoney(spent));
      }

      for (const event of [
        ...futureTransactionEvents,
        ...recurringEvents,
        ...subscriptionEvents,
      ]) {
        if (
          event.direction !== "outflow" ||
          event.amountInMainCurrency === null ||
          event.excludedFromProjection
        ) {
          continue;
        }

        if (event.categoryId) {
          plannedExpenseByCategoryId.set(
            event.categoryId,
            roundMoney(
              (plannedExpenseByCategoryId.get(event.categoryId) ?? 0) +
                event.amountInMainCurrency
            )
          );
        } else {
          uncategorizedPlannedExpense = roundMoney(
            uncategorizedPlannedExpense + event.amountInMainCurrency
          );
        }
      }

      variableSpendingEvents.push(
        ...buildBudgetForecastEvents({
          budgets,
          startDate,
          endDate,
          actualSpentByBudgetId,
          plannedExpenseByCategoryId,
          uncategorizedPlannedExpense,
          currency: user.mainCurrency,
        })
      );
    }

    const allEvents = sortForecastEvents([
      ...futureTransactionEvents,
      ...recurringEvents,
      ...subscriptionEvents,
      ...variableSpendingEvents,
    ]);

    const dailyBalances = projectCashFlow({
      startDate,
      endDate,
      startingBalance,
      events: allEvents,
    });

    const summary = summarizeForecast(dailyBalances, allEvents);
    const projectedThirtyDayOutflow = roundMoney(
      dailyBalances
        .slice(0, Math.min(30, dailyBalances.length))
        .reduce((sum, day) => sum + day.outflow, 0)
    );

    const riskSummary = getForecastRiskSummary({
      dailyBalances,
      projectedThirtyDayOutflow,
      historicalMonthlyOutflow: actualMonthlyOutflow,
      userMonthlyBudget: user.monthlyBudget,
      hasLowConfidenceSignals: variableSpendingEvents.length > 0,
      hasRecurringEvents: recurringEvents.some(
        (event) =>
          event.type === "recurring_income" || event.type === "recurring_expense"
      ),
      futureTransactionAdjustmentApplied: adjustedAmount !== 0,
      existingWarnings: warnings,
      lowestProjectedBalance: summary.lowestProjectedBalance,
      lowestProjectedBalanceDate: summary.lowestProjectedBalanceDate,
    });

    return {
      success: true,
      data: {
        startDate,
        endDate,
        horizonDays: args.horizonDays,
        currency: user.mainCurrency,
        startingLiquidBalance: startingBalance,
        endingProjectedBalance: summary.endingProjectedBalance,
        lowestProjectedBalance: summary.lowestProjectedBalance,
        lowestProjectedBalanceDate: summary.lowestProjectedBalanceDate,
        totalInflow: summary.totalInflow,
        totalOutflow: summary.totalOutflow,
        netCashFlow: summary.netCashFlow,
        status: riskSummary.status,
        dailyBalances,
        events: allEvents,
        assumptions: createAssumptions(args),
        warnings: riskSummary.warnings,
      },
    };
  } catch (error) {
    console.error("Get cash flow forecast error:", error);
    return {
      success: false,
      error: "Failed to generate cash flow forecast",
    };
  }
}
