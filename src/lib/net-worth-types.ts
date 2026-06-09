export interface NetWorthPeriod {
  year: number;
  month: number;
}

export type NetWorthSnapshotTrigger = "cron" | "manual" | "manual_backfill";
export type NetWorthCalculationMode =
  | "live_snapshot"
  | "current_state_at_run_time";

export interface NetWorthExchangeRateMetadata {
  pair: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: "identity" | "live" | "cache";
  fetchedAt: string;
}

export interface NetWorthSnapshotWarning {
  code:
    | "missing_quote_fallback_cost_basis"
    | "missing_fx_rate"
    | "missing_personal_asset_valuation";
  message: string;
  assetId?: string;
  symbol?: string;
  currencyPair?: string;
}

export interface NetWorthAccountBreakdownItem {
  accountId: string;
  type: string;
  currency: string;
  rawBalance: number;
  convertedBalance: number;
  bucket:
    | "cash"
    | "bank"
    | "investment_cash"
    | "receivable"
    | "loan_liability"
    | "credit_card_liability"
    | "liability_overpay";
}

export interface NetWorthInvestmentBreakdownItem {
  assetId: string;
  symbol: string;
  currency: string;
  quantity: number;
  avgBuyPrice: number;
  unitType: string;
  valuationCurrency: string;
  quoteCurrency?: string;
  quotePrice?: number;
  quoteSource: "live" | "cost_basis";
  convertedValue: number;
}

export interface NetWorthPersonalAssetBreakdownItem {
  assetId: string;
  currency: string;
  rawValue: number;
  convertedValue: number;
  valuedAt: string;
  source: "valuation_history" | "current_value";
}

export interface NetWorthSourceBreakdown {
  trigger: NetWorthSnapshotTrigger;
  calculationMode: NetWorthCalculationMode;
  period: NetWorthPeriod;
  snapshotDate: string;
  accounts: NetWorthAccountBreakdownItem[];
  investmentHoldings: NetWorthInvestmentBreakdownItem[];
  personalAssets: NetWorthPersonalAssetBreakdownItem[];
  warnings: NetWorthSnapshotWarning[];
  hasFallbacks: boolean;
  fallbackCount: number;
}

export interface NetWorthSnapshotListItem {
  id: string;
  periodYear: number;
  periodMonth: number;
  date: string;
  snapshotDate: string;
  currency: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  cashTotal: number;
  bankTotal: number;
  investmentCashTotal: number;
  investmentHoldingTotal: number;
  investmentTotal: number;
  personalAssetTotal: number;
  receivableTotal: number;
  loanLiabilityTotal: number;
  creditCardTotal: number;
  liabilityOverpayTotal: number;
  hasFallbacks: boolean;
  fallbackCount: number;
  calculationVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorthSnapshotDetail extends NetWorthSnapshotListItem {
  sourceBreakdownJson: NetWorthSourceBreakdown | null;
  exchangeRateJson: NetWorthExchangeRateMetadata[] | null;
}

export interface NetWorthSnapshotSummary {
  latestSnapshot: NetWorthSnapshotListItem | null;
  previousSnapshot: NetWorthSnapshotListItem | null;
  netWorthChange: number | null;
  netWorthChangePercent: number | null;
  highNetWorth: number | null;
  lowNetWorth: number | null;
  count: number;
  currency: string | null;
  hasCurrencyMismatch: boolean;
}

export interface NetWorthTrendPoint {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  periodYear: number;
  periodMonth: number;
  snapshotDate: string;
  currency: string;
  hasFallbacks: boolean;
}
