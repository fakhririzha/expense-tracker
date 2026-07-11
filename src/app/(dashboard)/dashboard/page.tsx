import { getDashboardMoneyPlan } from "@/actions/dashboard-money-plan-actions";
import { auth } from "@/auth";
import { DashboardMoneyPlan } from "@/components/dashboard/DashboardMoneyPlan";
import { RetirementProgress } from "@/components/dashboard/RetirementProgress";
import { WealthHealthCard } from "@/components/dashboard/WealthHealthBadge";
import { DashboardChangelogDialog } from "@/components/dashboard/DashboardChangelogDialog";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { TourLauncherButton } from "@/components/onboarding/TourLauncherButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExecutiveMetrics } from "@/lib/executive-service";
import { getPeriodLabel } from "@/lib/net-worth-period";
import { getNetWorthSnapshotSummaryForUser } from "@/lib/net-worth-snapshot-service";
import { ONBOARDING_TOUR_TARGETS } from "@/lib/onboarding/constants";
import { formatCurrency } from "@/lib/utils";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CreditCard, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

async function getDashboardChangelog() {
  try {
    const changelogPath = path.join(process.cwd(), "content", "changelog.md");
    const markdown = await readFile(changelogPath, "utf8");
    const trimmedMarkdown = markdown.trim();

    if (!trimmedMarkdown) {
      return null;
    }

    return { markdown: trimmedMarkdown };
  } catch (error) {
    console.error("Failed to load dashboard changelog", error);
    return null;
  }
}

/**
 * Render the authenticated user's action-led dashboard and financial position.
 *
 * @returns The dashboard page React element; may trigger a redirect to `/login` when the user is not authenticated or render an error message if executive metrics fail to load.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [
    metricsResult,
    moneyPlanResult,
    changelog,
    snapshotSummary,
  ] = await Promise.all([
    getExecutiveMetrics(),
    getDashboardMoneyPlan(),
    getDashboardChangelog(),
    getNetWorthSnapshotSummaryForUser(session.user.id, 12),
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
    <div
      data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardRoot}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div
        data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardWelcome}
        className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name || "User"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {changelog ? (
            <DashboardChangelogDialog markdown={changelog.markdown} />
          ) : null}
          <TourLauncherButton />
        </div>
      </div>

      <GettingStartedCard />

      {moneyPlanResult.success && moneyPlanResult.data ? (
        <DashboardMoneyPlan plan={moneyPlanResult.data} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Money Plan</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {moneyPlanResult.error || "Your monthly money plan is unavailable right now."}
          </CardContent>
        </Card>
      )}

      <section
        data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardOverview}
        className="space-y-4"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            Your position
          </p>
          <h2 className="text-2xl font-black font-heading">Financial position</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <Card data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardNetWorth}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-black font-heading">Net worth</CardTitle>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black tracking-tight">
                {metrics.netWorth === null
                  ? "Unavailable"
                  : formatCurrency(metrics.netWorth, currency)}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {snapshotSummary.latestSnapshot
                  ? `Snapshot ${getPeriodLabel({
                      year: snapshotSummary.latestSnapshot.periodYear,
                      month: snapshotSummary.latestSnapshot.periodMonth,
                    })}`
                  : "Assets minus liabilities"}
              </p>
            </CardContent>
          </Card>

          <Card data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardCashSavings}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-black font-heading">Cash runway</CardTitle>
              <PiggyBank className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black tracking-tight">
                {metrics.monthsOfRunway.toFixed(1)} months
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {formatCurrency(metrics.totalCash + metrics.totalSavings, currency)} liquid
              </p>
            </CardContent>
          </Card>

          <Card data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardDebt}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-black font-heading">Total debt</CardTitle>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black tracking-tight">
                {formatCurrency(metrics.totalDebt, currency)}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {metrics.debtToWealthRatio === null
                  ? "Debt ratio unavailable"
                  : `${metrics.debtToWealthRatio.toFixed(1)}% debt-to-wealth`}
              </p>
            </CardContent>
          </Card>

          <Card data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardCashFlow}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-black font-heading">Savings rate</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black tracking-tight">
                {metrics.savingsRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Based on the last 6 months
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Health Score and Retirement Progress */}
      <div
        data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardHealthRetirement}
        className="grid gap-6 md:grid-cols-2"
      >
        {metrics.healthTier && metrics.debtToWealthRatio !== null ? (
          <WealthHealthCard
            tier={metrics.healthTier}
            debtToWealthRatio={metrics.debtToWealthRatio}
            monthsOfRunway={metrics.monthsOfRunway}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Financial Health Score</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Unavailable until the live investment valuation can be loaded.
            </CardContent>
          </Card>
        )}
        {metrics.netWorth === null ? (
          <Card>
            <CardHeader>
              <CardTitle>Retirement Progress</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Unavailable until the live investment valuation can be loaded.
            </CardContent>
          </Card>
        ) : (
          <RetirementProgress
            currentNetWorth={metrics.netWorth}
            targetAmount={metrics.retirementTarget}
            projection={metrics.retirementProjection}
            currency={currency}
          />
        )}
      </div>

      {/* Investment Performance Summary */}
      {metrics.portfolioSummary ? (
        <Card data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardInvestmentPerformance}>
          <CardHeader>
            <CardTitle className="text-xl font-bold font-heading">Investment Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Portfolio Value</p>
                <p className="text-2xl font-black">
                  {formatCurrency(metrics.portfolioSummary.totalValue, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Cost</p>
                <p className="text-2xl font-black">
                  {formatCurrency(metrics.portfolioSummary.totalCost, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Unrealized P&L</p>
                <p
                  className={`text-2xl font-black ${
                    metrics.portfolioSummary.totalUnrealizedPnL >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {metrics.portfolioSummary.totalUnrealizedPnL >= 0 ? "+" : ""}
                  {formatCurrency(
                    metrics.portfolioSummary.totalUnrealizedPnL,
                    currency
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Realized P&L</p>
                <p
                  className={`text-2xl font-black ${
                    metrics.portfolioSummary.totalRealizedPnL >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {metrics.portfolioSummary.totalRealizedPnL >= 0 ? "+" : ""}
                  {formatCurrency(
                    metrics.portfolioSummary.totalRealizedPnL,
                    currency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardInvestmentPerformance}>
          <CardHeader>
            <CardTitle className="text-xl font-bold font-heading">
              Investment Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {metrics.valuationError ||
              "Current investment valuation is unavailable."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
