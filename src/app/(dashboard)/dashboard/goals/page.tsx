"use client";

import { GoalWithProgress } from "@/actions/goal-actions";
import { AddGoalDialog } from "@/components/goals/AddGoalDialog";
import { EditGoalDialog } from "@/components/goals/EditGoalDialog";
import { GoalCard } from "@/components/goals/GoalCard";
import { AddProgressDialog } from "@/components/goals/AddProgressDialog";
import { GoalSummary } from "@/components/goals/GoalSummary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useGoalsSummary, useGoalsStats } from "@/hooks/useGoalQueries";

type SortOption = "progress" | "targetDate" | "amount" | "name";
type FilterOption = "all" | "inProgress" | "completed";

/**
 * Renders the "Savings Goals" dashboard page with goal list, summary, filters, sorting, and dialogs.
 *
 * @returns The JSX element for the Savings Goals dashboard.
 */
export default function GoalsPage() {
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [progressGoal, setProgressGoal] = useState<GoalWithProgress | null>(null);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("progress");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  const { data: goals = [], isLoading } = useGoalsSummary();
  const { data: stats = { totalSaved: 0, totalTarget: 0, inProgressCount: 0, completedCount: 0, totalGoals: 0 } } = useGoalsStats();

  const handleEdit = (goal: GoalWithProgress) => {
    setEditingGoal(goal);
    setIsEditDialogOpen(true);
  };

  const handleAddProgress = (goal: GoalWithProgress) => {
    setProgressGoal(goal);
    setIsProgressDialogOpen(true);
  };

  // Filter and sort goals
  const sortedGoals = useMemo(() => {
    const filtered = (goals as GoalWithProgress[]).filter((goal) => {
      switch (filterBy) {
        case "inProgress": return !goal.isCompleted;
        case "completed": return goal.isCompleted;
        default: return true;
      }
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "progress": return b.percentage - a.percentage;
        case "targetDate":
          if (!a.targetDate && !b.targetDate) return 0;
          if (!a.targetDate) return 1;
          if (!b.targetDate) return -1;
          return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
        case "amount": return b.targetAmount - a.targetAmount;
        case "name": return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
  }, [goals, filterBy, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">
            Track your progress towards financial goals
          </p>
        </div>
        <AddGoalDialog onSuccess={() => {}} />
      </div>

      {/* Summary Cards */}
      <GoalSummary
        totalSaved={stats.totalSaved}
        totalTarget={stats.totalTarget}
        inProgressCount={stats.inProgressCount}
        completedCount={stats.completedCount}
        totalGoals={stats.totalGoals}
      />

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <Select
            value={filterBy}
            onValueChange={(value) => setFilterBy(value as FilterOption)}
          >
            <SelectTrigger className="w-37.5">
              <SelectValue placeholder="Filter goals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Goals</SelectItem>
              <SelectItem value="inProgress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as SortOption)}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="progress">By Progress</SelectItem>
            <SelectItem value="targetDate">By Target Date</SelectItem>
            <SelectItem value="amount">By Amount</SelectItem>
            <SelectItem value="name">By Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Goals Grid */}
      {sortedGoals.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-lg font-medium">No goals found</h3>
          <p className="text-muted-foreground mt-1">
            {filterBy === "all"
              ? "Create your first savings goal to start tracking your progress."
              : filterBy === "inProgress"
              ? "No goals in progress. Create a new goal to get started."
              : "No completed goals yet. Keep saving!"}
          </p>
          {filterBy === "all" && (
            <div className="mt-4">
              <AddGoalDialog onSuccess={() => {}} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={handleEdit}
              onAddProgress={handleAddProgress}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <EditGoalDialog
        goal={editingGoal}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {}}
      />

      {/* Progress Dialog */}
      <AddProgressDialog
        goal={progressGoal}
        open={isProgressDialogOpen}
        onOpenChange={setIsProgressDialogOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}