import { addDays, endOfDay, startOfDay } from "date-fns";

import type { FinancialInsight } from "@/lib/financial-insights/insight-types";
import { roundMoney } from "@/lib/forecasting/forecast-periods";
import type {
  CashFlowForecastResult,
  ForecastEvent,
  ForecastEventType,
} from "@/lib/forecasting/forecast-types";

export type DashboardMoneyPlanStatus =
  | "on_track"
  | "watch"
  | "over_plan"
  | "cash_risk"
  | "unconfigured";

export interface DashboardMoneyPlanCommitment {
  id: string;
  date: Date;
  label: string;
  type: ForecastEventType;
  amount: number;
  currency: string;
  amountInMainCurrency: number | null;
}

export interface DashboardMoneyPlan {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  currency: string;
  spendingLimit: number | null;
  spentToDate: number | null;
  knownCommittedOutflows: number | null;
  excludedUnknownOutflowCount: number;
  remainingAmount: number | null;
  isPartial: boolean;
  forecastAvailable: boolean;
  forecastMinimumBalance: number | null;
  forecastMinimumBalanceDate: Date | null;
  status: DashboardMoneyPlanStatus;
  upcomingCommitments: DashboardMoneyPlanCommitment[];
  actionItems: FinancialInsight[];
}

interface BuildDashboardMoneyPlanInput {
  now: Date;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  spendingLimit: number | null;
  spentToDate: number | null;
  forecast: CashFlowForecastResult | null;
  actionItems: FinancialInsight[];
}

const MONEY_PLAN_EVENT_TYPES = new Set<ForecastEventType>([
  "expense",
  "recurring_expense",
  "subscription",
  "liability_payment",
]);

function isKnownCommitmentCandidate(
  event: ForecastEvent,
  now: Date,
  periodEnd: Date
): boolean {
  if (
    event.direction !== "outflow" ||
    event.excludedFromProjection ||
    event.confidence === "low" ||
    !MONEY_PLAN_EVENT_TYPES.has(event.type) ||
    event.date > periodEnd
  ) {
    return false;
  }

  // Posted transactions dated today are already included in spent-to-date.
  // Recurring and subscription events dated today remain commitments unless
  // the forecast deduplication found their posted transaction.
  return event.source !== "transaction" || event.date > now;
}

function getForecastMinimum(
  forecast: CashFlowForecastResult | null,
  periodEnd: Date
): { balance: number | null; date: Date | null } {
  const periodBalances =
    forecast?.dailyBalances.filter((day) => day.date <= periodEnd) ?? [];

  if (periodBalances.length === 0) {
    return { balance: null, date: null };
  }

  let minimum = periodBalances[0];
  for (const day of periodBalances.slice(1)) {
    if (day.endingBalance < minimum.endingBalance) {
      minimum = day;
    }
  }

  return {
    balance: roundMoney(minimum.endingBalance),
    date: minimum.date,
  };
}

function getMoneyPlanStatus(input: {
  spendingLimit: number | null;
  remainingAmount: number | null;
  forecastMinimumBalance: number | null;
}): DashboardMoneyPlanStatus {
  if (input.remainingAmount !== null && input.remainingAmount < 0) {
    return "over_plan";
  }

  if (
    input.forecastMinimumBalance !== null &&
    input.forecastMinimumBalance < 0
  ) {
    return "cash_risk";
  }

  if (
    input.spendingLimit !== null &&
    input.remainingAmount !== null &&
    input.remainingAmount / input.spendingLimit <= 0.2
  ) {
    return "watch";
  }

  if (input.spendingLimit === null) {
    return "unconfigured";
  }

  return "on_track";
}

export function buildDashboardMoneyPlan(
  input: BuildDashboardMoneyPlanInput
): DashboardMoneyPlan {
  const hasTrackedCash =
    input.forecast !== null &&
    !input.forecast.warnings.some(
      (warning) => warning.code === "no_liquid_accounts"
    );
  const forecastEvents = hasTrackedCash && input.forecast
    ? [...input.forecast.events].sort(
        (left, right) => left.date.getTime() - right.date.getTime()
      )
    : [];
  const commitmentCandidates = forecastEvents.filter((event) =>
    isKnownCommitmentCandidate(event, input.now, input.periodEnd)
  );
  const excludedUnknownOutflowCount = commitmentCandidates.filter(
    (event) => event.amountInMainCurrency === null
  ).length;
  const knownCommittedOutflows = hasTrackedCash
    ? roundMoney(
        commitmentCandidates.reduce(
          (sum, event) => sum + (event.amountInMainCurrency ?? 0),
          0
        )
      )
    : null;
  const normalizedSpendingLimit =
    input.spendingLimit !== null && input.spendingLimit > 0
      ? input.spendingLimit
      : null;
  const remainingAmount =
    normalizedSpendingLimit !== null &&
    input.spentToDate !== null &&
    knownCommittedOutflows !== null
      ? roundMoney(
          normalizedSpendingLimit -
            input.spentToDate -
            knownCommittedOutflows
        )
      : null;
  const forecastMinimum = hasTrackedCash
    ? getForecastMinimum(input.forecast, input.periodEnd)
    : { balance: null, date: null };
  const upcomingEnd = endOfDay(addDays(startOfDay(input.now), 6));
  const upcomingCommitments = forecastEvents
    .filter((event) =>
      isKnownCommitmentCandidate(event, input.now, upcomingEnd)
    )
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      date: event.date,
      label: event.label,
      type: event.type,
      amount: event.amount,
      currency: event.currency,
      amountInMainCurrency: event.amountInMainCurrency,
    }));

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    generatedAt: input.now,
    currency: input.currency,
    spendingLimit: normalizedSpendingLimit,
    spentToDate: input.spentToDate,
    knownCommittedOutflows,
    excludedUnknownOutflowCount,
    remainingAmount,
    isPartial:
      input.spentToDate === null ||
      !hasTrackedCash ||
      excludedUnknownOutflowCount > 0,
    forecastAvailable: hasTrackedCash,
    forecastMinimumBalance: forecastMinimum.balance,
    forecastMinimumBalanceDate: forecastMinimum.date,
    status: getMoneyPlanStatus({
      spendingLimit: normalizedSpendingLimit,
      remainingAmount,
      forecastMinimumBalance: forecastMinimum.balance,
    }),
    upcomingCommitments,
    actionItems: input.actionItems.slice(0, 3),
  };
}
