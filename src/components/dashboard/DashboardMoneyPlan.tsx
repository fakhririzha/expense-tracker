import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { FinancialInsightIcon } from "@/components/insights/FinancialInsightIcon";
import { FinancialInsightSeverityBadge } from "@/components/insights/FinancialInsightSeverityBadge";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  DashboardMoneyPlan as DashboardMoneyPlanData,
  DashboardMoneyPlanStatus,
} from "@/lib/dashboard-money-plan";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const STATUS_PRESENTATION: Record<
  DashboardMoneyPlanStatus,
  { label: string; className: string; cardClassName: string }
> = {
  on_track: {
    label: "On track",
    className: "border-emerald-400 bg-emerald-100 text-emerald-950",
    cardClassName: "bg-emerald-50",
  },
  watch: {
    label: "Watch",
    className: "border-amber-400 bg-amber-100 text-amber-950",
    cardClassName: "bg-amber-50",
  },
  over_plan: {
    label: "Over plan",
    className: "border-red-400 bg-red-100 text-red-950",
    cardClassName: "bg-red-50",
  },
  cash_risk: {
    label: "Cash risk",
    className: "border-red-400 bg-red-100 text-red-950",
    cardClassName: "bg-red-50",
  },
  unconfigured: {
    label: "Limit not set",
    className: "border-black bg-secondary text-secondary-foreground",
    cardClassName: "bg-secondary/15",
  },
};

function getCommitmentLabel(type: DashboardMoneyPlanData["upcomingCommitments"][number]["type"]) {
  switch (type) {
    case "subscription":
      return "Subscription";
    case "recurring_expense":
      return "Recurring expense";
    case "liability_payment":
      return "Liability payment";
    default:
      return "Scheduled expense";
  }
}

