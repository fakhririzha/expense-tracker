"use client";

import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog";
import {
  FilterOptions,
  TransactionFilters,
} from "@/components/transactions/TransactionFilters";
import {
  Transaction,
  TransactionTable,
} from "@/components/transactions/TransactionTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { useTransactions, useDeleteTransaction } from "@/hooks/useTransactionQueries";
import { useAccounts } from "@/hooks/useAccountQueries";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

/**
 * Render the Transactions page, including filters, a transactions table, and dialogs for adding, editing, and deleting transactions.
 *
 * @returns The rendered Transactions page element.
 */
export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: transactions = [], isLoading } = useTransactions(filters);
  const { data: accountsData = [] } = useAccounts();
  const deleteMutation = useDeleteTransaction();

  const accounts = useMemo(
    () => accountsData.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })),
    [accountsData]
  );

  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, Category>();
    (transactions as Transaction[]).forEach((tx) => {
      if (tx.category) {
        uniqueCategories.set(tx.category.id, tx.category);
      }
    });
    return Array.from(uniqueCategories.values());
  }, [transactions]);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingTransactionId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingTransactionId) return;
    try {
      await deleteMutation.mutateAsync(deletingTransactionId);
      setIsDeleteDialogOpen(false);
      setDeletingTransactionId(null);
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex max-md:flex-col max-md:gap-y-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage your income and expenses
          </p>
        </div>
        <div className="flex items-center gap-2 max-md:w-full">
          <TransactionFilters
            categories={categories}
            accounts={accounts}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <AddTransactionDialog onSuccess={() => {}} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions as Transaction[]}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <EditTransactionDialog
        transaction={editingTransaction}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {}}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action
              cannot be undone and will reverse the balance changes made by this
              transaction.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}