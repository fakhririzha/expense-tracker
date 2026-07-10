"use client";

import type { BudgetVsActualItem } from "@/actions/budget-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBudgetCategorySummary } from "@/lib/budget-utils";
import { formatCurrency } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface BudgetVsActualChartProps {
  data: BudgetVsActualItem[];
}

/**
 * Render a bar chart comparing budgeted and actual spending by category.
 *
 * If no categories have budgeted or actual amounts greater than zero, renders
 * an empty-state card prompting the user to create budgets.
 *
 * @param data - Array of budget vs actual comparison data
 * @returns The chart component element, or an empty-state card when there is no data
 */
export function BudgetVsActualChart({ data }: BudgetVsActualChartProps) {
  // Filter out categories with no budget and no spending
  const chartData = data
    .filter((item) => item.budgeted > 0 || item.actual > 0)
    .map((item) => ({
      name:
        item.budgetName ||
        formatBudgetCategorySummary(item.categories, item.scope) ||
        "Uncategorized",
      categorySummary: formatBudgetCategorySummary(item.categories, item.scope),
      budgeted: item.budgeted,
      actual: item.actual,
      variance: item.variance,
      isOverBudget: item.isOverBudget,
      percentageUsed: item.percentageUsed,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category Budget vs Actual</CardTitle>
          <CardDescription>
            Compare category limits with actual spending
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No category budget data available. Create category budgets to see the comparison chart.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
          <CardTitle>Category Budget vs Actual</CardTitle>
          <CardDescription>
            Compare category limits with actual spending by budget rule
          </CardDescription>
        </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                className="fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(value as number),
                  name === "budgeted" ? "Budgeted" : "Actual",
                ]}
                labelFormatter={(label) => `Budget: ${label}`}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: string) =>
                  value === "budgeted" ? "Budgeted" : "Actual"
                }
              />
              <Bar
                dataKey="budgeted"
                name="budgeted"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="actual"
                name="actual"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isOverBudget
                        ? "hsl(var(--destructive))"
                        : "hsl(142.1 76.2% 36.3%)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Table */}
        <div className="mt-6 border-t pt-6">
          <h4 className="text-sm font-medium mb-4">Detailed Breakdown</h4>
          <div className="space-y-2">
            {chartData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.categorySummary && item.categorySummary !== item.name ? (
                      <p className="text-xs text-muted-foreground">{item.categorySummary}</p>
                    ) : null}
                  </div>
                  {item.isOverBudget && (
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                      Over Budget
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <p className="text-muted-foreground">Budgeted</p>
                    <p className="font-medium">{formatCurrency(item.budgeted)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Actual</p>
                    <p
                      className={`font-medium ${
                        item.isOverBudget ? "text-destructive" : "text-green-600"
                      }`}
                    >
                      {formatCurrency(item.actual)}
                    </p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-muted-foreground">Variance</p>
                    <p
                      className={`font-medium ${
                        item.variance < 0 ? "text-destructive" : "text-green-600"
                      }`}
                    >
                      {item.variance >= 0 ? "+" : ""}
                      {formatCurrency(item.variance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
