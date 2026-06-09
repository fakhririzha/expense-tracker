import { Lightbulb } from "lucide-react";

import { FinancialInsightItem } from "@/components/insights/FinancialInsightItem";
import { FinancialInsightsEmptyState } from "@/components/insights/FinancialInsightsEmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type FinancialInsight } from "@/lib/financial-insights/insight-types";

interface FinancialInsightsCardProps {
  insights: FinancialInsight[];
  title?: string;
  description?: string;
}

export function FinancialInsightsCard({
  insights,
  title = "Financial Insights",
  description = "Deterministic signals based on your latest balances, budgets, and transactions.",
}: FinancialInsightsCardProps) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-bold font-heading">
              <Lightbulb className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <div className="rounded-full border bg-muted px-3 py-1 text-xs font-semibold">
            {insights.length} active
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <FinancialInsightsEmptyState />
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <FinancialInsightItem key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
