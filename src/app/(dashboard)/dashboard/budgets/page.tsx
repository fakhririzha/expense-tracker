"use client";

import Link from "next/link";

import { BudgetVsActualItem, BudgetWithProgress } from "@/actions/budget-actions";
import { AddBudgetDialog } from "@/components/budgets/AddBudgetDialog";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { BudgetProgress } from "@/components/budgets/BudgetProgress";
import { EditBudgetDialog } from "@/components/budgets/EditBudgetDialog";
import { BudgetVsActualChart } from "@/components/budgets/BudgetVsActualChart";
import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Layers3, Loader2, TrendingDown, Wallet } from "lucide-react";
import { useState } from "react";
import { useBudgetsSummary, useBudgetVsActual } from "@/hooks/useBudgetQueries";

/**
 * Render the Budgets dashboard page with summaries, filters, and budget management UI.
 *
 * @returns The Budgets page React element
 */
export default function BudgetsPage() {
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithProgress | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  const { data: budgetSummary, isLoading } = useBudgetsSummary();
  const { data: comparisonData = [] } = useBudgetVsActual();
  const budgets = budgetSummary?.budgets ?? [];

  const handleEdit = (budget: BudgetWithProgress) => {
    setEditingBudget(budget);
    setIsEditDialogOpen(true);
  };

  const categoryBudgets = budgets.filter((budget) => budget.scope === "CATEGORIES");
  const legacyBudgetCount = budgets.length - categoryBudgets.length;
  const coveredCategoryCount = new Set(
    categoryBudgets.flatMap((budget) => budget.categoryIds)
  ).size;
  const nearLimitCount = budgets.filter(
    (budget) => budget.percentage >= 80 && budget.percentage < 100
  ).length;
  const overBudgetCount = budgets.filter((budget) => budget.percentage >= 100).length;

  // Filter budgets by period
  const filteredBudgets =
    periodFilter === "all"
      ? (budgets as BudgetWithProgress[])
      : (budgets as BudgetWithProgress[]).filter((b) => b.period === periodFilter);

  if (selectedBudget) {
    return (
      <div className="container mx-auto py-6">
        <BudgetProgress
          budget={selectedBudget}
          onBack={() => setSelectedBudget(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Category Budgets</h1>
          <p className="text-muted-foreground">
            Set focused limits for one or more expense categories
          </p>
        </div>
        <AddBudgetDialog onSuccess={() => {}} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overall monthly spending limit
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {isLoading
                ? "—"
                : budgetSummary?.overallMonthlySpendingLimit
                  ? formatCurrency(
                      budgetSummary.overallMonthlySpendingLimit,
                      budgetSummary.currency
                    )
                  : "Not set"}
            </div>
            {budgetSummary?.overallMonthlySpendingLimit ? (
              <p className="text-xs text-muted-foreground">
                Your guardrail across all spending this month
              </p>
            ) : !isLoading ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/profile">Set overall limit</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Category budgets</CardTitle>
            <Layers3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "—" : categoryBudgets.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {coveredCategoryCount} unique categories covered
              {legacyBudgetCount > 0
                ? ` • ${legacyBudgetCount} legacy all-spending rule(s)`
                : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near limit</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "—" : nearLimitCount}
            </div>
            <p className="text-xs text-muted-foreground">
              At 80% or more of their category limit
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceeded</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={overBudgetCount > 0 ? "text-2xl font-bold text-destructive" : "text-2xl font-bold"}>
              {isLoading ? "—" : overBudgetCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {overBudgetCount > 0 ? "Category limits exceeded" : "No limits exceeded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Budget Cards and Chart */}
      <Tabs defaultValue="budgets" className="space-y-4">
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="budgets">Category budgets</TabsTrigger>
            <TabsTrigger value="comparison">Category budget vs actual</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="budgets" className="space-y-4">
          {/* Period Filter */}
          <div className="flex items-center gap-4">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Budget Cards Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : budgets.length === 0 ? (
            <ContextualEmptyState
              title="Create your first category budget"
              description="Set a focused limit for one or more expense categories without changing your overall monthly spending limit."
              icon={<Wallet className="h-5 w-5" />}
              action={<AddBudgetDialog onSuccess={() => {}} />}
            />
          ) : filteredBudgets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No category budgets found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {periodFilter !== "all"
                    ? `No ${periodFilter.toLowerCase()} budgets. Try a different filter or create a new budget.`
                    : "Get started by creating your first budget."}
                </p>
                <AddBudgetDialog onSuccess={() => {}} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  onEdit={handleEdit}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <BudgetVsActualChart data={comparisonData as BudgetVsActualItem[]} />
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditBudgetDialog
        budget={editingBudget}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}
