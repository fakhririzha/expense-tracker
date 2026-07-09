"use client";

import { useDeleteGoal } from "@/hooks/useGoalQueries";
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
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn, formatCurrency } from "@/lib/utils";
import { GoalWithProgress } from "@/actions/goal-actions";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Target,
  Wallet,
} from "lucide-react";

interface GoalCardProps {
  goal: GoalWithProgress;
  onEdit: (goal: GoalWithProgress) => void;
  onDelete: () => void;
}

/**
 * Display a savings goal card with live progress from linked account balances.
 */
export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const { mainCurrency } = useCurrency();
  const displayCurrency = goal.mainCurrency || mainCurrency;
  const deleteMutation = useDeleteGoal();
  const isDeleting = deleteMutation.isPending;

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
    try {
      await deleteMutation.mutateAsync(goal.id);
      onDelete();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete goal");
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

  const accountLabel =
    goal.accounts.length === 0
      ? "No accounts linked"
      : goal.accounts.length === 1
        ? goal.accounts[0].name
        : `${goal.accounts[0].name} +${goal.accounts.length - 1} more`;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        goal.isCompleted && "ring-2 ring-green-500/50"
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: goal.color || "#22c55e" }}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
              className={cn(
                "h-full rounded-full transition-all duration-500",
                getProgressColor(goal.percentage)
              )}
              style={{ width: `${Math.min(goal.percentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">From accounts</p>
            <p className="font-semibold text-lg">
              {formatCurrency(goal.currentAmount, displayCurrency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-semibold text-lg">
              {formatCurrency(goal.targetAmount, displayCurrency)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium">
            {formatCurrency(Math.max(0, goal.remaining), displayCurrency)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={goal.accounts.map((a) => a.name).join(", ")}>
            {accountLabel}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex justify-between items-center text-sm text-muted-foreground">
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

        {goal.monthlyTarget && goal.monthlyTarget > 0 && !goal.isCompleted && (
          <div className="text-xs">
            ~{formatCurrency(goal.monthlyTarget, displayCurrency)}/month needed
          </div>
        )}
      </CardFooter>

      {goal.isCompleted && (
        <div className="absolute inset-0 bg-green-500/5 pointer-events-none flex items-center justify-center">
          <div className="text-4xl animate-bounce">🎉</div>
        </div>
      )}
    </Card>
  );
}
