"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CashFlowForecastResult, ForecastEvent } from "@/lib/forecasting/forecast-types";

interface ForecastEventListProps {
  forecast: CashFlowForecastResult;
}

function confidenceVariant(event: ForecastEvent) {
  if (event.confidence === "low") return "outline" as const;
  if (event.confidence === "medium") return "secondary" as const;
  return "default" as const;
}

export function ForecastEventList({ forecast }: ForecastEventListProps) {
  const visibleEvents = forecast.events.slice(0, 24);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Cash Events</CardTitle>
        <CardDescription>
          Scheduled and estimated inflows and outflows that shape this forecast.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visibleEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projected cash events in this horizon.</p>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.label}</p>
                    <Badge variant={confidenceVariant(event)}>{event.confidence}</Badge>
                    <Badge variant="outline">{event.source.replaceAll("_", " ")}</Badge>
                    {event.excludedFromProjection ? (
                      <Badge variant="secondary">excluded</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(event.date)} • {event.direction === "inflow" ? "Inflow" : "Outflow"}
                  </p>
                </div>
                <div className="shrink-0 text-left md:text-right">
                  <p
                    className={`font-semibold ${
                      event.direction === "inflow" ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {event.direction === "inflow" ? "+" : "-"}
                    {formatCurrency(
                      event.amountInMainCurrency ?? event.amount,
                      event.amountInMainCurrency === null ? event.currency : forecast.currency
                    )}
                  </p>
                  {event.amountInMainCurrency === null ? (
                    <p className="text-xs text-muted-foreground">
                      Missing FX for {event.currency}
                    </p>
                  ) : event.currency !== forecast.currency ? (
                    <p className="text-xs text-muted-foreground">
                      Original {formatCurrency(event.amount, event.currency)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
