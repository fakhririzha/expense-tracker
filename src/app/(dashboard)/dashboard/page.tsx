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
    Boxes,
    CreditCard,
    PiggyBank,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";

/**
 * Render the authenticated user's dashboard, showing executive metrics, monthly cash flow,
 * health and retirement progress, and investment performance summaries.
 *
 * @returns The dashboard page React element; may trigger a redirect to `/login` when the user is not authenticated or render an error message if executive metrics fail to load.
 */
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold font-heading">Net Worth</CardTitle>
            <Wallet className="h-6 w-6 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(metrics.netWorth, currency)}
            </div>
            <p className="text-sm font-medium opacity-80 mt-1">
              Total assets minus liabilities
            </p>
          </CardContent>
        </Card>

        <Card className="bg-secondary text-secondary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold font-heading">
              Total Investments
            </CardTitle>
            <BarChart3 className="h-6 w-6 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(metrics.totalInvestments, currency)}
            </div>
            {"data" in portfolioSummary &&
              portfolioSummary.data &&
              !Array.isArray(portfolioSummary.data) && (
                <p
                  className={`text-sm font-medium mt-1 ${
                    portfolioSummary.data.totalUnrealizedPnL >= 0
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {formatPercentage(portfolioSummary.data.totalUnrealizedPnLPercent)}{" "}
                  unrealized
                </p>
              )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold font-heading">Cash & Savings</CardTitle>
            <PiggyBank className="h-6 w-6 text-foreground opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(metrics.totalCash + metrics.totalSavings, currency)}
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {metrics.monthsOfRunway.toFixed(1)} months runway
            </p>
          </CardContent>
        </Card>

        <Card className="bg-accent text-accent-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold font-heading">
              Personal Assets
            </CardTitle>
            <Boxes className="h-6 w-6 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(metrics.totalPersonalAssets, currency)}
            </div>
            <p className="text-sm font-medium opacity-80 mt-1">
              Owned items at current value
            </p>
          </CardContent>
        </Card>

        <Card className="bg-destructive text-destructive-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold font-heading">Total Debt</CardTitle>
            <CreditCard className="h-6 w-6 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(metrics.totalDebt, currency)}
            </div>
            <p className="text-sm font-medium opacity-80 mt-1">
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
            <CardTitle className="text-xl font-bold font-heading">
              Monthly Income (Avg)
            </CardTitle>
            <TrendingUp className="h-6 w-6 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600 tracking-tight">
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
            <CardTitle className="text-xl font-bold font-heading">
              Monthly Expenses (Avg)
            </CardTitle>
            <TrendingDown className="h-6 w-6 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-600 tracking-tight">
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
            <CardTitle className="text-xl font-bold font-heading">Investment Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Portfolio Value</p>
                <p className="text-2xl font-black">
                  {formatCurrency(portfolioSummary.data.totalValue, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Cost</p>
                <p className="text-2xl font-black">
                  {formatCurrency(portfolioSummary.data.totalCost, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Unrealized P&L</p>
                <p
                  className={`text-2xl font-black ${
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
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Realized P&L</p>
                <p
                  className={`text-2xl font-black ${
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
