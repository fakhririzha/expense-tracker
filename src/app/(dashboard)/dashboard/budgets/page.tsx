"use client";

import { BudgetVsActualItem, BudgetWithProgress } from "@/actions/budget-actions";
import { AddBudgetDialog } from "@/components/budgets/AddBudgetDialog";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { BudgetProgress } from "@/components/budgets/BudgetProgress";
import { EditBudgetDialog } from "@/components/budgets/EditBudgetDialog";
import { BudgetVsActualChart } from "@/components/budgets/BudgetVsActualChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react";
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

  const { data: budgets = [], isLoading } = useBudgetsSummary();
  const { data: comparisonData = [] } = useBudgetVsActual();

  const handleEdit = (budget: BudgetWithProgress) => {
    setEditingBudget(budget);
    setIsEditDialogOpen(true);
  };

  // Calculate summary statistics
  const totalBudgeted = (budgets as BudgetWithProgress[]).reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = (budgets as BudgetWithProgress[]).reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = (budgets as BudgetWithProgress[]).reduce((sum, b) => sum + b.remaining, 0);
  const overBudgetCount = (budgets as BudgetWithProgress[]).filter((b) => b.percentage >= 100).length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">
            Track and manage your spending budgets
          </p>
        </div>
        <AddBudgetDialog onSuccess={() => {}} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div>
            <p className="text-xs text-muted-foreground">
              {(budgets as BudgetWithProgress[]).length} active budgets
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              {totalBudgeted > 0
                ? `${((totalSpent / totalBudgeted) * 100).toFixed(0)}% of budget`
                : "0% of budget"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalRemaining < 0 ? "text-destructive" : ""
              }`}
            >
              {formatCurrency(Math.abs(totalRemaining))}
              {totalRemaining < 0 && (
                <span className="text-sm font-normal"> over</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRemaining >= 0 ? "Under budget" : "Over budget"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overBudgetCount > 0 ? overBudgetCount : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              {overBudgetCount > 0
                ? "budgets exceeded"
                : "all budgets on track"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Budget Cards and Chart */}
      <Tabs defaultValue="budgets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="comparison">Budget vs Actual</TabsTrigger>
        </TabsList>

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
          ) : filteredBudgets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No budgets found</h3>
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
