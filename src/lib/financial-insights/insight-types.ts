export type FinancialInsightSeverity = "success" | "info" | "warning" | "danger";

export type FinancialInsightType =
  | "budget_warning"
  | "spending_spike"
  | "spending_reduction"
  | "cash_flow_risk"
  | "debt_pressure"
  | "debt_payoff_progress"
  | "goal_progress"
  | "emergency_fund"
  | "net_worth_movement"
  | "inactive_account"
  | "high_category_spending"
  | "unusual_transaction"
  | "positive_monthly_progress"
  | "investment_allocation"
  | "multi_currency_impact";

export type FinancialInsightScope = "dashboard";

export interface FinancialInsightPeriod {
  from: string;
  to: string;
}

export interface FinancialInsight {
  id: string;
  type: FinancialInsightType;
  severity: FinancialInsightSeverity;
  priority: number;
  title: string;
  description: string;
  value?: number;
  currency?: string;
  period?: FinancialInsightPeriod;
  actionLabel?: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
}

export interface FinancialInsightSummary {
  total: number;
  highestSeverity: FinancialInsightSeverity | null;
  bySeverity: Record<FinancialInsightSeverity, number>;
  byType: Partial<Record<FinancialInsightType, number>>;
}

export interface FinancialInsightResponse {
  insights: FinancialInsight[];
  summary: FinancialInsightSummary;
  generatedAt: string;
  currency: string;
}

export const FINANCIAL_INSIGHT_SEVERITY_ORDER: Record<
  FinancialInsightSeverity,
  number
> = {
  danger: 4,
  warning: 3,
  info: 2,
  success: 1,
};
