import { getDashboardMoneyPlan } from "@/actions/dashboard-money-plan-actions";
import { getExecutiveMetrics } from "@/actions/executive-actions";
import { DashboardChangelogDialog } from "@/components/dashboard/DashboardChangelogDialog";
import { DashboardMoneyPlan } from "@/components/dashboard/DashboardMoneyPlan";
import { RetirementProgress } from "@/components/dashboard/RetirementProgress";
import { WealthHealthCard } from "@/components/dashboard/WealthHealthBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPeriodLabel } from "@/lib/net-worth-period";
import { getNetWorthSnapshotSummaryForUser } from "@/lib/net-worth-snapshot-service";
import { ONBOARDING_TOUR_TARGETS } from "@/lib/onboarding/constants";
import { formatCurrency } from "@/lib/utils";
import { CreditCard, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

export async function DashboardChangelogButton() {
  const changelog = await getDashboardChangelog();
  if (!changelog) {
    return null;
  }

  return <DashboardChangelogDialog markdown={changelog.markdown} />;
}

export async function DashboardMoneyPlanSection() {
  const moneyPlanResult = await getDashboardMoneyPlan();

  if (moneyPlanResult.success && moneyPlanResult.data) {
    return <DashboardMoneyPlan plan={moneyPlanResult.data} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Money Plan</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {moneyPlanResult.error || "Your monthly money plan is unavailable right now."}
      </CardContent>
    </Card>
  );
}

export async function DashboardPositionSection({ userId }: { userId: string }) {
  const [metricsResult, snapshotSummary] = await Promise.all([
    getExecutiveMetrics(),
    getNetWorthSnapshotSummaryForUser(userId, 12),
  ]);

  if (!metricsResult.success || !metricsResult.data) {
    return (
      <p className="text-red-500">Failed to load dashboard data</p>
    );
  }

  const metrics = metricsResult.data;
  const currency = metrics.displayCurrency;

  return (
    <>
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
    </>
  );
}
