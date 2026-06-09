export const FORECAST_HORIZON_DAYS = [30, 60, 90] as const;
export const FORECAST_VARIABLE_SPENDING_MODES = [
  "none",
  "historical",
  "budget",
] as const;

export type ForecastHorizonDays = (typeof FORECAST_HORIZON_DAYS)[number];
export type ForecastVariableSpendingMode =
  (typeof FORECAST_VARIABLE_SPENDING_MODES)[number];

export type ForecastEventType =
  | "income"
  | "expense"
  | "recurring_income"
  | "recurring_expense"
  | "subscription"
  | "liability_payment"
  | "estimated_spending"
  | "receivable_repayment"
  | "transfer_in"
  | "transfer_out";

export type ForecastEventDirection = "inflow" | "outflow";
export type ForecastEventConfidence = "high" | "medium" | "low";
export type ForecastEventSource =
  | "transaction"
  | "recurring_transaction"
  | "subscription"
  | "budget"
  | "historical_average"
  | "liability"
  | "receivable";

export type CashFlowForecastStatus = "safe" | "watch" | "risky" | "negative";

export type ForecastConversionSource =
  | "identity"
  | "live"
  | "cached"
  | "stored_transaction_rate"
  | "missing";

export interface ForecastEvent {
  id: string;
  date: Date;
  dateKey: string;
  type: ForecastEventType;
  label: string;
  amount: number;
  currency: string;
  amountInMainCurrency: number | null;
  direction: ForecastEventDirection;
  confidence: ForecastEventConfidence;
  source: ForecastEventSource;
  sourceId?: string;
  categoryId?: string | null;
  accountId?: string | null;
  conversionRate?: number | null;
  conversionSource?: ForecastConversionSource;
  excludedFromProjection?: boolean;
}

export interface DailyForecastBalance {
  date: Date;
  dateKey: string;
  startingBalance: number;
  inflow: number;
  outflow: number;
  endingBalance: number;
  events: ForecastEvent[];
}

export interface ForecastAssumption {
  code: string;
  label: string;
  detail: string;
}

export interface ForecastWarning {
  code: string;
  severity: "info" | "warning" | "danger";
  message: string;
  date?: Date;
  sourceId?: string;
}

export interface CashFlowForecastResult {
  startDate: Date;
  endDate: Date;
  horizonDays: ForecastHorizonDays;
  currency: string;
  startingLiquidBalance: number;
  endingProjectedBalance: number;
  lowestProjectedBalance: number;
  lowestProjectedBalanceDate: Date | null;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  status: CashFlowForecastStatus;
  dailyBalances: DailyForecastBalance[];
  events: ForecastEvent[];
  assumptions: ForecastAssumption[];
  warnings: ForecastWarning[];
}

export interface GetCashFlowForecastInput {
  horizonDays: ForecastHorizonDays;
  accountIds?: string[];
  includeFutureTransactions?: boolean;
  includeRecurringTransactions?: boolean;
  includeSubscriptions?: boolean;
  variableSpendingMode?: ForecastVariableSpendingMode;
}

export interface ForecastRiskSummary {
  status: CashFlowForecastStatus;
  warnings: ForecastWarning[];
  monthlyOutflowBasis: number;
}
