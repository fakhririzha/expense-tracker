"use client";

import {
  AlertCircle,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DebtPlanView } from "@/actions/debt-plan-actions";
import { DebtPlanDialog } from "@/components/liability/DebtPlanDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDebtPlanProjection,
  useDeleteDebtPlan,
} from "@/hooks/useDebtPlanQueries";
import { formatCurrency } from "@/lib/utils";

function strategyLabel(strategy: string): string {
  switch (strategy) {
    case "AVALANCHE":
      return "Avalanche";
    case "SNOWBALL":
      return "Snowball";
    case "CUSTOM":
      return "Custom";
    default:
      return strategy;
  }
}

function formatMonthLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthsLabel(months: number | null): string {
  if (months == null) return "—";
  if (months === 0) return "Paid off";
  if (months === 1) return "1 month";
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return years === 1 ? "1 year" : `${years} years`;
  return `${years}y ${rem}m`;
}

/**
 * Client section for viewing, creating, and editing a debt payoff plan on the Liabilities page.
 */
export function DebtPayoffPlanner() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useDebtPlanProjection();
  const deleteMutation = useDeleteDebtPlan();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DebtPlanView | null>(null);

  const plan = data?.plan ?? null;
  const simulation = data?.simulation ?? null;
  const comparison = data?.comparison ?? null;
  const currency = plan?.currency ?? "IDR";

  const chartData = useMemo(() => {
    if (!simulation?.schedule.length) return [];
    const startPoint = {
      label: "Now",
      remaining: simulation.startingBalance,
    };
    const points = simulation.schedule
      .filter((_, index) => {
        const step = Math.max(1, Math.floor(simulation.schedule.length / 24));
        return (
          index % step === 0 || index === simulation.schedule.length - 1
        );
      })
      .map((step) => ({
        label: formatMonthLabel(step.date),
        remaining: step.remainingBalance,
      }));
    return [startPoint, ...points];
  }, [simulation]);

  const openCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const openEdit = () => {
    if (!plan) return;
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (!confirm("Delete this debt payoff plan?")) return;
    try {
      await deleteMutation.mutateAsync(plan.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete plan");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Debt payoff planner</CardTitle>
          <CardDescription>Loading your plan…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Debt payoff planner</CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Failed to load plan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!plan || !simulation) {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Debt payoff planner
              </CardTitle>
              <CardDescription>
                Compare avalanche vs snowball, project your debt-free date, and
                plan extra payments.
              </CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create plan
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Add APR and minimum payments for your loans and credit cards to
              see payoff timelines and interest estimates. Plans use live
              balances, so payments you record elsewhere update the projection
              automatically.
            </div>
          </CardContent>
        </Card>
        <DebtPlanDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          plan={editingPlan}
          onSuccess={() => refetch()}
        />
      </>
    );
  }

  const interestSaved = comparison?.interestSavedByAvalanche;
  const monthsSaved = comparison?.monthsSavedByAvalanche;
  const remainingNow = simulation.startingBalance;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {plan.name}
              </CardTitle>
              <Badge variant="secondary">{strategyLabel(plan.strategy)}</Badge>
              {isFetching && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              Live balances with your saved rates and minimums. Extra monthly:{" "}
              {formatCurrency(plan.extraMonthlyAmount, currency)}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {simulation.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <ul className="list-disc space-y-1 pl-4">
                {simulation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
              label="Debt-free in"
              value={monthsLabel(simulation.monthsToDebtFree)}
              hint={
                simulation.debtFreeDate
                  ? formatMonthLabel(simulation.debtFreeDate)
                  : "Not reachable with current payments"
              }
            />
            <SummaryTile
              icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
              label="Projected interest"
              value={formatCurrency(simulation.totalInterest, currency)}
              hint={`Total paid ${formatCurrency(simulation.totalPaid, currency)}`}
            />
            <SummaryTile
              icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
              label="Outstanding now"
              value={formatCurrency(remainingNow, currency)}
              hint={`Min + extra ${formatCurrency(
                simulation.monthlyMinimumTotal + plan.extraMonthlyAmount,
                currency
              )}/mo`}
            />
            <SummaryTile
              icon={<Target className="h-4 w-4 text-muted-foreground" />}
              label="Avg monthly payment"
              value={
                simulation.averageMonthlyPayment != null
                  ? formatCurrency(simulation.averageMonthlyPayment, currency)
                  : "—"
              }
              hint={
                simulation.isPayable
                  ? "Across the full schedule"
                  : "Increase payments to finish"
              }
            />
          </div>

          {comparison && (
            <div className="grid gap-4 lg:grid-cols-2">
              <StrategyCompareCard
                title="Avalanche"
                description="Highest interest rate first"
                result={comparison.avalanche}
                currency={currency}
                highlight={plan.strategy === "AVALANCHE"}
              />
              <StrategyCompareCard
                title="Snowball"
                description="Lowest balance first"
                result={comparison.snowball}
                currency={currency}
                highlight={plan.strategy === "SNOWBALL"}
              />
            </div>
          )}

          {interestSaved != null && interestSaved > 0 && (
            <p className="text-sm text-muted-foreground">
              Avalanche saves about{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(interestSaved, currency)}
              </span>{" "}
              in interest
              {monthsSaved != null && monthsSaved > 0
                ? ` and finishes ${monthsSaved} month${monthsSaved === 1 ? "" : "s"} sooner`
                : ""}{" "}
              versus snowball with the same extra budget.
            </p>
          )}

          {chartData.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Projected remaining balance</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      width={72}
                      tickFormatter={(value: number) =>
                        new Intl.NumberFormat("id-ID", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(value)
                      }
                    />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(Number(value ?? 0), currency)
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="remaining"
                      name="Remaining"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Debts in plan</p>
            <div className="space-y-3">
              {plan.items.map((item) => {
                const summary = simulation.debtSummaries.find(
                  (row) => row.id === item.accountId
                );
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{item.accountName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.accountType === "LOAN" ? "Loan" : "Credit card"}{" "}
                          · APR {item.annualInterestRate}% · Min{" "}
                          {formatCurrency(item.minimumPayment, currency)}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-semibold">
                          {formatCurrency(
                            item.balanceInPlanCurrency,
                            currency
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {summary?.payoffDate
                            ? `Payoff ${formatMonthLabel(summary.payoffDate)}`
                            : "Payoff date unavailable"}
                        </p>
                      </div>
                    </div>
                    {summary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Interest in plan:{" "}
                        {formatCurrency(summary.totalInterest, currency)}
                        {summary.monthsToPayoff != null
                          ? ` · ${monthsLabel(summary.monthsToPayoff)} to clear`
                          : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {simulation.schedule.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Upcoming payment months</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Month</th>
                      <th className="px-3 py-2 font-medium">Payment</th>
                      <th className="px-3 py-2 font-medium">Interest</th>
                      <th className="px-3 py-2 font-medium">Remaining</th>
                      <th className="px-3 py-2 font-medium">Focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.schedule.slice(0, 12).map((step) => {
                      const focusName =
                        plan.items.find(
                          (item) => item.accountId === step.focusDebtId
                        )?.accountName ?? "—";
                      return (
                        <tr key={step.monthIndex} className="border-t">
                          <td className="px-3 py-2">
                            {formatMonthLabel(step.date)}
                          </td>
                          <td className="px-3 py-2">
                            {formatCurrency(step.totalPayment, currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatCurrency(step.totalInterest, currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatCurrency(step.remainingBalance, currency)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {focusName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {simulation.schedule.length > 12 && (
                <p className="text-xs text-muted-foreground">
                  Showing first 12 of {simulation.schedule.length} months.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DebtPlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editingPlan}
        onSuccess={() => refetch()}
      />
    </>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function StrategyCompareCard({
  title,
  description,
  result,
  currency,
  highlight,
}: {
  title: string;
  description: string;
  result: {
    monthsToDebtFree: number | null;
    totalInterest: number;
    debtFreeDate: string | null;
    isPayable: boolean;
  };
  currency: string;
  highlight: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border-2 border-primary/40 bg-primary/5 p-4"
          : "rounded-lg border p-4"
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {highlight && <Badge>Your plan</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Time</dt>
          <dd className="font-medium">{monthsLabel(result.monthsToDebtFree)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Interest</dt>
          <dd className="font-medium">
            {result.isPayable
              ? formatCurrency(result.totalInterest, currency)
              : "—"}
          </dd>
        </div>
      </dl>
      {result.debtFreeDate && (
        <p className="mt-2 text-xs text-muted-foreground">
          Debt-free {formatMonthLabel(result.debtFreeDate)}
        </p>
      )}
    </div>
  );
}
