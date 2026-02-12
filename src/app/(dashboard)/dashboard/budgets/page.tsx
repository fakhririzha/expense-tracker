"use client";

import { getBudgetsSummary, getBudgetVsActual, BudgetWithProgress } from "@/actions/budget-actions";
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
import { useEffect, useState } from "react";

interface BudgetVsActual {
  budgetId: string | null;
  budgetName: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  budgeted: number;
  actual: number;
  variance: number;
  percentageUsed: number;
  isOverBudget: boolean;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [comparisonData, setComparisonData] = useState<BudgetVsActual[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithProgress | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaryResult, comparisonResult] = await Promise.all([
        getBudgetsSummary(),
        getBudgetVsActual(),
      ]);

      if (summaryResult.success && summaryResult.data) {
        setBudgets(summaryResult.data);
      }

      if (comparisonResult.success && comparisonResult.data) {
        setComparisonData(comparisonResult.data);
      }
    } catch (error) {
      console.error("Failed to load budgets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (budget: BudgetWithProgress) => {
    setEditingBudget(budget);
    setIsEditDialogOpen(true);
  };

  // Calculate summary statistics
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = budgets.reduce((sum, b) => sum + b.remaining, 0);
  const overBudgetCount = budgets.filter((b) => b.percentage >= 100).length;

  // Filter budgets by period
  const filteredBudgets = periodFilter === "all"
    ? budgets
    : budgets.filter((b) => b.period === periodFilter);

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
        <AddBudgetDialog onSuccess={loadData} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div>
            <p className="text-xs text-muted-foreground">
              {budgets.length} active budgets
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
              <SelectTrigger className="w-[180px]">
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
                <AddBudgetDialog onSuccess={loadData} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  onEdit={handleEdit}
                  onDelete={loadData}
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
            <BudgetVsActualChart data={comparisonData} />
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditBudgetDialog
        budget={editingBudget}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={loadData}
      />
    </div>
  );
}
