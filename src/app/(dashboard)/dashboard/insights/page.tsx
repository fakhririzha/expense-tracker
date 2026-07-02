import { getFinancialInsights } from "@/actions/insight-actions";
import { auth } from "@/auth";
import { FinancialInsightsCard } from "@/components/insights/FinancialInsightsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const insightsResult = await getFinancialInsights({
    scope: "dashboard",
    limit: 6,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          Deterministic financial signals based on your latest balances, budgets,
          and transactions.
        </p>
      </div>

      {insightsResult.success && insightsResult.data ? (
        <FinancialInsightsCard insights={insightsResult.data.insights} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Financial Insights</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {insightsResult.error || "Financial insights are unavailable right now."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
