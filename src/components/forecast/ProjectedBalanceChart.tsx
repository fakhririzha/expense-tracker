"use client";

import {
  CartesianGrid,
  ComposedChart,
  Bar,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CashFlowForecastResult } from "@/lib/forecasting/forecast-types";

interface ProjectedBalanceChartProps {
  forecast: CashFlowForecastResult;
}

export function ProjectedBalanceChart({
  forecast,
}: ProjectedBalanceChartProps) {
  const chartData = forecast.dailyBalances.map((day) => ({
    dateKey: day.dateKey,
    label: formatDate(day.date, { month: "short", day: "numeric" }),
    startingBalance: day.startingBalance,
    inflow: day.inflow,
    outflow: day.outflow,
    endingBalance: day.endingBalance,
    topEvents: day.events.slice(0, 3).map((event) => event.label).join(", "),
  }));

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projected Balance</CardTitle>
        <CardDescription>
          Daily liquid-cash projection across the selected forecast horizon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis
                tickFormatter={(value) =>
                  formatCurrency(value, forecast.currency).replace(/[^0-9.,-]/g, "").trim()
                }
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(value as number, forecast.currency),
                  name === "endingBalance"
                    ? "Ending balance"
                    : name === "startingBalance"
                      ? "Starting balance"
                      : name === "inflow"
                        ? "Inflow"
                        : "Outflow",
                ]}
                labelFormatter={(label, payload) => {
                  const events = payload?.[0]?.payload?.topEvents;
                  return events ? `${label} • ${events}` : String(label);
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Bar dataKey="inflow" fill="#22c55e" opacity={0.35} radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflow" fill="#ef4444" opacity={0.35} radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="endingBalance"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
              {forecast.lowestProjectedBalanceDate ? (
                <ReferenceDot
                  x={formatDate(forecast.lowestProjectedBalanceDate, {
                    month: "short",
                    day: "numeric",
                  })}
                  y={forecast.lowestProjectedBalance}
                  r={5}
                  fill="#ef4444"
                  stroke="#ef4444"
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