function MoneyPlanHero({ plan }: { plan: DashboardMoneyPlanData }) {
  const presentation = STATUS_PRESENTATION[plan.status];
  const hasLimit = plan.spendingLimit !== null;
  const hasRemaining = plan.remainingAmount !== null;
  const isOverPlan = hasRemaining && plan.remainingAmount! < 0;
  const plannedAmount =
    plan.spentToDate !== null && plan.knownCommittedOutflows !== null
      ? plan.spentToDate + plan.knownCommittedOutflows
      : null;
  const percentagePlanned =
    plan.spendingLimit !== null && plannedAmount !== null
      ? Math.min((plannedAmount / plan.spendingLimit) * 100, 100)
      : null;
  const periodEndLabel = formatDate(plan.periodEnd, {
    month: "short",
    day: "numeric",
  });

  const headline = !hasLimit
    ? "Set your overall monthly spending limit"
    : !hasRemaining
      ? `Spending room through ${periodEndLabel}`
      : isOverPlan
        ? `Over plan through ${periodEndLabel}`
        : plan.isPartial
          ? `Known spending room through ${periodEndLabel}`
          : `Flexible spending left through ${periodEndLabel}`;

  return (
    <Card className={cn("overflow-hidden", presentation.cardClassName)}>
      <CardHeader className="gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={presentation.className}>
              {presentation.label}
            </Badge>
            {plan.isPartial && hasLimit ? (
              <Badge variant="outline" className="border-black bg-white">
                Partial estimate
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-xl font-black font-heading md:text-2xl">
            {headline}
          </CardTitle>
          <CardDescription className="font-medium text-foreground/70">
            Overall limit − spent to date − known upcoming commitments
          </CardDescription>
        </div>
        <div className="md:justify-self-end">
          <AddTransactionDialog />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <p
            className={cn(
              "text-4xl font-black tracking-tight md:text-5xl",
              isOverPlan && "text-destructive"
            )}
          >
            {!hasLimit
              ? "Not set"
              : hasRemaining
                ? formatCurrency(
                    isOverPlan
                      ? Math.abs(plan.remainingAmount!)
                      : plan.remainingAmount!,
                    plan.currency
                  )
                : "Unavailable"}
          </p>
          {isOverPlan ? (
            <p className="mt-1 font-bold text-destructive">
              above your overall monthly spending limit
            </p>
          ) : null}
        </div>

        {percentagePlanned !== null ? (
          <div className="space-y-2">
            <Progress value={percentagePlanned} className="h-3 bg-white/70" />
            <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
              <span>{percentagePlanned.toFixed(1)}% planned or spent</span>
              <span>
                Limit {formatCurrency(plan.spendingLimit!, plan.currency)}
              </span>
            </div>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/profile">Set spending limit</Link>
          </Button>
        )}

        <details className="group border-t-2 border-black/15 pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black uppercase tracking-wider">
            View calculation
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="font-bold text-muted-foreground">Overall limit</p>
              <p className="font-black">
                {plan.spendingLimit !== null
                  ? formatCurrency(plan.spendingLimit, plan.currency)
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">Spent to date</p>
              <p className="font-black">
                {plan.spentToDate !== null
                  ? formatCurrency(plan.spentToDate, plan.currency)
                  : "Unavailable"}
              </p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">
                Known commitments
              </p>
              <p className="font-black">
                {plan.knownCommittedOutflows !== null
                  ? formatCurrency(plan.knownCommittedOutflows, plan.currency)
                  : "Unavailable"}
              </p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">Spending room</p>
              <p className="font-black">
                {plan.remainingAmount !== null
                  ? formatCurrency(plan.remainingAmount, plan.currency)
                  : "Unavailable"}
              </p>
            </div>
          </div>

          {plan.excludedUnknownOutflowCount > 0 ? (
            <p className="mt-4 flex items-start gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {plan.excludedUnknownOutflowCount} commitment(s) are excluded from
              this estimate because a currency conversion is unavailable.
            </p>
          ) : !plan.forecastAvailable ? (
            <p className="mt-4 flex items-start gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Add an active bank or cash account to include upcoming commitments
              and cash projections.
            </p>
          ) : null}
        </details>
      </CardContent>
    </Card>
  );
}

function MoneyPlanActions({ plan }: { plan: DashboardMoneyPlanData }) {
  return (
    <Card>
      <CardHeader className="md:grid-cols-[1fr_auto]">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl font-black font-heading">
            <Sparkles className="h-5 w-5" />
            What needs attention
          </CardTitle>
          <CardDescription className="mt-1">
            Your three highest-priority financial signals.
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/insights">View all insights</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {plan.actionItems.length === 0 ? (
          <div className="flex items-start gap-3 border-2 border-emerald-300 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-black">Nothing urgent right now</p>
              <p className="text-sm text-muted-foreground">
                FinHealth will surface budget, cash-flow, debt, and goal signals
                here when they need attention.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y-2 divide-black/10">
            {plan.actionItems.map((insight) => (
              <div key={insight.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <FinancialInsightIcon type={insight.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{insight.title}</h3>
                    <FinancialInsightSeverityBadge severity={insight.severity} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {insight.description}
                  </p>
                  {insight.actionHref && insight.actionLabel ? (
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link href={insight.actionHref}>
                        {insight.actionLabel}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingMoney({ plan }: { plan: DashboardMoneyPlanData }) {
  const minimumIsNegative =
    plan.forecastMinimumBalance !== null && plan.forecastMinimumBalance < 0;

  return (
    <Card>
      <CardHeader className="md:grid-cols-[1fr_auto]">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl font-black font-heading">
            <CalendarClock className="h-5 w-5" />
            Next 7 days
          </CardTitle>
          <CardDescription className="mt-1">
            Known expenses, recurring charges, and subscriptions.
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/reports?tab=forecast">Open forecast</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {!plan.forecastAvailable ? (
          <div className="flex items-start gap-3 border-2 border-amber-300 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-800" />
            <div>
              <p className="font-black">Commitments unavailable</p>
              <p className="text-sm text-muted-foreground">
                Add an active bank or cash account to project upcoming charges.
              </p>
            </div>
          </div>
        ) : plan.upcomingCommitments.length === 0 ? (
          <div className="flex items-start gap-3 border-2 border-black/10 bg-muted/40 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-black">No known commitments</p>
              <p className="text-sm text-muted-foreground">
                Nothing scheduled from tracked accounts in the next seven days.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y-2 divide-black/10">
            {plan.upcomingCommitments.map((commitment) => (
              <div
                key={commitment.id}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-black">{commitment.label}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {formatDate(commitment.date, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    • {getCommitmentLabel(commitment.type)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black">
                    {commitment.amountInMainCurrency !== null
                      ? formatCurrency(
                          commitment.amountInMainCurrency,
                          plan.currency
                        )
                      : formatCurrency(commitment.amount, commitment.currency)}
                  </p>
                  {commitment.amountInMainCurrency === null ? (
                    <p className="text-xs font-bold text-amber-800">
                      FX unavailable
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-start gap-3 border-2 p-4",
            minimumIsNegative
              ? "border-red-300 bg-red-50"
              : "border-black bg-primary text-primary-foreground"
          )}
        >
          {minimumIsNegative ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
          ) : (
            <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-xs font-black uppercase tracking-widest opacity-75">
              Lowest projected cash through{" "}
              {formatDate(plan.periodEnd, { month: "short", day: "numeric" })}
            </p>
            {plan.forecastMinimumBalance !== null ? (
              <>
                <p className="mt-1 text-2xl font-black">
                  {formatCurrency(plan.forecastMinimumBalance, plan.currency)}
                </p>
                {plan.forecastMinimumBalanceDate ? (
                  <p className="text-sm font-medium opacity-80">
                    Expected around {formatDate(plan.forecastMinimumBalanceDate)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 font-black">Cash projection unavailable</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMoneyPlan({ plan }: { plan: DashboardMoneyPlanData }) {
  return (
    <section aria-labelledby="money-plan-heading" className="space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
          This month
        </p>
        <h2 id="money-plan-heading" className="text-2xl font-black font-heading">
          Monthly Money Plan
        </h2>
      </div>
      <MoneyPlanHero plan={plan} />
      <div className="grid gap-6 xl:grid-cols-2">
        <MoneyPlanActions plan={plan} />
        <UpcomingMoney plan={plan} />
      </div>
    </section>
  );
}
