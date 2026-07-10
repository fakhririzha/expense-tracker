import { format } from "date-fns";
import { Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type WeeklyAiInsightView,
  type WeeklyAiInsightsResponse,
} from "@/lib/weekly-ai-insight-service";

function formatPeriod(insight: WeeklyAiInsightView): string {
  return `${format(new Date(insight.periodStart), "MMM d")}–${format(
    new Date(insight.periodEnd),
    "MMM d, yyyy"
  )}`;
}

function WeeklyBrief({ insight, compact = false }: { insight: WeeklyAiInsightView; compact?: boolean }) {
  return (
    <article className={compact ? "border-t pt-4 first:border-t-0 first:pt-0" : "space-y-4"}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatPeriod(insight)}
        </p>
        <h3 className="mt-1 text-lg font-bold">{insight.content.headline}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{insight.content.summary}</p>
      </div>

      {!compact && (
        <div className="space-y-3">
          {insight.content.observations.map((observation, index) => (
            <div key={`${observation.title}-${index}`} className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-semibold">{observation.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{observation.detail}</p>
            </div>
          ))}
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next week</p>
            <p className="mt-1 text-sm font-medium">{insight.content.nextAction}</p>
          </div>
          <p className="text-xs text-muted-foreground">{insight.content.dataAvailability}</p>
        </div>
      )}
    </article>
  );
}

export function WeeklyAiInsightsCard({ data }: { data: WeeklyAiInsightsResponse }) {
  if (!data.latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold font-heading">
            <Sparkles className="h-5 w-5 text-primary" />
            Weekly AI Insight
          </CardTitle>
          <CardDescription>
            Your completed-week financial brief will appear here after enough activity is recorded.
          </CardDescription>
        </CardHeader>
        {data.latestFailure && (
          <CardContent>
            <Alert>
              <AlertDescription>
                Your latest weekly brief could not be generated. FinHealth will retry automatically.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold font-heading">
          <Sparkles className="h-5 w-5 text-primary" />
          Weekly AI Insight
        </CardTitle>
        <CardDescription>
          A private, evidence-based review of your latest completed week.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.latestFailure && (
          <Alert>
            <AlertDescription>
              Your latest weekly brief could not be generated. FinHealth will retry automatically.
            </AlertDescription>
          </Alert>
        )}
        <WeeklyBrief insight={data.latest} />
        {data.archive.length > 0 && (
          <details className="rounded-md border p-4">
            <summary className="cursor-pointer font-semibold">
              Previous weekly briefs ({data.archive.length})
            </summary>
            <div className="mt-4 space-y-4">
              {data.archive.map((insight) => (
                <WeeklyBrief key={insight.id} insight={insight} compact />
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
