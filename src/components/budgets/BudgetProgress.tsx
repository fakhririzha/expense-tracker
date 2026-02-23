"use client";

import { useBudgetTransactions } from "@/hooks/useBudgetQueries";
import { BudgetWithProgress } from "@/actions/budget-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";

interface BudgetProgressProps {
  budget: BudgetWithProgress;
  onBack: () => void;
}

/**
 * Renders a detailed budget progress view.
 *
 * Shows budget summary, progress bar, spending statistics,
 * and a list of transactions contributing to the budget.
 *
 * @param budget - The budget data with progress information
 * @param onBack - Callback to navigate back to budget list
 * @returns The Budget Progress React element
 */
export function BudgetProgress({ budget, onBack }: BudgetProgressProps) {
  const { data: transactions = [], isLoading } = useBudgetTransactions(budget.id);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getProgressBackgroundColor = (percentage: number) => {
    if (percentage >= 100) return "bg-destructive/20";
    if (percentage >= 80) return "bg-yellow-500/20";
    return "bg-green-500/20";
  };

  const periodLabel = {
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    YEARLY: "Yearly",
  }[budget.period];

  // Derive weekly average from daily average for accurate calculation
  const weeklyAverage = budget.dailyAverage * 7;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{budget.name}</h2>
          <p className="text-muted-foreground">
            {budget.category?.name || "All Categories"} • {periodLabel}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(budget.amount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Spent</CardDescription>
            <CardTitle
              className={cn(
                "text-2xl",
                budget.percentage >= 100 && "text-destructive"
              )}
            >
              {formatCurrency(budget.spent)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remaining</CardDescription>
            <CardTitle
              className={cn(
                "text-2xl",
                budget.remaining < 0 && "text-destructive"
              )}
            >
              {formatCurrency(Math.abs(budget.remaining))}
              {budget.remaining < 0 && (
                <span className="text-sm font-normal"> over</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Days Left</CardDescription>
            <CardTitle className="text-2xl">{budget.daysRemaining}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Budget Progress
            {budget.percentage >= 100 ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : budget.percentage >= 80 ? (
              <TrendingUp className="h-5 w-5 text-yellow-500" />
            ) : null}
          </CardTitle>
          <CardDescription>
            {budget.percentage >= 100
              ? "You've exceeded your budget!"
              : budget.percentage >= 80
              ? "You're approaching your budget limit"
              : "You're on track with your budget"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{budget.percentage.toFixed(0)}% used</span>
              <span>{formatCurrency(budget.amount)}</span>
            </div>
            <div
              className={cn(
                "h-3 rounded-full",
                getProgressBackgroundColor(budget.percentage)
              )}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  getProgressColor(budget.percentage)
                )}
                style={{ width: `${Math.min(budget.percentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Daily Average</p>
              <p className="text-lg font-semibold">
                {formatCurrency(budget.dailyAverage)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Weekly Average</p>
              <p className="text-lg font-semibold">
                {formatCurrency(weeklyAverage)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Projected Spending</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  budget.projectedSpending > budget.amount && "text-destructive"
                )}
              >
                {formatCurrency(budget.projectedSpending)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Daily Budget Left</p>
              <p className="text-lg font-semibold">
                {budget.daysRemaining > 0
                  ? formatCurrency(budget.remaining / budget.daysRemaining)
                  : formatCurrency(0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Expenses contributing to this budget
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions found for this budget period
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(new Date(transaction.date))}
                    </TableCell>
                    <TableCell>
                      {transaction.description || "No description"}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1"
                        style={{
                          color: transaction.category?.color || undefined,
                        }}
                      >
                        {transaction.category?.icon && (
                          <span>{transaction.category.icon}</span>
                        )}
                        {transaction.category?.name || "Uncategorized"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.account.name}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}