import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FinancialInsightIcon } from "@/components/insights/FinancialInsightIcon";
import { FinancialInsightSeverityBadge } from "@/components/insights/FinancialInsightSeverityBadge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { type FinancialInsight } from "@/lib/financial-insights/insight-types";

function formatInsightValue(insight: FinancialInsight): string | null {
  if (typeof insight.value !== "number") {
    return null;
  }

  const valueKind = insight.metadata?.valueKind;
  if (insight.currency || valueKind === "currency") {
    return formatCurrency(insight.value, insight.currency);
  }

  if (valueKind === "percentage") {
    return `${formatNumber(insight.value)}%`;
  }

  if (valueKind === "months") {
    return `${formatNumber(insight.value)} months`;
  }

  if (valueKind === "count") {
    return Math.round(insight.value).toString();
  }

  return formatNumber(insight.value);
}

export function FinancialInsightItem({
  insight,
}: {
  insight: FinancialInsight;
}) {
  const formattedValue = formatInsightValue(insight);

  return (
    <div className="flex gap-4 rounded-xl border p-4">
      <FinancialInsightIcon type={insight.type} />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{insight.title}</h3>
              <FinancialInsightSeverityBadge severity={insight.severity} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {insight.description}
            </p>
          </div>
          {formattedValue ? (
            <p className="shrink-0 text-right text-sm font-semibold">
              {formattedValue}
            </p>
          ) : null}
        </div>

        {insight.actionHref && insight.actionLabel ? (
          <Button asChild size="sm" variant="outline">
            <Link href={insight.actionHref}>{insight.actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
