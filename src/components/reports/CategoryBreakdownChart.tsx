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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CategoryBreakdownItem } from "@/actions/report-actions";

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownItem[];
  type: "INCOME" | "EXPENSE";
  title?: string;
  description?: string;
  onCategoryClick?: (categoryId: string | null) => void;
  mainCurrency: string;
}

// Predefined color palette for categories
const CATEGORY_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#06b6d4", // Cyan
  "#a855f7", // Fuchsia
];

// Custom tooltip component defined outside render
interface TooltipPayloadItem {
  payload: CategoryBreakdownItem & { color: string };
}

/**
 * Render a custom tooltip that displays category breakdown details.
 *
 * Shows the category name, formatted amount, percentage (one decimal place), and transaction count
 * when the tooltip is active and a payload is available.
 *
 * @param active - Whether the tooltip is currently active (visible)
 * @param payload - Recharts tooltip payload array; the first payload item's `payload` object is used
 * @param mainCurrency - Currency code used to format the displayed amount
 * @returns A JSX element with category details when active and payload are present, `null` otherwise
 */
function CategoryTooltip({ active, payload, mainCurrency }: { active?: boolean; payload?: TooltipPayloadItem[]; mainCurrency: string }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-card border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{item.categoryName}</p>
        <p className="text-sm text-muted-foreground">
          Amount: {formatCurrency(item.amount, mainCurrency)}
        </p>
        <p className="text-sm text-muted-foreground">
          Percentage: {item.percentage.toFixed(1)}%
        </p>
        <p className="text-sm text-muted-foreground">
          Transactions: {item.transactionCount}
        </p>
      </div>
    );
  }
  return null;
}

/**
 * Renders a donut chart showing spending/income breakdown by category.
 *
 * Features:
 * - Interactive legend with category names and amounts
 * - Tooltips showing exact values and percentages
 * - Click-to-drill-down capability
 * - Responsive design
 *
 * @param data - Array of category breakdown items
 * @param type - Whether showing INCOME or EXPENSE data
 * @param title - Optional custom title
 * @param description - Optional custom description
 * @param onCategoryClick - Optional callback when a category is clicked
 * @returns The Category Breakdown Chart React element
 */
export function CategoryBreakdownChart({
  data,
  type,
  title,
  description,
  onCategoryClick,
  mainCurrency,
}: CategoryBreakdownChartProps) {
  const defaultTitle = type === "EXPENSE" ? "Expense by Category" : "Income by Category";
  const defaultDescription = type === "EXPENSE" 
    ? "Where your money went" 
    : "Where your money came from";

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title || defaultTitle}</CardTitle>
          <CardDescription>{description || defaultDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No {type.toLowerCase()} data available for the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  // Prepare chart data with colors
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.categoryColor || CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));

  // Legend component
  const legendItems = chartData.map((item, index) => (
    <button
      key={index}
      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
      onClick={() => onCategoryClick?.(item.categoryId)}
      disabled={!onCategoryClick}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-sm font-medium truncate max-w-[120px]">
          {item.categoryName}
        </span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatCurrency(item.amount, mainCurrency)}</p>
        <p className="text-xs text-muted-foreground">
          {item.percentage.toFixed(1)}%
        </p>
      </div>
    </button>
  ));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || defaultTitle}</CardTitle>
        <CardDescription>{description || defaultDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Total Summary */}
        <div className="mb-4 text-center">
          <p className="text-sm text-muted-foreground">Total {type.toLowerCase()}</p>
          <p className={`text-2xl font-bold ${type === "EXPENSE" ? "text-destructive" : "text-green-600"}`}>
            {formatCurrency(total, mainCurrency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.length} categories • {data.reduce((sum, item) => sum + item.transactionCount, 0)} transactions
          </p>
        </div>

        {/* Donut Chart */}
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="amount"
                nameKey="categoryName"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CategoryTooltip mainCurrency={mainCurrency} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
          {legendItems}
        </div>
      </CardContent>
    </Card>
  );
}