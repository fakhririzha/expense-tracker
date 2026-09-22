"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Download, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { useCurrency } from "@/contexts/CurrencyContext";
import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
import { CashFlowForecastSection } from "@/components/forecast/CashFlowForecastSection";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { NetWorthSnapshotEmptyState } from "@/components/reports/NetWorthSnapshotEmptyState";
import { NetWorthSnapshotSummaryCard } from "@/components/reports/NetWorthSnapshotSummaryCard";
import { MonthlySummaryCard } from "@/components/reports/MonthlySummaryCard";
import { useOnboardingProgress } from "@/hooks/useOnboardingQueries";
import {
  useNetWorthSnapshotSummary,
  useNetWorthTrend,
} from "@/hooks/useNetWorthSnapshotQueries";
import {
  useIncomeVsExpense,
  useReportsOverview,
} from "@/hooks/useReportQueries";
import { useSubscriptionPageData } from "@/hooks/useSubscriptionQueries";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionSummaryCards } from "@/components/subscriptions/SubscriptionSummaryCards";
import { TrialEndingSoonCard } from "@/components/subscriptions/TrialEndingSoonCard";
import { UpcomingRenewalsCard } from "@/components/subscriptions/UpcomingRenewalsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const chartLoading = () => (
  <div className="h-72 animate-pulse bg-muted/40" aria-label="Loading chart" />
);

function DeferredTabLoading() {
  return (
    <div className="flex items-center justify-center py-12" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading report</span>
    </div>
  );
}

const SpendingTrendsChart = dynamic(
  () =>
    import("@/components/reports/SpendingTrendsChart").then(
      (module) => module.SpendingTrendsChart
    ),
  { ssr: false, loading: chartLoading }
);
const CategoryBreakdownChart = dynamic(
  () =>
    import("@/components/reports/CategoryBreakdownChart").then(
      (module) => module.CategoryBreakdownChart
    ),
  { ssr: false, loading: chartLoading }
);
const IncomeVsExpenseChart = dynamic(
  () =>
    import("@/components/reports/IncomeVsExpenseChart").then(
      (module) => module.IncomeVsExpenseChart
    ),
  { ssr: false, loading: chartLoading }
);
const NetWorthHistoryChart = dynamic(
  () =>
    import("@/components/reports/NetWorthHistoryChart").then(
      (module) => module.NetWorthHistoryChart
    ),
  { ssr: false, loading: chartLoading }
);

/**
 * Renders the Reports & Analytics dashboard page with controls, KPI cards, and interactive charts.
 *
 * @returns The Reports & Analytics page as a React element.
 */
