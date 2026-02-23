"use client";

import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { SpendingTrendsChart } from "@/components/reports/SpendingTrendsChart";
import { CategoryBreakdownChart } from "@/components/reports/CategoryBreakdownChart";
import { IncomeVsExpenseChart } from "@/components/reports/IncomeVsExpenseChart";
import { NetWorthHistoryChart } from "@/components/reports/NetWorthHistoryChart";
import { MonthlySummaryCard } from "@/components/reports/MonthlySummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Download, Loader2, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useState, useMemo } from "react";
import { DateRange } from "react-day-picker";
import {
  useSpendingTrends,
  useCategoryBreakdown,
  useIncomeVsExpense,
  useNetWorthHistory,
  useReportMonthlySummary,
} from "@/hooks/useReportQueries";
import { useCurrency } from "@/contexts/CurrencyContext";

/**
 * Renders the Reports & Analytics dashboard page with controls, KPI cards, and interactive charts.
 *
 * @returns The Reports & Analytics page as a React element.
 */
export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("week");
  const { mainCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState("overview");

  const hasDateRange = !!(dateRange?.from && dateRange?.to);
  const startDate = useMemo(() => dateRange?.from ?? new Date(), [dateRange?.from]);
  const endDate = useMemo(() => dateRange?.to ?? new Date(), [dateRange?.to]);

  const monthsDiff = useMemo(() => {
    if (!hasDateRange) return 1;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)) || 1;
  }, [hasDateRange, startDate, endDate]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Queries — all enabled only when date range is selected
  const { data: spendingTrends = [], isLoading: trendsLoading } = useSpendingTrends({
    startDate,
    endDate,
    groupBy,
    enabled: hasDateRange,
  });

  const { data: expenseCategories = [], isLoading: expCatLoading } = useCategoryBreakdown({
    startDate,
    endDate,
    type: "EXPENSE",
    enabled: hasDateRange,
  });

  const { data: incomeCategories = [] } = useCategoryBreakdown({
    startDate,
    endDate,
    type: "INCOME",
    enabled: hasDateRange,
  });

  const { data: incomeVsExpense = [] } = useIncomeVsExpense(
    Math.min(monthsDiff, 12),
    hasDateRange
  );

  const { data: netWorthHistory = [] } = useNetWorthHistory(
    Math.min(monthsDiff, 12),
    hasDateRange
  );

  const { data: monthlySummary } = useReportMonthlySummary(
    currentYear,
    currentMonth,
    hasDateRange
  );

  const isLoading = trendsLoading || expCatLoading;

  // Calculate overview stats
  const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = incomeCategories.reduce((sum, c) => sum + c.amount, 0);
  const netFlow = totalIncome - totalExpenses;
  const currentNetWorth = netWorthHistory[netWorthHistory.length - 1]?.netWorth || 0;

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
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="income-expense">Income vs Expense</TabsTrigger>
            <TabsTrigger value="net-worth">Net Worth</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  <div className={`text-2xl font-bold ${currentNetWorth >= 0 ? "text-blue-600" : "text-destructive"}`}>
                    {formatCurrency(currentNetWorth, mainCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current estimate
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
            <IncomeVsExpenseChart
              data={incomeVsExpense}
              title="Income vs Expense"
              description="Compare your income and expenses over time"
              mainCurrency={mainCurrency}
            />
          </TabsContent>

          {/* Net Worth Tab */}
          <TabsContent value="net-worth" className="space-y-6">
            <NetWorthHistoryChart
              data={netWorthHistory}
              title="Net Worth History"
              description="Track your net worth over time"
              mainCurrency={mainCurrency}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}