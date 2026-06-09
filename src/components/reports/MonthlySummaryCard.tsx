"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import type { MonthlySummary } from "@/actions/report-actions";

interface MonthlySummaryCardProps {
  data: MonthlySummary;
  title?: string;
  mainCurrency: string;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Render a compact change indicator showing a signed currency delta and a comparison label.
 *
 * Displays an icon that reflects increase, decrease, or no change, the formatted change amount
 * (prefixed with "+" for positive values or "No change" for zero), and a "vs {label}" suffix.
 *
 * @param value - The change amount in the same currency as displayed; positive for increase, negative for decrease, zero for no change.
 * @param label - Comparison label shown after "vs" (for example, "last month").
 * @param mainCurrency - The user's main currency for formatting.
 * @returns The JSX element representing the change indicator.
 */
function ChangeIndicator({ value, label, mainCurrency }: { value: number; label: string; mainCurrency: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  return (
    <div className="flex items-center gap-1">
      {isNeutral ? (
        <MinusIcon className="h-3 w-3 text-muted-foreground" />
      ) : isPositive ? (
        <ArrowUpIcon className="h-3 w-3 text-green-600" />
      ) : (
        <ArrowDownIcon className="h-3 w-3 text-destructive" />
      )}
      <span className={`text-xs ${isNeutral ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-destructive"}`}>
        {isNeutral ? "No change" : `${isPositive ? "+" : ""}${formatCurrency(Math.abs(value), mainCurrency)}`}
      </span>
      <span className="text-xs text-muted-foreground">vs {label}</span>
    </div>
  );
}

/**
 * Display a monthly financial summary card including totals, top categories, month-over-month comparisons, and the savings rate.
 *
 * @param data - MonthlySummary used to populate totals, top categories, previous-month comparisons, and metadata.
 * @param title - Optional custom title; defaults to "<Month> <Year> Summary" when omitted.
 * @param mainCurrency - The user's main currency for formatting.
 * @returns The rendered Monthly Summary Card element.
 */
export function MonthlySummaryCard({
  data,
  title,
  mainCurrency,
}: MonthlySummaryCardProps) {
  const monthName = monthNames[data.month - 1];
  const defaultTitle = `${monthName} ${data.year} Summary`;

  // Calculate savings rate
  const savingsRate = data.totalIncome > 0 
    ? (data.netFlow / data.totalIncome) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || defaultTitle}</CardTitle>
        <CardDescription>
          {data.transactionCount} transactions recorded
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(data.totalIncome, mainCurrency)}
            </p>
            {data.previousMonthComparison && (
              <ChangeIndicator 
                value={data.previousMonthComparison.incomeChange} 
                label="last month"
                mainCurrency={mainCurrency}
              />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(data.totalExpense, mainCurrency)}
            </p>
            {data.previousMonthComparison && (
              <ChangeIndicator 
                value={-data.previousMonthComparison.expenseChange} 
                label="last month"
                mainCurrency={mainCurrency}
              />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Net Flow</p>
            <p className={`text-xl font-bold ${data.netFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
              {data.netFlow >= 0 ? "+" : ""}{formatCurrency(data.netFlow, mainCurrency)}
            </p>
            {data.previousMonthComparison && (
              <ChangeIndicator 
                value={data.previousMonthComparison.netChange} 
                label="last month"
                mainCurrency={mainCurrency}
              />
            )}
          </div>
        </div>

        {/* Top Expense Categories */}
        {data.topExpenseCategories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Top Expense Categories</h4>
            <div className="space-y-2">
              {data.topExpenseCategories.slice(0, 3).map((category, index) => (
                <div key={category.categoryId || index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: category.categoryColor || "#ef4444" }}
                    />
                    <span className="text-sm">{category.categoryName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{formatCurrency(category.amount, mainCurrency)}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Income Categories */}
        {data.topIncomeCategories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Top Income Sources</h4>
            <div className="space-y-2">
              {data.topIncomeCategories.slice(0, 3).map((category, index) => (
                <div key={category.categoryId || index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: category.categoryColor || "#22c55e" }}
                    />
                    <span className="text-sm">{category.categoryName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{formatCurrency(category.amount, mainCurrency)}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Savings Rate */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Savings Rate</span>
            <span className={`text-sm font-bold ${
              savingsRate >= 20 
                ? "text-green-600" 
                : savingsRate >= 0
                  ? "text-yellow-600"
                  : "text-destructive"
            }`}>
              {data.totalIncome > 0 
                ? `${savingsRate.toFixed(1)}%` 
                : "N/A"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.netFlow >= 0 
              ? savingsRate >= 20
                ? "Great! You're saving over 20% of your income."
                : "Try to save at least 20% of your income."
              : "You spent more than you earned this month."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}