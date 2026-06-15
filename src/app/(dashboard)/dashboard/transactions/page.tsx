"use client";

import { type SortingState } from "@tanstack/react-table";
import { format as formatDate, parseISO } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDeleteTransaction, useTransactions } from "@/hooks/useTransactionQueries";
import { useAccounts } from "@/hooks/useAccountQueries";
import { useCategories } from "@/hooks/useCategoryQueries";
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
import {
  DEFAULT_TRANSACTION_PAGE,
  DEFAULT_TRANSACTION_PAGE_SIZE,
  TRANSACTION_PAGE_SIZES,
  type TransactionListQueryParams,
  type TransactionSortField,
  type TransactionSortOrder,
} from "@/types/transaction-list";

const DEFAULT_SORT_BY: TransactionSortField = "date";
const DEFAULT_SORT_ORDER: TransactionSortOrder = "desc";

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateParam(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatSearchDate(value?: Date) {
  return value ? formatDate(value, "yyyy-MM-dd") : undefined;
}

function buildUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Render the Transactions page, including URL-backed filters, a paginated transactions table,
 * and dialogs for adding, editing, and deleting transactions.
 *
 * @returns The rendered Transactions page element.
 */
export default function TransactionsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const filters = useMemo<FilterOptions>(() => {
    const type = searchParams.get("type");
    return {
      type:
        type === "INCOME" || type === "EXPENSE" || type === "TRANSFER"
          ? type
          : undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      accountId: searchParams.get("accountId") || undefined,
      startDate: parseDateParam(searchParams.get("startDate")),
      endDate: parseDateParam(searchParams.get("endDate")),
    };
  }, [searchParams]);

  const page = useMemo(
    () => parsePositiveInteger(searchParams.get("page"), DEFAULT_TRANSACTION_PAGE),
    [searchParams]
  );
  const pageSize = useMemo(() => {
    const parsed = parsePositiveInteger(
      searchParams.get("pageSize"),
      DEFAULT_TRANSACTION_PAGE_SIZE
    );

    return TRANSACTION_PAGE_SIZES.includes(
      parsed as (typeof TRANSACTION_PAGE_SIZES)[number]
    )
      ? parsed
      : DEFAULT_TRANSACTION_PAGE_SIZE;
  }, [searchParams]);
  const sortBy = useMemo<TransactionSortField>(() => {
    return searchParams.get("sortBy") === "amount" ? "amount" : DEFAULT_SORT_BY;
  }, [searchParams]);
  const sortOrder = useMemo<TransactionSortOrder>(() => {
    return searchParams.get("sortOrder") === "asc" ? "asc" : DEFAULT_SORT_ORDER;
  }, [searchParams]);
  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );

  const transactionQueryParams = useMemo<TransactionListQueryParams>(
    () => ({
      ...filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    }),
    [filters, page, pageSize, sortBy, sortOrder]
  );

  const { data: transactionPage, isLoading } = useTransactions(transactionQueryParams);
  const { data: accountsData = [] } = useAccounts();
  const { data: categoriesData = [] } = useCategories();
  const deleteMutation = useDeleteTransaction();

  const replaceSearchParams = useCallback(
    (
      updates: Record<string, string | undefined>,
      options?: { resetPage?: boolean }
    ) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (options?.resetPage) {
        nextParams.delete("page");
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          nextParams.delete(key);
          return;
        }

        nextParams.set(key, value);
      });

      router.replace(buildUrl(pathname, nextParams), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const accounts = useMemo(
    () => accountsData.map((account: { id: string; name: string }) => ({
      id: account.id,
      name: account.name,
    })),
    [accountsData]
  );
  const categories = useMemo(
    () =>
      categoriesData.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
      })),
    [categoriesData]
  );

  useEffect(() => {
    if (!transactionPage || transactionPage.page === page) {
      return;
    }

    replaceSearchParams({
      page:
        transactionPage.page === DEFAULT_TRANSACTION_PAGE
          ? undefined
          : String(transactionPage.page),
    });
  }, [page, replaceSearchParams, transactionPage]);

  const handleFiltersChange = (nextFilters: FilterOptions) => {
    replaceSearchParams(
      {
        type: nextFilters.type,
        categoryId: nextFilters.categoryId,
        accountId: nextFilters.accountId,
        startDate: formatSearchDate(nextFilters.startDate),
        endDate: formatSearchDate(nextFilters.endDate),
      },
      { resetPage: true }
    );
  };

  const handlePageChange = (nextPage: number) => {
    replaceSearchParams({
      page:
        nextPage <= DEFAULT_TRANSACTION_PAGE ? undefined : String(nextPage),
    });
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    replaceSearchParams(
      {
        pageSize:
          nextPageSize === DEFAULT_TRANSACTION_PAGE_SIZE
            ? undefined
            : String(nextPageSize),
      },
      { resetPage: true }
    );
  };

  const handleSortingChange = (nextSorting: SortingState) => {
    const nextSort = nextSorting[0];
    const nextSortBy: TransactionSortField =
      nextSort?.id === "amount" ? "amount" : DEFAULT_SORT_BY;
    const nextSortOrder: TransactionSortOrder = nextSort?.desc ? "desc" : "asc";

    replaceSearchParams(
      {
        sortBy: nextSortBy === DEFAULT_SORT_BY ? undefined : nextSortBy,
        sortOrder: nextSortOrder === DEFAULT_SORT_ORDER ? undefined : nextSortOrder,
      },
      { resetPage: true }
    );
  };

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

  const transactions = transactionPage?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-md:flex-col max-md:gap-y-4">
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
            onFiltersChange={handleFiltersChange}
          />
          <AddTransactionDialog onSuccess={() => {}} />
        </div>
      </div>

      {isLoading && !transactionPage ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          page={transactionPage?.page ?? page}
          pageSize={transactionPage?.pageSize ?? pageSize}
          total={transactionPage?.total ?? 0}
          totalPages={transactionPage?.totalPages ?? 1}
          sorting={sorting}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSortingChange={handleSortingChange}
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
