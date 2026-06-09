import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Briefcase,
  CalendarClock,
  CandlestickChart,
  CreditCard,
  Landmark,
  PiggyBank,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { type FinancialInsightType } from "@/lib/financial-insights/insight-types";

const ICON_MAP: Record<FinancialInsightType, typeof AlertTriangle> = {
  budget_warning: BadgeDollarSign,
  spending_spike: TrendingUp,
  spending_reduction: TrendingDown,
  cash_flow_risk: CalendarClock,
  debt_pressure: CreditCard,
  goal_progress: Target,
  emergency_fund: PiggyBank,
  net_worth_movement: Wallet,
  inactive_account: Landmark,
  high_category_spending: ArrowUpCircle,
  unusual_transaction: AlertTriangle,
  positive_monthly_progress: ArrowDownCircle,
  investment_allocation: CandlestickChart,
  multi_currency_impact: Briefcase,
};

export function FinancialInsightIcon({
  type,
  className,
}: {
  type: FinancialInsightType;
  className?: string;
}) {
  const Icon = ICON_MAP[type] ?? AlertTriangle;

  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted/60",
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
