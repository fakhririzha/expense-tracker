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
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NetWorthPoint } from "@/actions/report-actions";

interface NetWorthHistoryChartProps {
  data: NetWorthPoint[];
  title?: string;
  description?: string;
  mainCurrency: string;
}

// Chart colors
const NET_WORTH_COLOR = "#3b82f6"; // Blue
const ASSETS_COLOR = "#22c55e"; // Green
const LIABILITIES_COLOR = "#ef4444"; // Red

/**
 * Renders a card containing summary statistics and a responsive line chart of net worth, assets, and liabilities over time.
 *
 * If `data` is empty or missing, renders a placeholder card with the provided `title` and `description`.
 *
 * @param data - Array of net worth data points
 * @param title - Optional custom title
 * @param description - Optional custom description
 * @param mainCurrency - The user's main currency for formatting
 * @returns A React element displaying the net worth history chart and related summary/range statistics
 */
export function NetWorthHistoryChart({
  data,
  title = "Net Worth History",
  description = "Track your net worth over time",
  mainCurrency,
}: NetWorthHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No net worth data available for the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const currentNetWorth = data[data.length - 1]?.netWorth || 0;
  const currentAssets = data[data.length - 1]?.assets || 0;
  const currentLiabilities = data[data.length - 1]?.liabilities || 0;
  
  const firstNetWorth = data[0]?.netWorth || 0;
  const netWorthChange = currentNetWorth - firstNetWorth;
  const netWorthChangePercent = firstNetWorth !== 0 
    ? ((netWorthChange / Math.abs(firstNetWorth)) * 100).toFixed(1)
    : "0";

  // Find highest and lowest net worth
  const highestNetWorth = Math.max(...data.map(d => d.netWorth));
  const lowestNetWorth = Math.min(...data.map(d => d.netWorth));

  // Format date for display
  const formatXAxis = (date: string) => {
    const [year, month] = date.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Current Net Worth</p>
            <p className={`text-xl font-bold ${currentNetWorth >= 0 ? "text-blue-600" : "text-destructive"}`}>
              {formatCurrency(currentNetWorth, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(currentAssets, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Total Liabilities</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(currentLiabilities, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Change</p>
            <p className={`text-xl font-bold ${netWorthChange >= 0 ? "text-green-600" : "text-destructive"}`}>
              {netWorthChange >= 0 ? "+" : ""}{formatCurrency(netWorthChange, mainCurrency)}
              <span className="text-sm font-normal ml-1">
                ({netWorthChange >= 0 ? "+" : ""}{netWorthChangePercent}%)
              </span>
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value, mainCurrency, "id-ID").replace(/[^0-9.,]/g, "").trim()}
                className="fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    netWorth: "Net Worth",
                    assets: "Assets",
                    liabilities: "Liabilities",
                  };
                  return [formatCurrency(value as number, mainCurrency), labels[name as string] || name];
                }}
                labelFormatter={(label) => `Date: ${formatXAxis(label as string)}`}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    netWorth: "Net Worth",
                    assets: "Assets",
                    liabilities: "Liabilities",
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="assets"
                name="assets"
                stroke={ASSETS_COLOR}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="liabilities"
                name="liabilities"
                stroke={LIABILITIES_COLOR}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="netWorth"
                stroke={NET_WORTH_COLOR}
                strokeWidth={3}
                dot={{ fill: NET_WORTH_COLOR, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Range Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Highest Net Worth</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(highestNetWorth, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Lowest Net Worth</p>
            <p className={`text-lg font-bold ${lowestNetWorth >= 0 ? "text-blue-600" : "text-destructive"}`}>
              {formatCurrency(lowestNetWorth, mainCurrency)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}