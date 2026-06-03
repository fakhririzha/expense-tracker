"use client";

import { CategoryDialog, AddCategoryButton } from "@/components/categories/CategoryDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategories, useDeleteCategory } from "@/hooks/useCategoryQueries";
import type { CategoryListItem } from "@/actions/category-actions";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const TYPE_LABELS: Record<"INCOME" | "EXPENSE", string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
};

function getUsageCount(category: CategoryListItem) {
  return category.transactionCount + category.budgetCount + category.recurringRuleCount;
}

function CategoryIcon({ category }: { category: CategoryListItem }) {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-lg shadow-sm"
      style={{
        backgroundColor: category.color ? `${category.color}1a` : "hsl(var(--muted))",
        color: category.color || "hsl(var(--foreground))",
      }}
    >
      {category.icon || "•"}
    </div>
  );
}

export default function CategoriesPage() {
  const [filter, setFilter] = useState<"all" | "INCOME" | "EXPENSE">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryListItem | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const deleteMutation = useDeleteCategory();

  const { data: categories = [], isLoading } = useCategories();

  const filteredCategories = useMemo(() => {
    if (filter === "all") return categories as CategoryListItem[];
    return (categories as CategoryListItem[]).filter((category) => category.type === filter);
  }, [categories, filter]);

  const summary = useMemo(() => {
    const list = categories as CategoryListItem[];
    return {
      total: list.length,
      income: list.filter((category) => category.type === "INCOME").length,
      expense: list.filter((category) => category.type === "EXPENSE").length,
      used: list.filter((category) => getUsageCount(category) > 0).length,
    };
  }, [categories]);

  const handleEdit = (category: CategoryListItem) => {
    setEditingCategory(category);
    setEditingOpen(true);
  };

  const handleDelete = async (category: CategoryListItem) => {
    const usageCount = getUsageCount(category);

    const message =
      usageCount > 0
        ? `Delete "${category.name}"? This will detach it from ${category.transactionCount} transaction(s), ${category.budgetCount} budget(s), and ${category.recurringRuleCount} recurring rule(s).`
        : `Delete "${category.name}"? This cannot be undone.`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(category.id);
      if (editingCategory?.id === category.id) {
        setEditingOpen(false);
        setEditingCategory(null);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete category");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground">
            Manage the labels used across transactions, budgets, and recurring rules.
          </p>
        </div>
        <AddCategoryButton onClick={() => setCreateOpen(true)} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Across income and expense</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.expense}</div>
            <p className="text-xs text-muted-foreground">Used in budgets and spending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Income Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.income}</div>
            <p className="text-xs text-muted-foreground">Used for income tracking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Use</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.used}</div>
            <p className="text-xs text-muted-foreground">Referenced by your data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>All Categories</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit your defaults or create new categories for your workflows.
            </p>
          </div>
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as "all" | "INCOME" | "EXPENSE")}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <p className="text-lg font-medium">No categories found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === "all"
                  ? "Create your first category to start organizing transactions."
                  : `No ${TYPE_LABELS[filter]} categories match this filter.`}
              </p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                Create Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => {
                  const usageCount = getUsageCount(category);
                  return (
                    <TableRow key={category.id}>
                      <TableCell>
                        <CategoryIcon category={category} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{category.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {category.color || "No color set"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={category.type === "EXPENSE" ? "destructive" : "secondary"}
                        >
                          {TYPE_LABELS[category.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{usageCount}</span>{" "}
                          <span className="text-muted-foreground">reference(s)</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={category.isSystem ? "default" : "outline"}>
                          {category.isSystem ? "Seeded" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(category)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CategoryDialog
        category={null}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />

      <CategoryDialog
        category={editingCategory}
        open={editingOpen}
        onOpenChange={(open) => {
          setEditingOpen(open);
          if (!open) {
            setEditingCategory(null);
          }
        }}
        onSuccess={() => setEditingCategory(null)}
      />
    </div>
  );
}
