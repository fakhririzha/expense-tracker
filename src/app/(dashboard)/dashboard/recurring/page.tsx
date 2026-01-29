"use client";

import { deleteRecurringRule, getRecurringRules } from "@/actions/recurring-actions";
import { AddRecurringRuleDialog } from "@/components/recurring/AddRecurringRuleDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: string;
  interval: string;
  nextDueDate: Date;
  endDate: Date | null;
  isActive: boolean;
  description: string | null;
  categoryId: string | null;
  accountId: string | null;
}

const INTERVAL_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
};

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await getRecurringRules();
      if (result.success && result.data) {
        setRules(result.data as RecurringRule[]);
      }
    } catch (error) {
      console.error("Failed to load recurring rules:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    const result = await deleteRecurringRule(id);
    if (result.success) {
      loadData();
    } else {
      alert(result.error || "Failed to delete recurring rule");
    }
  };

  const activeRules = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recurring Transactions</h1>
          <p className="text-muted-foreground">
            Manage your recurring income and expenses
          </p>
        </div>
        <AddRecurringRuleDialog onSuccess={loadData} />
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeRules.length}</div>
          <p className="text-xs text-muted-foreground">
            {inactiveRules.length} inactive
          </p>
        </CardContent>
      </Card>

      {/* Active Rules Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Active Recurring Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRules.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        No active recurring rules. Create one to automate your
                        transactions.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {rule.name}
                          {rule.description && (
                            <p className="text-sm text-muted-foreground">
                              {rule.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              rule.type === "INCOME"
                                ? "bg-green-100 text-green-700"
                                : rule.type === "EXPENSE"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {TYPE_LABELS[rule.type] || rule.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          {INTERVAL_LABELS[rule.interval] || rule.interval}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              rule.type === "INCOME"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {formatCurrency(rule.amount, rule.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(rule.nextDueDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {rule.endDate
                            ? format(new Date(rule.endDate), "MMM d, yyyy")
                            : "No end date"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // TODO: Open edit dialog
                                console.log("Edit rule:", rule);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(rule.id, rule.name)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Inactive Rules */}
          {inactiveRules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Inactive Recurring Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Last Due</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveRules.map((rule) => (
                      <TableRow key={rule.id} className="opacity-60">
                        <TableCell className="font-medium">
                          {rule.name}
                        </TableCell>
                        <TableCell>
                          {TYPE_LABELS[rule.type] || rule.type}
                        </TableCell>
                        <TableCell>
                          {INTERVAL_LABELS[rule.interval] || rule.interval}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rule.amount, rule.currency)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(rule.nextDueDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule.id, rule.name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
