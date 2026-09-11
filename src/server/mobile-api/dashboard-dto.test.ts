import assert from "node:assert/strict";
import test from "node:test";

import { createMobileDashboardResponse } from "./dashboard-dto";

const metrics = {
  displayCurrency: "IDR",
  totalAssets: 150,
  totalDebt: 50,
  netWorth: 100,
  totalCash: 20,
  totalSavings: 80,
  investmentValue: 50,
  avgMonthlyIncome: 30,
  avgMonthlyExpenses: 10,
  savingsRate: 66.67,
  monthsOfRunway: 10,
  healthTier: "A" as const,
  healthTierInfo: {
    tier: "A" as const,
    label: "Great",
    description: "Debt-to-Wealth ratio < 30%",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  debtToWealthRatio: 25,
  valuationError: null,
  currencyConversionError: null,
};

test("mobile dashboard returns position metrics when FX is reliable", () => {
  const response = createMobileDashboardResponse(metrics);

  assert.equal(response.position.netWorth, 100);
  assert.equal(response.position.liquidFunds, 100);
  assert.equal(response.cashFlow.monthsOfRunway, 10);
  assert.equal(response.health?.tier, "A");
  assert.equal(response.valuationWarning, null);
});

test("mobile dashboard withholds mixed-currency metrics when FX is missing", () => {
  const response = createMobileDashboardResponse({
    ...metrics,
    currencyConversionError: "Currency conversion is unavailable for USD.",
  });

  assert.equal(response.position.totalAssets, null);
  assert.equal(response.position.totalDebt, null);
  assert.equal(response.position.netWorth, null);
  assert.equal(response.position.liquidFunds, null);
  assert.equal(response.cashFlow.monthsOfRunway, null);
  assert.equal(response.health, null);
  assert.match(response.valuationWarning ?? "", /USD/);
});
