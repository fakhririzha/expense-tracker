import { getPortfolioSummary } from "@/actions/investment-actions";
import { getTransactionSummary } from "@/actions/transaction-actions";
import { auth } from "@/auth";
import { RetirementProgress } from "@/components/dashboard/RetirementProgress";
import { WealthHealthCard } from "@/components/dashboard/WealthHealthBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExecutiveMetrics } from "@/lib/executive-service";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import {
    BarChart3,
    CreditCard,
    PiggyBank,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [metricsResult, transactionSummary, portfolioSummary] =
    await Promise.all([
      getExecutiveMetrics(),
      getTransactionSummary(),
      getPortfolioSummary(),
    ]);

  if (!metricsResult.success || !metricsResult.data) {
    return (
      <div className="p-6">
        <p className="text-red-500">Failed to load dashboard data</p>
      </div>
    );
  }

  const metrics = metricsResult.data;
  const currency = metrics.displayCurrency;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name || "User"}
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.netWorth, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total assets minus liabilities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Investments
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalInvestments, currency)}
            </div>
            {"data" in portfolioSummary &&
              portfolioSummary.data &&
              !Array.isArray(portfolioSummary.data) && (
                <p
                  className={`text-xs ${
                    portfolioSummary.data.totalUnrealizedPnL >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatPercentage(portfolioSummary.data.totalUnrealizedPnLPercent)}{" "}
                  unrealized
                </p>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash & Savings</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalCash + metrics.totalSavings, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.monthsOfRunway.toFixed(1)} months runway
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(metrics.totalDebt, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.debtToWealthRatio.toFixed(1)}% debt-to-wealth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Health Score and Retirement Progress */}
      <div className="grid gap-6 md:grid-cols-2">
        <WealthHealthCard
          tier={metrics.healthTier}
          debtToWealthRatio={metrics.debtToWealthRatio}
          monthsOfRunway={metrics.monthsOfRunway}
        />
        <RetirementProgress
          currentNetWorth={metrics.netWorth}
          targetAmount={metrics.retirementTarget}
          currency={currency}
        />
      </div>

      {/* Monthly Cash Flow */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Income (Avg)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(metrics.avgMonthlyIncome, currency)}
            </div>
            {transactionSummary.success && transactionSummary.data && (
              <p className="text-xs text-muted-foreground">
                Based on last 6 months
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Expenses (Avg)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(metrics.avgMonthlyExpenses, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Savings rate: {metrics.savingsRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Performance Summary */}
      {"data" in portfolioSummary &&
        portfolioSummary.data &&
        !Array.isArray(portfolioSummary.data) && (
        <Card>
          <CardHeader>
            <CardTitle>Investment Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
                <p className="text-xl font-bold">
                  {formatCurrency(portfolioSummary.data.totalValue, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold">
                  {formatCurrency(portfolioSummary.data.totalCost, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                <p
                  className={`text-xl font-bold ${
                    portfolioSummary.data.totalUnrealizedPnL >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {portfolioSummary.data.totalUnrealizedPnL >= 0 ? "+" : ""}
                  {formatCurrency(
                    portfolioSummary.data.totalUnrealizedPnL,
                    currency
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Realized P&L</p>
                <p
                  className={`text-xl font-bold ${
                    portfolioSummary.data.totalRealizedPnL >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {portfolioSummary.data.totalRealizedPnL >= 0 ? "+" : ""}
                  {formatCurrency(
                    portfolioSummary.data.totalRealizedPnL,
                    currency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
