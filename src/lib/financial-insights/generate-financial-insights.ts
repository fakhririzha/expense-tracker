import {
  FINANCIAL_INSIGHT_SEVERITY_ORDER,
  type FinancialInsight,
  type FinancialInsightResponse,
  type FinancialInsightScope,
  type FinancialInsightSeverity,
  type FinancialInsightSummary,
  type FinancialInsightType,
} from "@/lib/financial-insights/insight-types";
import {
  BUDGET_DANGER_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  CASH_FLOW_DANGER_THRESHOLD,
  CASH_FLOW_WARNING_THRESHOLD,
  DEBT_PRESSURE_DANGER_THRESHOLD,
  DEBT_PRESSURE_WARNING_THRESHOLD,
  EMERGENCY_FUND_DANGER_MONTHS,
  EMERGENCY_FUND_SUCCESS_MONTHS,
  EMERGENCY_FUND_WARNING_MONTHS,
  GOAL_PROGRESS_GAP_THRESHOLD,
  HIGH_CATEGORY_SPENDING_INFO_THRESHOLD,
  HIGH_CATEGORY_SPENDING_WARNING_THRESHOLD,
  INACTIVE_ACCOUNT_INFO_DAYS,
  INACTIVE_ACCOUNT_WARNING_DAYS,
  INVESTMENT_CONCENTRATION_THRESHOLD,
  INVESTMENT_EXPOSURE_THRESHOLD,
  MULTI_CURRENCY_SHARE_THRESHOLD,
  NET_WORTH_DANGER_THRESHOLD,
  NET_WORTH_SUCCESS_THRESHOLD,
  NET_WORTH_WARNING_THRESHOLD,
  SPENDING_MATERIAL_SHARE_THRESHOLD,
  SPENDING_REDUCTION_THRESHOLD,
  SPENDING_SPIKE_THRESHOLD,
  UNUSUAL_TRANSACTION_MIN_SAMPLES,
  UNUSUAL_TRANSACTION_MULTIPLIER,
} from "@/lib/financial-insights/insight-thresholds";

export interface InsightBudgetProgress {
  id: string;
  name: string;
  amount: number;
  spent: number;
  percentage: number;
  categoryId: string | null;
  categoryName: string | null;
}

export interface InsightCategorySpendComparison {
  categoryId: string | null;
  categoryName: string;
  currentAmount: number;
  previousAmount: number;
  currentShare: number;
}

export interface InsightGoalProgress {
  id: string;
  name: string;
  completionRatio: number;
  expectedRatio: number;
  gapRatio: number;
}

export interface InsightInactiveAccountSummary {
  inactive90Count: number;
  inactive180Count: number;
  oldestDays: number | null;
}

export interface InsightUnusualTransactionCandidate {
  transactionId: string;
  categoryName: string;
  amount: number;
  baselineAverage: number;
  multiplier: number;
  sampleCount: number;
}

export interface InsightNetWorthMovement {
  currentNetWorth: number;
  previousNetWorth: number;
  changeAmount: number;
  changePercent: number;
  currency: string;
  fromDate: string;
  toDate: string;
}

export interface InsightPortfolioAllocation {
  totalPortfolioValue: number;
  totalAssetBase: number;
  investmentExposureRatio: number;
  largestHoldingSymbol: string | null;
  largestHoldingValue: number;
  largestHoldingRatio: number;
}

export interface InsightMultiCurrencyExposure {
  nonMainAssetValue: number;
  totalTrackedAssetValue: number;
  nonMainExpenseValue: number;
  totalExpenseValue: number;
  fallbackRateCount: number;
}

export interface FinancialInsightComputationContext {
  scope: FinancialInsightScope;
  limit: number;
  includeTypes?: FinancialInsightType[];
  generatedAt: string;
  currency: string;
  periodKey: string;
  currentPeriod: {
    from: string;
    to: string;
  };
  previousPeriod: {
    from: string;
    to: string;
  };
  budgets: InsightBudgetProgress[];
  categorySpending: InsightCategorySpendComparison[];
  currentMonthIncome: number;
  currentMonthExpense: number;
  previousComparableIncome: number;
  previousComparableExpense: number;
  currentMonthLiabilityPayments: number;
  liquidAssetsValue: number | null;
  upcomingCommittedExpenses: number | null;
  avgMonthlyExpenses: number;
  goals: InsightGoalProgress[];
  inactiveAccounts: InsightInactiveAccountSummary;
  unusualTransactions: InsightUnusualTransactionCandidate[];
  netWorthMovement: InsightNetWorthMovement | null;
  portfolioAllocation: InsightPortfolioAllocation | null;
  multiCurrencyExposure: InsightMultiCurrencyExposure;
}

