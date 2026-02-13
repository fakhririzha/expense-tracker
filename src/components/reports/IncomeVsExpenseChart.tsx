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
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IncomeVsExpensePoint } from "@/actions/report-actions";

interface IncomeVsExpenseChartProps {
  data: IncomeVsExpensePoint[];
  title?: string;
  description?: string;
  mainCurrency: string;
}

// Chart colors
const INCOME_COLOR = "#22c55e"; // Green
const EXPENSE_COLOR = "#ef4444"; // Red
const NET_COLOR = "#3b82f6"; // Blue

/**
 * Display an income vs expense chart with grouped bars and a net trend line to compare monthly financial flows.
 *
 * @param data - Array of income and expense points to plot
 * @param title - Optional card header title
 * @param description - Optional card header description
 * @param mainCurrency - The user's main currency for formatting
 * @returns The Income vs Expense chart element
 */
export function IncomeVsExpenseChart({
  data,
  title = "Income vs Expense",
  description = "Compare your income and expenses over time",
  mainCurrency,
}: IncomeVsExpenseChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No data available for the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = data.reduce((sum, item) => sum + item.expense, 0);
  const totalNet = totalIncome - totalExpense;
  const averageNet = totalNet / data.length;

  // Find best and worst months
  const bestMonth = data.reduce((best, item) => 
    item.net > best.net ? item : best, data[0]);
  const worstMonth = data.reduce((worst, item) => 
    item.net < worst.net ? item : worst, data[0]);

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
            <p className="text-sm text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(totalIncome, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Total Expense</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(totalExpense, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Net Flow</p>
            <p className={`text-xl font-bold ${totalNet >= 0 ? "text-green-600" : "text-destructive"}`}>
              {totalNet >= 0 ? "+" : ""}{formatCurrency(totalNet, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Avg Monthly Net</p>
            <p className={`text-xl font-bold ${averageNet >= 0 ? "text-green-600" : "text-destructive"}`}>
              {averageNet >= 0 ? "+" : ""}{formatCurrency(averageNet, mainCurrency)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
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
                dataKey="monthLabel"
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
                    income: "Income",
                    expense: "Expense",
                    net: "Net",
                  };
                  return [formatCurrency(value as number, mainCurrency), labels[name as string] || name];
                }}
                labelFormatter={(label) => `Month: ${label}`}
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
                    income: "Income",
                    expense: "Expense",
                    net: "Net",
                  };
                  return labels[value] || value;
                }}
              />
              <Bar
                dataKey="income"
                name="income"
                fill={INCOME_COLOR}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expense"
                name="expense"
                fill={EXPENSE_COLOR}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="net"
                stroke={NET_COLOR}
                strokeWidth={2}
                dot={{ fill: NET_COLOR, strokeWidth: 2 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Best/Worst Months */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Best Month</p>
            <p className="font-medium">{bestMonth.monthLabel}</p>
            <p className={`text-lg font-bold ${bestMonth.net >= 0 ? "text-green-600" : "text-destructive"}`}>
              {bestMonth.net > 0 ? "+" : ""}{formatCurrency(bestMonth.net, mainCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Worst Month</p>
            <p className="font-medium">{worstMonth.monthLabel}</p>
            <p className={`text-lg font-bold ${worstMonth.net >= 0 ? "text-green-600" : "text-destructive"}`}>
              {worstMonth.net >= 0 ? "+" : ""}{formatCurrency(worstMonth.net, mainCurrency)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}