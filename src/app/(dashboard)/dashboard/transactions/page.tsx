"use client";

import { getAccounts } from "@/actions/account-actions";
import { getTransactions } from "@/actions/transaction-actions";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import {
  FilterOptions,
  TransactionFilters,
} from "@/components/transactions/TransactionFilters";
import {
  Transaction,
  TransactionTable,
} from "@/components/transactions/TransactionTable";
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [isLoading, setIsLoading] = useState(true);

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
    // TODO: Open edit dialog
    console.log("Edit transaction:", transaction);
  };

  const handleDelete = async (id: string) => {
    // TODO: Implement delete with confirmation
    console.log("Delete transaction:", id);
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
    </div>
  );
}
