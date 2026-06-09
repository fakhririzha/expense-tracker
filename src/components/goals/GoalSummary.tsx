"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/lib/utils";
import { PiggyBank, Target, CheckCircle2, TrendingUp } from "lucide-react";

interface GoalSummaryProps {
  totalSaved: number;
  totalTarget: number;
  inProgressCount: number;
  completedCount: number;
  totalGoals: number;
}

/**
 * Renders a summary card showing overview statistics for all savings goals.
 *
 * Displays total saved across all goals, number of goals in progress,
 * and number of completed goals with visual indicators.
 *
 * @param totalSaved - Total amount saved across all goals
 * @param totalTarget - Total target amount across all goals
 * @param inProgressCount - Number of goals still in progress
 * @param completedCount - Number of completed goals
 * @param totalGoals - Total number of goals
 * @returns The Goal Summary React element
 */
export function GoalSummary({
  totalSaved,
  totalTarget,
  inProgressCount,
  completedCount,
  totalGoals,
}: GoalSummaryProps) {
  const { mainCurrency } = useCurrency();
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {/* Total Saved */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalSaved, mainCurrency)}</div>
          <p className="text-xs text-muted-foreground">
            across {totalGoals} goal{totalGoals !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overallProgress.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            of {formatCurrency(totalTarget, mainCurrency)} total target
          </p>
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inProgressCount}</div>
          <p className="text-xs text-muted-foreground">
            goal{inProgressCount !== 1 ? "s" : ""} in progress
          </p>
        </CardContent>
      </Card>

      {/* Completed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          <p className="text-xs text-muted-foreground">
            goal{completedCount !== 1 ? "s" : ""} completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
