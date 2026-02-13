"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpendingTrendPoint } from "@/actions/report-actions";

interface SpendingTrendsChartProps {
  data: SpendingTrendPoint[];
  title?: string;
  description?: string;
  mainCurrency: string;
}

// Chart colors
const EXPENSE_COLOR = "#ef4444"; // Red for expenses

/**
 * Renders an area chart showing spending trends over time.
 *
 * Displays spending data with a gradient fill, tooltips showing exact values,
 * and properly formatted axes (currency for Y-axis, dates for X-axis).
 *
 * @param data - Array of spending trend data points
 * @param title - Optional custom title (default: "Spending Trends")
 * @param description - Optional custom description
 * @param mainCurrency - The user's main currency for formatting
 * @returns The Spending Trends Chart React element
 */
export function SpendingTrendsChart({
  data,
  title = "Spending Trends",
  description = "Your spending over time",
  mainCurrency,
}: SpendingTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No spending data available for the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total and average
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const average = total / data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Total Spending</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(total, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Average per Period</p>
            <p className="text-xl font-bold">
              {formatCurrency(average, mainCurrency)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={EXPENSE_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value, mainCurrency, "id-ID").replace(/[^0-9.,]/g, "").trim()}
                className="fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value as number, mainCurrency), "Spending"]}
                labelFormatter={(label) => `Period: ${label}`}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                name="Spending"
                stroke={EXPENSE_COLOR}
                strokeWidth={2}
                fill="url(#spendingGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
