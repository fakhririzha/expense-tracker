// Types and constants for executive metrics - no "use server" directive
// These can be imported by both client and server components

export type HealthTier = "S" | "A" | "B" | "C" | "F";

export interface HealthTierInfo {
  tier: HealthTier;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

export const HEALTH_TIERS: Record<HealthTier, HealthTierInfo> = {
  S: {
    tier: "S",
    label: "Excellent",
    description: "Debt < 10% & 6+ months emergency fund",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  A: {
    tier: "A",
    label: "Great",
    description: "Debt-to-Wealth ratio < 30%",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  B: {
    tier: "B",
    label: "Good",
    description: "Debt-to-Wealth ratio < 60%",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  C: {
    tier: "C",
    label: "Fair",
    description: "Debt-to-Wealth ratio < 100%",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  F: {
    tier: "F",
    label: "Critical",
    description: "Negative net worth",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
};

export interface ExecutiveMetrics {
  // Net Worth Components
  totalCash: number;
  totalSavings: number;
  totalInvestmentCash: number;
  totalInvestments: number | null;
  totalPersonalAssets: number;
  totalLoanReceivables: number;
  totalDebt: number;
  totalAssets: number | null;
  netWorth: number | null;

  // Ratios
  debtToWealthRatio: number | null;
  liquidityRatio: number; // Liquid assets / monthly expenses

  // Health Assessment
  healthTier: HealthTier | null;
  healthTierInfo: HealthTierInfo | null;

  // Monthly Metrics
  avgMonthlyExpenses: number;
  avgMonthlyIncome: number;
  savingsRate: number;
  monthsOfRunway: number;

  // Investment Performance
  investmentValue: number | null;
  investmentCost: number | null;
  totalUnrealizedPnL: number | null;
  totalRealizedPnL: number | null;
  portfolioSummary: {
    totalValue: number;
    totalCost: number;
    totalUnrealizedPnL: number;
    totalUnrealizedPnLPercent: number;
    totalDayChange: number;
    totalDayChangePercent: number;
    totalRealizedPnL: number;
    assetCount: number;
  } | null;
  valuationError: string | null;

  // Retirement Progress
  retirementTarget: number | null;
  retirementProgress: number | null;
  monthlyBudget: number | null;

  // Currency
  displayCurrency: string;
}
