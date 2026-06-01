"use client";

import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { EditAccountDialog } from "@/components/accounts/EditAccountDialog";
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
import { Pencil, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { useAccounts, useAccountsSummary, useDeleteAccount } from "@/hooks/useAccountQueries";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  description: string | null;
  isActive: boolean;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: "Bank Account",
  CASH: "Cash",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  CREDIT_CARD: "Credit Card",
};

/**
 * Renders the Accounts page with summary cards, an accounts table, and dialogs for adding, editing, and deleting accounts.
 *
 * @returns The React element for the Accounts management page.
 */
export default function AccountsPage() {
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: accounts = [], isLoading } = useAccounts();
  const { data: summary } = useAccountsSummary();
  const deleteMutation = useDeleteAccount();

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete account");
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your financial accounts
          </p>
        </div>
        <AddAccountDialog onSuccess={() => {}} />
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Assets
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalAssets, summary.displayCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Bank, Cash, Investments, Personal Assets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Liabilities
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totalLiabilities, summary.displayCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Loans, Credit Cards
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.netWorth, summary.displayCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Assets - Liabilities
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accounts Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(accounts as Account[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No accounts found. Create your first account to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  (accounts as Account[]).map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.name}
                        {account.description && (
                          <p className="text-sm text-muted-foreground">
                            {account.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                      </TableCell>
                      <TableCell>{account.currency}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            account.balance >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {formatCurrency(account.balance, account.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            account.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(account.id, account.name)}
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
      )}

      {/* Edit Account Dialog */}
      <EditAccountDialog
        account={editingAccount}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}
