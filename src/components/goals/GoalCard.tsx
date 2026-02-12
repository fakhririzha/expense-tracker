"use client";

import { deleteGoal } from "@/actions/goal-actions";
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
import { cn, formatCurrency } from "@/lib/utils";
import { GoalWithProgress } from "@/actions/goal-actions";
import { MoreHorizontal, Pencil, Trash2, Plus, Calendar, CheckCircle2, Target } from "lucide-react";
import { useState } from "react";

interface GoalCardProps {
  goal: GoalWithProgress;
  onEdit: (goal: GoalWithProgress) => void;
  onAddProgress: (goal: GoalWithProgress) => void;
  onDelete: () => void;
}

/**
 * Renders a card displaying goal information with progress tracking.
 *
 * Shows goal name, icon, color, target amount, current amount, and a progress bar with
 * color coding based on progress percentage (red/orange/yellow/light green/green).
 * Includes edit, add progress, and delete actions via dropdown menu.
 *
 * @param goal - The goal data with progress information
 * @param onEdit - Callback invoked when edit action is clicked
 * @param onAddProgress - Callback invoked when add progress action is clicked
 * @param onDelete - Callback invoked after successful deletion
 * @returns The Goal Card React element
 */
export function GoalCard({ goal, onEdit, onAddProgress, onDelete }: GoalCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 50) return "bg-lime-500";
    if (percentage >= 25) return "bg-yellow-500";
    if (percentage > 0) return "bg-orange-500";
    return "bg-red-500";
  };

  const getProgressBackgroundColor = (percentage: number) => {
    if (percentage >= 75) return "bg-green-500/20";
    if (percentage >= 50) return "bg-lime-500/20";
    if (percentage >= 25) return "bg-yellow-500/20";
    if (percentage > 0) return "bg-orange-500/20";
    return "bg-red-500/20";
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    setIsDeleting(true);
    try {
      const result = await deleteGoal(goal.id);
      if (result.success) {
        onDelete();
      } else {
        alert(result.error || "Failed to delete goal");
      }
    } catch (error) {
      alert("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDaysRemaining = (days: number | null) => {
    if (days === null) return null;
    if (days === 0) return "Due today";
    if (days === 1) return "1 day left";
    if (days < 30) return `${days} days left`;
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? "s" : ""} left`;
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        goal.isCompleted && "ring-2 ring-green-500/50"
      )}
    >
      {/* Color indicator at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: goal.color || "#22c55e" }}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full text-2xl"
              style={{ backgroundColor: `${goal.color || "#22c55e"}20` }}
            >
              {goal.icon || "💰"}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {goal.name}
                {goal.isCompleted && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </CardTitle>
              {goal.description && (
                <CardDescription className="line-clamp-1">
                  {goal.description}
                </CardDescription>
              )}
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddProgress(goal)}>
                <Plus className="mr-2 h-4 w-4" />
                Add/Withdraw Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(goal)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Goal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Goal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{goal.percentage.toFixed(1)}%</span>
          </div>
          <div
            className={cn(
              "h-3 rounded-full overflow-hidden",
              getProgressBackgroundColor(goal.percentage)
            )}
          >
            <div
              className={cn("h-full rounded-full transition-all duration-500", getProgressColor(goal.percentage))}
              style={{ width: `${Math.min(goal.percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Amount details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Current</p>
            <p className="font-semibold text-lg">
              {formatCurrency(goal.currentAmount, "IDR")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-semibold text-lg">
              {formatCurrency(goal.targetAmount, "IDR")}
            </p>
          </div>
        </div>

        {/* Remaining amount */}
        <div className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium">
            {formatCurrency(Math.max(0, goal.remaining), "IDR")}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex justify-between items-center text-sm text-muted-foreground">
        {/* Target date */}
        {goal.targetDate ? (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDaysRemaining(goal.daysRemaining)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>No deadline</span>
          </div>
        )}

        {/* Monthly target if applicable */}
        {goal.monthlyTarget && goal.monthlyTarget > 0 && !goal.isCompleted && (
          <div className="text-xs">
            ~{formatCurrency(goal.monthlyTarget, "IDR")}/month needed
          </div>
        )}
      </CardFooter>

      {/* Completion celebration overlay */}
      {goal.isCompleted && (
        <div className="absolute inset-0 bg-green-500/5 pointer-events-none flex items-center justify-center">
          <div className="text-4xl animate-bounce">🎉</div>
        </div>
      )}
    </Card>
  );
}
