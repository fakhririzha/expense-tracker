import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type FinancialInsightSeverity } from "@/lib/financial-insights/insight-types";

const SEVERITY_LABELS: Record<FinancialInsightSeverity, string> = {
  success: "Positive",
  info: "Heads-up",
  warning: "Watch",
  danger: "Urgent",
};

const SEVERITY_CLASSNAMES: Record<FinancialInsightSeverity, string> = {
  success: "border-emerald-300 bg-emerald-100 text-emerald-900",
  info: "border-sky-300 bg-sky-100 text-sky-900",
  warning: "border-amber-300 bg-amber-100 text-amber-950",
  danger: "border-red-300 bg-red-100 text-red-900",
};

export function FinancialInsightSeverityBadge({
  severity,
}: {
  severity: FinancialInsightSeverity;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold", SEVERITY_CLASSNAMES[severity])}
    >
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
