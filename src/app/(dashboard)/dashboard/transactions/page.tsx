"use client";

import { getAccounts } from "@/actions/account-actions";
import { deleteTransaction, getTransactions } from "@/actions/transaction-actions";
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
import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Account {
  id: string;
  name: string;
}

/**
 * Render the Transactions page, including filters, a transactions table, and dialogs for adding, editing, and deleting transactions.
 *
 * Loads transactions and accounts based on current filter options, derives unique categories from loaded transactions, and exposes handlers to open edit and delete flows. After create/edit/delete actions the data is refreshed by re-applying the current filters.
 *
 * @returns The rendered Transactions page element.
 */
export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [txResult, accountsResult] = await Promise.all([
          getTransactions({
            type: filters.type,
            categoryId: filters.categoryId,
            accountId: filters.accountId,
            startDate: filters.startDate,
            endDate: filters.endDate,
          }),
          getAccounts(),
        ]);

        if (txResult.success && txResult.data) {
          setTransactions(txResult.data as Transaction[]);
          // Extract unique categories from transactions
          const uniqueCategories = new Map<string, Category>();
          txResult.data.forEach((tx: Transaction) => {
            if (tx.category) {
              uniqueCategories.set(tx.category.id, tx.category);
            }
          });
          setCategories(Array.from(uniqueCategories.values()));
        }

        if (accountsResult.success && accountsResult.data) {
          setAccounts(
            accountsResult.data.map((a: { id: string; name: string }) => ({
              id: a.id,
              name: a.name,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [filters]);

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

    setIsDeleting(true);
    try {
      const result = await deleteTransaction(deletingTransactionId);
      if (result.success) {
        setFilters({ ...filters });
        setIsDeleteDialogOpen(false);
        setDeletingTransactionId(null);
      } else {
        console.error("Failed to delete transaction:", result.error);
      }
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage your income and expenses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TransactionFilters
            categories={categories}
            accounts={accounts}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <AddTransactionDialog
            onSuccess={() => {
              // Reload data after successful creation
              setFilters({ ...filters });
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <EditTransactionDialog
        transaction={editingTransaction}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          setFilters({ ...filters });
        }}
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
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}