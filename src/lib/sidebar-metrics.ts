export interface SidebarMetricsSnapshot {
  retirementTarget: number | null;
  retirementProgress: number | null;
  retirementLeftPercent: number | null;
  retirementAvailable: boolean;
  monthlyBudget: number | null;
  currentMonthExpenses: number | null;
  monthlyBudgetLeftPercent: number | null;
  monthlyBudgetAvailable: boolean;
  displayCurrency: string;
}

export const sidebarMetricsKeys = {
  all: ["sidebarMetrics"] as const,
  currentMonth: (year: number, month: number) =>
    [...sidebarMetricsKeys.all, "currentMonth", { year, month }] as const,
};

export function clampSidebarPercentage(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}