function buildSummary(insights: FinancialInsight[]): FinancialInsightSummary {
  const bySeverity: FinancialInsightSummary["bySeverity"] = {
    success: 0,
    info: 0,
    warning: 0,
    danger: 0,
  };
  const byType: FinancialInsightSummary["byType"] = {};

  for (const insight of insights) {
    bySeverity[insight.severity] += 1;
    byType[insight.type] = (byType[insight.type] ?? 0) + 1;
  }

  const highestSeverity =
    insights.length > 0
      ? insights
          .slice()
          .sort(
            (left, right) =>
              FINANCIAL_INSIGHT_SEVERITY_ORDER[right.severity] -
              FINANCIAL_INSIGHT_SEVERITY_ORDER[left.severity]
          )[0]?.severity ?? null
      : null;

  return {
    total: insights.length,
    highestSeverity,
    bySeverity,
    byType,
  };
}

function sortInsights(insights: FinancialInsight[]): FinancialInsight[] {
  return insights.sort((left, right) => {
    const severityDelta =
      FINANCIAL_INSIGHT_SEVERITY_ORDER[right.severity] -
      FINANCIAL_INSIGHT_SEVERITY_ORDER[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    const leftMaterial = Math.abs(left.value ?? 0);
    const rightMaterial = Math.abs(right.value ?? 0);
    if (rightMaterial !== leftMaterial) {
      return rightMaterial - leftMaterial;
    }

    return left.title.localeCompare(right.title);
  });
}

function maybeAddInsight(
  insights: FinancialInsight[],
  includeTypes: FinancialInsightType[] | undefined,
  insight: FinancialInsight | null
): void {
  if (!insight) {
    return;
  }

  if (includeTypes && !includeTypes.includes(insight.type)) {
    return;
  }

  insights.push(insight);
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function generateFinancialInsights(
  context: FinancialInsightComputationContext
): FinancialInsightResponse {
  const insights: FinancialInsight[] = [];

  const strongestBudgetWarning = context.budgets
    .filter((budget) => budget.percentage >= BUDGET_WARNING_THRESHOLD)
    .sort((left, right) => {
      if (right.percentage !== left.percentage) {
        return right.percentage - left.percentage;
      }
      return right.spent - left.spent;
    })[0];
  const suppressedCategoryIds = new Set<string>();

  if (strongestBudgetWarning) {
    if (strongestBudgetWarning.categoryId) {
      suppressedCategoryIds.add(strongestBudgetWarning.categoryId);
    }

    const severity: FinancialInsightSeverity =
      strongestBudgetWarning.percentage >= BUDGET_DANGER_THRESHOLD
        ? "danger"
        : "warning";
    const overBudget = strongestBudgetWarning.spent - strongestBudgetWarning.amount;
    const targetLabel =
      strongestBudgetWarning.categoryName ?? strongestBudgetWarning.name;

    maybeAddInsight(insights, context.includeTypes, {
      id: `${context.periodKey}:budget_warning:${strongestBudgetWarning.id}`,
      type: "budget_warning",
      severity,
      priority: severity === "danger" ? 96 : 88,
      title:
        severity === "danger"
          ? `${targetLabel} budget exceeded`
          : `${targetLabel} budget is nearly used`,
      description:
        severity === "danger"
          ? `${targetLabel} is at ${percent(strongestBudgetWarning.percentage)} of plan, overshooting by ${overBudget.toFixed(2)} in ${context.currency}.`
          : `${targetLabel} has reached ${percent(strongestBudgetWarning.percentage)} of its budget for the current period.`,
      value: strongestBudgetWarning.percentage,
      period: context.currentPeriod,
      actionLabel: "Review budgets",
      actionHref: "/dashboard/budgets",
      metadata: {
        valueKind: "percentage",
        budgetId: strongestBudgetWarning.id,
        categoryId: strongestBudgetWarning.categoryId,
      },
    });
  }

  const strongestSpike = context.categorySpending
    .filter(
      (category) =>
        category.previousAmount > 0 &&
        category.currentAmount > category.previousAmount
    )
    .map((category) => {
      const changeAmount = category.currentAmount - category.previousAmount;
      const changeRatio = changeAmount / category.previousAmount;
      return { ...category, changeAmount, changeRatio };
    })
    .filter(
      (category) =>
        category.changeRatio >= SPENDING_SPIKE_THRESHOLD &&
        category.changeAmount >=
          context.currentMonthExpense * SPENDING_MATERIAL_SHARE_THRESHOLD
    )
    .sort((left, right) => {
      if (right.changeRatio !== left.changeRatio) {
        return right.changeRatio - left.changeRatio;
      }
      return right.changeAmount - left.changeAmount;
    })[0];

  maybeAddInsight(
    insights,
    context.includeTypes,
    strongestSpike
      ? {
          id: `${context.periodKey}:spending_spike:${strongestSpike.categoryId ?? "uncategorized"}`,
          type: "spending_spike",
          severity: "warning",
          priority: 82,
          title: `${strongestSpike.categoryName} spending is rising`,
          description: `${strongestSpike.categoryName} is up ${percent(
            strongestSpike.changeRatio * 100
          )} compared with the same point last month.`,
          value: strongestSpike.changeRatio * 100,
          period: context.currentPeriod,
          actionLabel: "View reports",
          actionHref: "/dashboard/reports",
          metadata: {
            valueKind: "percentage",
            categoryId: strongestSpike.categoryId,
            changeAmount: strongestSpike.changeAmount,
          },
        }
      : null
  );

  const strongestReduction = context.categorySpending
    .filter(
      (category) =>
        category.previousAmount > 0 &&
        category.currentAmount < category.previousAmount
    )
    .map((category) => {
      const changeAmount = category.previousAmount - category.currentAmount;
      const changeRatio = changeAmount / category.previousAmount;
      return { ...category, changeAmount, changeRatio };
    })
    .filter(
      (category) =>
        category.changeRatio >= SPENDING_REDUCTION_THRESHOLD &&
        category.changeAmount >=
          context.currentMonthExpense * SPENDING_MATERIAL_SHARE_THRESHOLD
    )
    .sort((left, right) => {
      if (right.changeAmount !== left.changeAmount) {
        return right.changeAmount - left.changeAmount;
      }
      return right.changeRatio - left.changeRatio;
    })[0];

  maybeAddInsight(
    insights,
    context.includeTypes,
    strongestReduction
      ? {
          id: `${context.periodKey}:spending_reduction:${strongestReduction.categoryId ?? "uncategorized"}`,
          type: "spending_reduction",
          severity: "success",
          priority: 56,
          title: `${strongestReduction.categoryName} spending is down`,
          description: `${strongestReduction.categoryName} spending is ${percent(
            strongestReduction.changeRatio * 100
          )} lower than the same point last month.`,
          value: strongestReduction.changeAmount,
          currency: context.currency,
          period: context.currentPeriod,
          actionLabel: "View reports",
          actionHref: "/dashboard/reports",
          metadata: {
            valueKind: "currency",
            categoryId: strongestReduction.categoryId,
            changeRatio: strongestReduction.changeRatio * 100,
          },
        }
      : null
  );

  if (
    context.liquidAssetsValue !== null &&
    context.upcomingCommittedExpenses !== null &&
    context.liquidAssetsValue > 0
  ) {
    const coverageRatio =
      context.upcomingCommittedExpenses / context.liquidAssetsValue;
    const severity: FinancialInsightSeverity | null =
      coverageRatio >= CASH_FLOW_DANGER_THRESHOLD
        ? "danger"
        : coverageRatio >= CASH_FLOW_WARNING_THRESHOLD
          ? "warning"
          : null;

    maybeAddInsight(
      insights,
      context.includeTypes,
      severity
        ? {
            id: `${context.periodKey}:cash_flow_risk:aggregate`,
            type: "cash_flow_risk",
            severity,
            priority: severity === "danger" ? 92 : 76,
            title:
              severity === "danger"
                ? "Upcoming bills exceed liquid cash"
                : "Upcoming bills are pressuring cash",
            description:
              severity === "danger"
                ? `Expected recurring expenses in the next 30 days are higher than available BANK and CASH balances.`
                : `Expected recurring expenses in the next 30 days already consume ${percent(
                    coverageRatio * 100
                  )} of liquid cash.`,
            value:
              severity === "danger"
                ? context.upcomingCommittedExpenses - context.liquidAssetsValue
                : context.upcomingCommittedExpenses,
            currency: context.currency,
            period: context.currentPeriod,
            actionLabel: "Open calendar",
            actionHref: "/dashboard/calendar",
            metadata: {
              valueKind: "currency",
              coverageRatio: coverageRatio * 100,
            },
          }
        : null
    );
  }

  if (context.currentMonthIncome > 0) {
    const debtPressureRatio =
      context.currentMonthLiabilityPayments / context.currentMonthIncome;
    const severity: FinancialInsightSeverity | null =
      debtPressureRatio >= DEBT_PRESSURE_DANGER_THRESHOLD
        ? "danger"
        : debtPressureRatio >= DEBT_PRESSURE_WARNING_THRESHOLD
          ? "warning"
          : null;

    maybeAddInsight(
      insights,
      context.includeTypes,
      severity
        ? {
            id: `${context.periodKey}:debt_pressure:aggregate`,
            type: "debt_pressure",
            severity,
            priority: severity === "danger" ? 90 : 70,
            title: "Debt payments are taking a larger share of income",
            description: `Liability payments used ${percent(
              debtPressureRatio * 100
            )} of this month's income.`,
            value: debtPressureRatio * 100,
            period: context.currentPeriod,
            actionLabel: "Review liabilities",
            actionHref: "/dashboard/liabilities",
            metadata: {
              valueKind: "percentage",
            },
          }
        : null
    );
  }

  const behindGoal = context.goals
    .filter((goal) => goal.gapRatio > GOAL_PROGRESS_GAP_THRESHOLD)
    .sort((left, right) => right.gapRatio - left.gapRatio)[0];
  const onTrackGoal = context.goals
    .filter((goal) => goal.gapRatio <= GOAL_PROGRESS_GAP_THRESHOLD)
    .sort((left, right) => right.completionRatio - left.completionRatio)[0];

  maybeAddInsight(
    insights,
    context.includeTypes,
    behindGoal
      ? {
          id: `${context.periodKey}:goal_progress:${behindGoal.id}`,
          type: "goal_progress",
          severity: "warning",
          priority: 64,
          title: `${behindGoal.name} is behind schedule`,
          description: `${behindGoal.name} is trailing its expected progress by ${percent(
            behindGoal.gapRatio * 100
          )}.`,
          value: behindGoal.gapRatio * 100,
          actionLabel: "Open goals",
          actionHref: "/dashboard/goals",
          metadata: {
            valueKind: "percentage",
          },
        }
      : onTrackGoal
        ? {
            id: `${context.periodKey}:goal_progress:${onTrackGoal.id}`,
            type: "goal_progress",
            severity: "success",
            priority: 32,
            title: `${onTrackGoal.name} is on track`,
            description: `${onTrackGoal.name} is keeping pace with its target timeline.`,
            value: onTrackGoal.completionRatio * 100,
            actionLabel: "Open goals",
            actionHref: "/dashboard/goals",
            metadata: {
              valueKind: "percentage",
            },
          }
        : null
  );

  if (context.liquidAssetsValue !== null && context.avgMonthlyExpenses > 0) {
    const monthsCoverage = context.liquidAssetsValue / context.avgMonthlyExpenses;
    const severity: FinancialInsightSeverity | null =
      monthsCoverage < EMERGENCY_FUND_DANGER_MONTHS
        ? "danger"
        : monthsCoverage < EMERGENCY_FUND_WARNING_MONTHS
          ? "warning"
          : monthsCoverage >= EMERGENCY_FUND_SUCCESS_MONTHS
            ? "success"
            : null;

    maybeAddInsight(
      insights,
      context.includeTypes,
      severity
        ? {
            id: `${context.periodKey}:emergency_fund:aggregate`,
            type: "emergency_fund",
            severity,
            priority:
              severity === "danger" ? 89 : severity === "warning" ? 62 : 26,
            title:
              severity === "success"
                ? "Emergency fund coverage looks healthy"
                : "Emergency fund coverage is thin",
            description: `Liquid assets cover about ${monthsCoverage.toFixed(
              1
            )} month(s) of average expenses.`,
            value: monthsCoverage,
            actionLabel: "Review accounts",
            actionHref: "/dashboard/accounts",
            metadata: {
              valueKind: "months",
            },
          }
        : null
    );
  }

  if (context.netWorthMovement) {
    const movement = context.netWorthMovement;
    const severity: FinancialInsightSeverity | null =
      movement.changePercent <= NET_WORTH_DANGER_THRESHOLD
        ? "danger"
        : movement.changePercent <= NET_WORTH_WARNING_THRESHOLD
          ? "warning"
          : movement.changePercent >= NET_WORTH_SUCCESS_THRESHOLD
            ? "success"
            : null;

    maybeAddInsight(
      insights,
      context.includeTypes,
      severity
        ? {
            id: `${context.periodKey}:net_worth_movement:${movement.toDate}`,
            type: "net_worth_movement",
            severity,
            priority:
              severity === "danger" ? 87 : severity === "warning" ? 68 : 34,
            title:
              severity === "success"
                ? "Net worth moved up month over month"
                : "Net worth moved down month over month",
            description: `Net worth changed by ${percent(
              movement.changePercent * 100
            )} between the latest two same-currency snapshots.`,
            value: movement.changeAmount,
            currency: movement.currency,
            period: {
              from: movement.fromDate,
              to: movement.toDate,
            },
            actionLabel: "View net worth",
            actionHref: "/dashboard/reports",
            metadata: {
              valueKind: "currency",
              changePercent: movement.changePercent * 100,
            },
          }
        : null
    );
  }

  const inactive = context.inactiveAccounts;
  if (inactive.inactive180Count > 0 || inactive.inactive90Count > 0) {
    const severity: FinancialInsightSeverity =
      inactive.inactive180Count > 0 ? "warning" : "info";
    const count =
      severity === "warning" ? inactive.inactive180Count : inactive.inactive90Count;
    const label = count === 1 ? "account has" : "accounts have";

    maybeAddInsight(insights, context.includeTypes, {
      id: `${context.periodKey}:inactive_account:aggregate`,
      type: "inactive_account",
      severity,
      priority: severity === "warning" ? 42 : 24,
      title: "Some active accounts have gone quiet",
      description:
        severity === "warning"
          ? `${count} active ${label} seen no transaction activity in at least ${INACTIVE_ACCOUNT_WARNING_DAYS} days.`
          : `${count} active ${label} seen no transaction activity in at least ${INACTIVE_ACCOUNT_INFO_DAYS} days.`,
      value: count,
      actionLabel: "Review accounts",
      actionHref: "/dashboard/accounts",
      metadata: {
        valueKind: "count",
        oldestDays: inactive.oldestDays,
      },
    });
  }

  const dominantCategory = context.categorySpending
    .filter((category) => !suppressedCategoryIds.has(category.categoryId ?? ""))
    .sort((left, right) => right.currentShare - left.currentShare)[0];

  if (dominantCategory) {
    const severity: FinancialInsightSeverity | null =
      dominantCategory.currentShare >= HIGH_CATEGORY_SPENDING_WARNING_THRESHOLD
        ? "warning"
        : dominantCategory.currentShare >= HIGH_CATEGORY_SPENDING_INFO_THRESHOLD
          ? "info"
          : null;

    maybeAddInsight(
      insights,
      context.includeTypes,
      severity
        ? {
            id: `${context.periodKey}:high_category_spending:${dominantCategory.categoryId ?? "uncategorized"}`,
            type: "high_category_spending",
            severity,
            priority: severity === "warning" ? 58 : 20,
            title: `${dominantCategory.categoryName} is the biggest expense category`,
            description: `${dominantCategory.categoryName} represents ${percent(
              dominantCategory.currentShare * 100
            )} of current-month spending.`,
            value: dominantCategory.currentShare * 100,
            period: context.currentPeriod,
            actionLabel: "Review transactions",
            actionHref: "/dashboard/transactions",
            metadata: {
              valueKind: "percentage",
            },
          }
        : null
    );
  }

  const unusualTransaction = context.unusualTransactions
    .filter(
      (transaction) =>
        transaction.sampleCount >= UNUSUAL_TRANSACTION_MIN_SAMPLES &&
        transaction.multiplier >= UNUSUAL_TRANSACTION_MULTIPLIER
    )
    .sort((left, right) => {
      if (right.multiplier !== left.multiplier) {
        return right.multiplier - left.multiplier;
      }
      return right.amount - left.amount;
    })[0];

  maybeAddInsight(
    insights,
    context.includeTypes,
    unusualTransaction
      ? {
          id: `${context.periodKey}:unusual_transaction:${unusualTransaction.transactionId}`,
          type: "unusual_transaction",
          severity: "warning",
          priority: 60,
          title: `Large ${unusualTransaction.categoryName} transaction detected`,
          description: `This expense is ${unusualTransaction.multiplier.toFixed(
            1
          )}x the six-month category average.`,
          value: unusualTransaction.amount,
          currency: context.currency,
          period: context.currentPeriod,
          actionLabel: "Review transactions",
          actionHref: "/dashboard/transactions",
          metadata: {
            valueKind: "currency",
            sampleCount: unusualTransaction.sampleCount,
            baselineAverage: unusualTransaction.baselineAverage,
          },
        }
      : null
  );

  const currentNetFlow = context.currentMonthIncome - context.currentMonthExpense;
  const previousNetFlow =
    context.previousComparableIncome - context.previousComparableExpense;
  maybeAddInsight(
    insights,
    context.includeTypes,
    currentNetFlow > 0 && currentNetFlow > previousNetFlow
      ? {
          id: `${context.periodKey}:positive_monthly_progress:aggregate`,
          type: "positive_monthly_progress",
          severity: "success",
          priority: 30,
          title: "This month is ahead of last month",
          description: `Net flow is positive and running ahead of the same point last month.`,
          value: currentNetFlow,
          currency: context.currency,
          period: context.currentPeriod,
          actionLabel: "View reports",
          actionHref: "/dashboard/reports",
          metadata: {
            valueKind: "currency",
            previousNetFlow,
          },
        }
      : null
  );

  if (context.portfolioAllocation) {
    const allocation = context.portfolioAllocation;
    const concentrationSeverity =
      allocation.largestHoldingRatio > INVESTMENT_CONCENTRATION_THRESHOLD
        ? "warning"
        : allocation.investmentExposureRatio > INVESTMENT_EXPOSURE_THRESHOLD
          ? "info"
          : null;

    maybeAddInsight(
      insights,
      context.includeTypes,
      concentrationSeverity
        ? {
            id: `${context.periodKey}:investment_allocation:${allocation.largestHoldingSymbol ?? "portfolio"}`,
            type: "investment_allocation",
            severity: concentrationSeverity,
            priority: concentrationSeverity === "warning" ? 54 : 18,
            title:
              concentrationSeverity === "warning"
                ? "Portfolio concentration is high"
                : "Investment exposure is elevated",
            description:
              concentrationSeverity === "warning"
                ? `${allocation.largestHoldingSymbol ?? "One holding"} makes up ${percent(
                    allocation.largestHoldingRatio * 100
                  )} of the portfolio.`
                : `Investments account for ${percent(
                    allocation.investmentExposureRatio * 100
                  )} of tracked assets.`,
            value:
              concentrationSeverity === "warning"
                ? allocation.largestHoldingRatio * 100
                : allocation.investmentExposureRatio * 100,
            actionLabel: "Open investments",
            actionHref: "/dashboard/investments",
            metadata: {
              valueKind: "percentage",
            },
          }
        : null
    );
  }

  const assetShare =
    context.multiCurrencyExposure.totalTrackedAssetValue > 0
      ? context.multiCurrencyExposure.nonMainAssetValue /
        context.multiCurrencyExposure.totalTrackedAssetValue
      : 0;
  const spendingShare =
    context.multiCurrencyExposure.totalExpenseValue > 0
      ? context.multiCurrencyExposure.nonMainExpenseValue /
        context.multiCurrencyExposure.totalExpenseValue
      : 0;
  const hasShareImpact =
    assetShare >= MULTI_CURRENCY_SHARE_THRESHOLD ||
    spendingShare >= MULTI_CURRENCY_SHARE_THRESHOLD;
  const hasFxFallback = context.multiCurrencyExposure.fallbackRateCount > 0;

  maybeAddInsight(
    insights,
    context.includeTypes,
    hasShareImpact || hasFxFallback
      ? {
          id: `${context.periodKey}:multi_currency_impact:aggregate`,
          type: "multi_currency_impact",
          severity: hasShareImpact ? "warning" : "info",
          priority: hasShareImpact ? 50 : 16,
          title: "Multi-currency exposure is affecting the picture",
          description: hasShareImpact
            ? `Non-${context.currency} balances or spending account for a meaningful share of this month's view.`
            : `Some insight values relied on cached exchange rates because live FX was unavailable.`,
          value: Math.max(assetShare, spendingShare) * 100,
          actionLabel: "Review accounts",
          actionHref: "/dashboard/accounts",
          metadata: {
            valueKind: "percentage",
            fallbackRateCount: context.multiCurrencyExposure.fallbackRateCount,
          },
        }
      : null
  );

  const sortedInsights = sortInsights(insights).slice(0, context.limit);

  return {
    insights: sortedInsights,
    summary: buildSummary(sortedInsights),
    generatedAt: context.generatedAt,
    currency: context.currency,
  };
}
