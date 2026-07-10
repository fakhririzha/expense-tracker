import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDashboardMoneyPlan } from "@/lib/dashboard-money-plan";
import type {
  CashFlowForecastResult,
  DailyForecastBalance,
  ForecastEvent,
} from "@/lib/forecasting/forecast-types";

const now = new Date("2026-07-10T12:00:00.000Z");
const periodStart = new Date("2026-07-01T00:00:00.000Z");
const periodEnd = new Date("2026-07-31T23:59:59.999Z");

function createEvent(
  overrides: Partial<ForecastEvent> & Pick<ForecastEvent, "id" | "date" | "type">
): ForecastEvent {
  return {
    label: overrides.id,
    amount: 100,
    currency: "IDR",
    amountInMainCurrency: 100,
    direction: "outflow",
    confidence: "high",
    source: "recurring_transaction",
    ...overrides,
    dateKey: overrides.date.toISOString().slice(0, 10),
  };
}

function createDailyBalance(
  date: Date,
  endingBalance: number
): DailyForecastBalance {
  return {
    date,
    dateKey: date.toISOString().slice(0, 10),
    startingBalance: endingBalance,
    inflow: 0,
    outflow: 0,
    endingBalance,
    events: [],
  };
}

function createForecast(
  events: ForecastEvent[] = [],
  dailyBalances: DailyForecastBalance[] = []
): CashFlowForecastResult {
  return {
    startDate: new Date("2026-07-10T00:00:00.000Z"),
    endDate: new Date("2026-08-08T23:59:59.999Z"),
    horizonDays: 30,
    currency: "IDR",
    startingLiquidBalance: 1000,
    endingProjectedBalance: 1000,
    lowestProjectedBalance: 1000,
    lowestProjectedBalanceDate: dailyBalances[0]?.date ?? null,
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
    status: "safe",
    dailyBalances,
    events,
    assumptions: [],
    warnings: [],
  };
}

function buildPlan(
  overrides: Partial<Parameters<typeof buildDashboardMoneyPlan>[0]> = {}
) {
  return buildDashboardMoneyPlan({
    now,
    periodStart,
    periodEnd,
    currency: "IDR",
    spendingLimit: 1000,
    spentToDate: 200,
    forecast: createForecast([], [
      createDailyBalance(new Date("2026-07-10T00:00:00.000Z"), 1000),
    ]),
    actionItems: [],
    ...overrides,
  });
}

describe("buildDashboardMoneyPlan", () => {
  it("subtracts only future known commitments from the overall limit", () => {
    const plan = buildPlan({
      forecast: createForecast([
        createEvent({
          id: "posted-today",
          date: new Date("2026-07-10T00:00:00.000Z"),
          type: "expense",
          source: "transaction",
          amountInMainCurrency: 400,
        }),
        createEvent({
          id: "future-expense",
          date: new Date("2026-07-12T00:00:00.000Z"),
          type: "expense",
          source: "transaction",
          amountInMainCurrency: 200,
        }),
        createEvent({
          id: "recurring-today",
          date: new Date("2026-07-10T00:00:00.000Z"),
          type: "recurring_expense",
          amountInMainCurrency: 100,
        }),
        createEvent({
          id: "transfer",
          date: new Date("2026-07-11T00:00:00.000Z"),
          type: "transfer_out",
          amountInMainCurrency: 500,
        }),
        createEvent({
          id: "low-confidence",
          date: new Date("2026-07-11T00:00:00.000Z"),
          type: "expense",
          confidence: "low",
          amountInMainCurrency: 500,
        }),
      ]),
    });

    assert.equal(plan.knownCommittedOutflows, 300);
    assert.equal(plan.remainingAmount, 500);
    assert.deepEqual(
      plan.upcomingCommitments.map((commitment) => commitment.id),
      ["recurring-today", "future-expense"]
    );
  });

  it("marks the calculation partial when a commitment cannot be converted", () => {
    const plan = buildPlan({
      forecast: createForecast([
        createEvent({
          id: "known",
          date: new Date("2026-07-12T00:00:00.000Z"),
          type: "subscription",
          amountInMainCurrency: 100,
        }),
        createEvent({
          id: "missing-fx",
          date: new Date("2026-07-13T00:00:00.000Z"),
          type: "subscription",
          amountInMainCurrency: null,
        }),
      ]),
    });

    assert.equal(plan.knownCommittedOutflows, 100);
    assert.equal(plan.excludedUnknownOutflowCount, 1);
    assert.equal(plan.remainingAmount, 700);
    assert.equal(plan.isPartial, true);
  });

  it("prioritizes an over-plan status over a projected cash shortfall", () => {
    const plan = buildPlan({
      spendingLimit: 500,
      spentToDate: 600,
      forecast: createForecast([], [
        createDailyBalance(new Date("2026-07-20T00:00:00.000Z"), -100),
      ]),
    });

    assert.equal(plan.status, "over_plan");
    assert.equal(plan.forecastMinimumBalance, -100);
  });

  it("surfaces cash risk even when no overall limit is configured", () => {
    const plan = buildPlan({
      spendingLimit: null,
      forecast: createForecast([], [
        createDailyBalance(new Date("2026-07-20T00:00:00.000Z"), -100),
      ]),
    });

    assert.equal(plan.remainingAmount, null);
    assert.equal(plan.status, "cash_risk");
  });

  it("keeps an empty configured plan trustworthy when there are no commitments", () => {
    const plan = buildPlan({
      spendingLimit: null,
      spentToDate: 0,
      forecast: createForecast([], [
        createDailyBalance(new Date("2026-07-10T00:00:00.000Z"), 1000),
      ]),
    });

    assert.equal(plan.knownCommittedOutflows, 0);
    assert.equal(plan.upcomingCommitments.length, 0);
    assert.equal(plan.status, "unconfigured");
    assert.equal(plan.isPartial, false);
  });

  it("shows next-month commitments inside the seven-day view without subtracting them", () => {
    const lateMonthNow = new Date("2026-07-29T12:00:00.000Z");
    const plan = buildPlan({
      now: lateMonthNow,
      forecast: createForecast([
        createEvent({
          id: "next-month-subscription",
          date: new Date("2026-08-02T00:00:00.000Z"),
          type: "subscription",
          amountInMainCurrency: 150,
        }),
      ]),
    });

    assert.equal(plan.knownCommittedOutflows, 0);
    assert.equal(plan.remainingAmount, 800);
    assert.deepEqual(
      plan.upcomingCommitments.map((commitment) => commitment.id),
      ["next-month-subscription"]
    );
  });
});
