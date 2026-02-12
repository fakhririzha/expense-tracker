"use client";

import { deleteBudget } from "@/actions/budget-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency } from "@/lib/utils";
import { BudgetWithProgress } from "@/actions/budget-actions";
import { MoreHorizontal, Pencil, Trash2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface BudgetCardProps {
  budget: BudgetWithProgress;
  onEdit: (budget: BudgetWithProgress) => void;
  onDelete: () => void;
}

/**
 * Renders a card displaying budget information with progress tracking.
 *
 * Shows budget name, amount, spent, remaining, and a progress bar with
 * color coding based on usage percentage (green/yellow/red).
 * Includes edit and delete actions via dropdown menu.
 *
 * @param budget - The budget data with progress information
 * @param onEdit - Callback invoked when edit action is clicked
 * @param onDelete - Callback invoked after successful deletion
 * @returns The Budget Card React element
 */
export function BudgetCard({ budget, onEdit, onDelete }: BudgetCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

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

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (percentage >= 80) {
      return <TrendingUp className="h-4 w-4 text-yellow-500" />;
    }
    return <TrendingDown className="h-4 w-4 text-green-500" />;
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this budget?")) return;

    setIsDeleting(true);
    try {
      const result = await deleteBudget(budget.id);
      if (result.success) {
        onDelete();
      } else {
        alert(result.error || "Failed to delete budget");
      }
    } catch (error) {
      alert("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const periodLabel = {
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    YEARLY: "Yearly",
  }[budget.period];

  return (
    <Card className={cn(
      "relative overflow-hidden",
      budget.percentage >= 100 && "border-destructive/50",
      budget.percentage >= 80 && budget.percentage < 100 && "border-yellow-500/50"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{budget.name}</CardTitle>
            <CardDescription>
              {budget.category?.name || "All Categories"} • {periodLabel}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted"
                disabled={isDeleting}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(budget)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">
              {formatCurrency(budget.spent)}
            </p>
            <p className="text-sm text-muted-foreground">
              of {formatCurrency(budget.amount)} budget
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(budget.percentage)}
            <span
              className={cn(
                "text-sm font-medium",
                budget.percentage >= 100 && "text-destructive",
                budget.percentage >= 80 && budget.percentage < 100 && "text-yellow-500",
                budget.percentage < 80 && "text-green-500"
              )}
            >
              {budget.percentage.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className={cn("h-2 rounded-full", getProgressBackgroundColor(budget.percentage))}>
            <div
              className={cn("h-full rounded-full transition-all", getProgressColor(budget.percentage))}
              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {budget.remaining >= 0
                ? `${formatCurrency(budget.remaining)} remaining`
                : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
            </span>
            <span>{budget.daysRemaining} days left</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <div className="flex w-full justify-between text-xs text-muted-foreground">
          <span>Daily avg: {formatCurrency(budget.dailyAverage)}</span>
          <span>Projected: {formatCurrency(budget.projectedSpending)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