export default function ReportsPage() {
  const searchParams = useSearchParams();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("week");
  const { mainCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get("tab") === "forecast" ? "forecast" : "overview"
  );
  const { data: onboardingProgress } = useOnboardingProgress();

  const hasDateRange = !!(dateRange?.from && dateRange?.to);
  const startDate = useMemo(() => dateRange?.from ?? new Date(), [dateRange?.from]);
  const endDate = useMemo(() => dateRange?.to ?? new Date(), [dateRange?.to]);

  const monthsDiff = useMemo(() => {
    if (!hasDateRange) return 1;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)) || 1;
  }, [hasDateRange, startDate, endDate]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const isOverviewTab = activeTab === "overview";
  const isSpendingTab = activeTab === "spending";
  const isCategoriesTab = activeTab === "categories";
  const isIncomeExpenseTab = activeTab === "income-expense";
  const isNetWorthTab = activeTab === "net-worth";
  const isSubscriptionsTab = activeTab === "subscriptions";

  // Keep report queries scoped to the active surface. This page hosts several
  // expensive aggregations, so hidden tabs should not fetch until selected.
  const needsRangeReport = hasDateRange && (isOverviewTab || isSpendingTab || isCategoriesTab);
  const { data: reportsOverview, isLoading: reportsLoading } = useReportsOverview({
    startDate,
    endDate,
    year: currentYear,
    month: currentMonth,
    enabled: needsRangeReport,
  });
  const spendingTrends = reportsOverview?.trendsByGroup[groupBy] ?? [];
  const expenseCategories = reportsOverview?.expenseCategories ?? [];
  const incomeCategories = reportsOverview?.incomeCategories ?? [];

  const { data: incomeVsExpense = [], isLoading: incomeVsExpenseLoading } = useIncomeVsExpense(
    Math.min(monthsDiff, 12),
    hasDateRange && isIncomeExpenseTab
  );

  const { data: netWorthSummary, isLoading: netWorthSummaryLoading } = useNetWorthSnapshotSummary(
    12,
    isOverviewTab || isNetWorthTab
  );
  const { data: netWorthHistory = [], isLoading: netWorthHistoryLoading } = useNetWorthTrend(
    12,
    mainCurrency,
    isNetWorthTab
  );

  const monthlySummary = isOverviewTab ? reportsOverview?.monthlySummary : undefined;
  const {
    data: subscriptionPage,
    isLoading: subscriptionsLoading,
  } = useSubscriptionPageData({ enabled: isSubscriptionsTab });
  const subscriptionSummary = subscriptionPage?.summary;
  const activeSubscriptions = (subscriptionPage?.subscriptions ?? []).filter(
    (subscription) => subscription.effectiveStatus === "ACTIVE"
  );

  const isLoading = reportsLoading;
  const isNetWorthLoading = netWorthSummaryLoading || netWorthHistoryLoading;
  const isSubscriptionsLoading = subscriptionsLoading;

  // Calculate overview stats
  const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = incomeCategories.reduce((sum, c) => sum + c.amount, 0);
  const netFlow = totalIncome - totalExpenses;
  const latestSnapshot = netWorthSummary?.latestSnapshot ?? null;
  const needsReportPrerequisites =
    onboardingProgress?.items.some(
      (item) =>
        (item.id === "create_first_account" ||
          item.id === "add_first_transaction") &&
        item.status !== "complete"
    ) ?? false;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Analyze your financial data and track your progress
          </p>
        </div>
        {activeTab !== "forecast" ? (
          <div className="flex items-center gap-4 max-md:flex-col max-md:gap-y-4 max-md:items-start">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        ) : null}
      </div>

      {needsReportPrerequisites ? (
        <ContextualEmptyState
          title="Build your report foundation"
          description="Reports become useful after you add accounts and transactions."
          action={
            <>
              <Button asChild>
                <Link href="/dashboard/accounts">Add accounts</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/transactions">Add transactions</Link>
              </Button>
            </>
          }
        />
      ) : null}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="w-full overflow-x-auto pb-1">
            <TabsList className="flex w-max min-w-full justify-start md:grid md:w-full md:grid-cols-7">
              <TabsTrigger value="overview" className="min-w-max md:min-w-0">
                Overview
              </TabsTrigger>
              <TabsTrigger value="spending" className="min-w-max md:min-w-0">
                Spending
              </TabsTrigger>
              <TabsTrigger value="categories" className="min-w-max md:min-w-0">
                Categories
              </TabsTrigger>
              <TabsTrigger value="income-expense" className="min-w-max md:min-w-0">
                Income vs Expense
              </TabsTrigger>
              <TabsTrigger value="net-worth" className="min-w-max md:min-w-0">
                Net Worth
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="min-w-max md:min-w-0">
                Subscriptions
              </TabsTrigger>
              <TabsTrigger value="forecast" className="min-w-max md:min-w-0">
                Forecast
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalIncome, mainCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {incomeCategories.length} income sources
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(totalExpenses, mainCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {expenseCategories.length} expense categories
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Flow</CardTitle>
                  {netFlow >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${netFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {netFlow >= 0 ? "+" : ""}{formatCurrency(netFlow, mainCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalIncome > 0 ? `${((netFlow / totalIncome) * 100).toFixed(1)}% savings rate` : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
                  <Wallet className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${
                      (latestSnapshot?.netWorth ?? 0) >= 0
                        ? "text-blue-600"
                        : "text-destructive"
                    }`}
                  >
                    {latestSnapshot
                      ? formatCurrency(latestSnapshot.netWorth, latestSnapshot.currency)
                      : "Unavailable"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {latestSnapshot
                      ? "Latest month-end snapshot"
                      : "No month-end snapshot yet"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Monthly Summary */}
              {monthlySummary && (
                <MonthlySummaryCard data={monthlySummary} mainCurrency={mainCurrency} />
              )}
              
              {/* Spending Trends Mini */}
              <SpendingTrendsChart
                data={spendingTrends}
                title="Spending Overview"
                description="Your spending pattern in the selected period"
                mainCurrency={mainCurrency}
              />
            </div>

            {/* Category Breakdowns */}
            <div className="grid gap-6 md:grid-cols-2">
              <CategoryBreakdownChart
                data={expenseCategories}
                type="EXPENSE"
                mainCurrency={mainCurrency}
              />
              <CategoryBreakdownChart
                data={incomeCategories}
                type="INCOME"
                mainCurrency={mainCurrency}
              />
            </div>
          </TabsContent>

          {/* Spending Tab */}
          <TabsContent value="spending" className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-muted-foreground">Group by:</span>
              <div className="flex gap-2">
                {(["day", "week", "month"] as const).map((g) => (
                  <Button
                    key={g}
                    variant={groupBy === g ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGroupBy(g)}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <SpendingTrendsChart
              data={spendingTrends}
              title="Spending Trends"
              description="Track your spending over time"
              mainCurrency={mainCurrency}
            />
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <CategoryBreakdownChart
                data={expenseCategories}
                type="EXPENSE"
                mainCurrency={mainCurrency}
              />
              <CategoryBreakdownChart
                data={incomeCategories}
                type="INCOME"
                mainCurrency={mainCurrency}
              />
            </div>
          </TabsContent>

          {/* Income vs Expense Tab */}
          <TabsContent value="income-expense" className="space-y-6">
            {incomeVsExpenseLoading ? (
              <DeferredTabLoading />
            ) : (
              <IncomeVsExpenseChart
                data={incomeVsExpense}
                title="Income vs Expense"
                description="Compare your income and expenses over time"
                mainCurrency={mainCurrency}
              />
            )}
          </TabsContent>

          {/* Net Worth Tab */}
          <TabsContent value="net-worth" className="space-y-6">
            {isNetWorthLoading ? (
              <DeferredTabLoading />
            ) : (
              <>
                {netWorthSummary?.latestSnapshot ? (
                  <NetWorthSnapshotSummaryCard summary={netWorthSummary} />
                ) : null}
                {netWorthHistory.length > 0 ? (
                  <NetWorthHistoryChart
                    data={netWorthHistory}
                    title="Net Worth History"
                    description="Stable month-end snapshots of your assets, liabilities, and net worth"
                    mainCurrency={mainCurrency}
                  />
                ) : (
                  <NetWorthSnapshotEmptyState
                    hasCurrencyMismatch={netWorthSummary?.hasCurrencyMismatch}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            {isSubscriptionsLoading ? (
              <DeferredTabLoading />
            ) : (
              <>
                <SubscriptionSummaryCards summary={subscriptionSummary} />

                <div className="grid gap-6 lg:grid-cols-2">
                  <UpcomingRenewalsCard items={subscriptionSummary?.upcomingRenewals ?? []} />
                  <TrialEndingSoonCard items={subscriptionSummary?.trialEndingSoon ?? []} />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Active Subscriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeSubscriptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No active subscriptions tracked yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {activeSubscriptions
                          .slice()
                          .sort((left, right) => right.monthlyEquivalent - left.monthlyEquivalent)
                          .slice(0, 8)
                          .map((subscription) => (
                            <div
                              key={subscription.id}
                              className="flex items-center justify-between gap-4 rounded-lg border p-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{subscription.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {subscription.provider || "No provider"}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-semibold">
                                  {formatCurrency(subscription.monthlyEquivalent, subscription.currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">monthly equivalent</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            <CashFlowForecastSection />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
