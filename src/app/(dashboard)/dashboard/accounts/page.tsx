"use client";

import Link from "next/link";

import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { EditAccountDialog } from "@/components/accounts/EditAccountDialog";
import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ACCOUNT_TYPE_LABELS, isDepositoAccountType } from "@/lib/account-types";
import { useAccounts, useAccountsSummary, useDeleteAccount } from "@/hooks/useAccountQueries";
import { formatCurrency } from "@/lib/utils";
import { Pencil, Trash2, Wallet } from "lucide-react";
import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  description: string | null;
  isActive: boolean;
}

const ACCOUNT_PAGE_SIZES = [10, 25, 50] as const;
type AccountPageSize = (typeof ACCOUNT_PAGE_SIZES)[number];
const DEFAULT_ACCOUNT_PAGE_SIZE = ACCOUNT_PAGE_SIZES[0];

interface AccountTableSectionProps {
  title: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptySearchMessage: string;
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (id: string, name: string) => void;
}

function AccountRows({
  accounts,
  onEdit,
  onDelete,
}: Pick<AccountTableSectionProps, "accounts" | "onEdit" | "onDelete">) {
  return accounts.map((account) => (
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
        {ACCOUNT_TYPE_LABELS[
          account.type as keyof typeof ACCOUNT_TYPE_LABELS
        ] || account.type}
      </TableCell>
      <TableCell>{account.currency}</TableCell>
      <TableCell className="text-right">
        <span
          className={
            account.balance >= 0 ? "text-green-600" : "text-red-600"
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
        {isDepositoAccountType(account.type) ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/deposito">Manage in Deposito</Link>
          </Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(account)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(account.id, account.name)}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  ));
}

function AccountTableSection({
  title,
  searchPlaceholder,
  emptyMessage,
  emptySearchMessage,
  accounts,
  onEdit,
  onDelete,
}: AccountTableSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<AccountPageSize>(
    DEFAULT_ACCOUNT_PAGE_SIZE
  );
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return accounts;
    }

    return accounts.filter((account) => {
      const typeLabel =
        ACCOUNT_TYPE_LABELS[
          account.type as keyof typeof ACCOUNT_TYPE_LABELS
        ] || account.type;
      const searchableValues = [
        account.name,
        account.description ?? "",
        account.currency,
        account.type,
        typeLabel,
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [accounts, deferredSearchQuery]);

  const total = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredAccounts, pageSize]);

  const startRow = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = total === 0 ? 0 : Math.min(currentPage * pageSize, total);
  const hasSearchQuery = deferredSearchQuery.trim().length > 0;

  let tableBody: ReactNode;

  if (accounts.length === 0) {
    tableBody = (
      <TableRow>
        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
          {emptyMessage}
        </TableCell>
      </TableRow>
    );
  } else if (paginatedAccounts.length === 0) {
    tableBody = (
      <TableRow>
        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
          {hasSearchQuery ? emptySearchMessage : emptyMessage}
        </TableCell>
      </TableRow>
    );
  } else {
    tableBody = (
      <AccountRows accounts={paginatedAccounts} onEdit={onEdit} onDelete={onDelete} />
    );
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
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
            <TableBody>{tableBody}</TableBody>
          </Table>
        </div>

        {total > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startRow}-{endRow} of {total} accounts
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value) as AccountPageSize);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-22">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {totalPages > 1 && (
                <>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((currentPage) => currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((currentPage) => currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const accountList = accounts as Account[];

  const activeAccounts = useMemo(
    () => accountList.filter((account) => account.isActive),
    [accountList]
  );
  const inactiveAccounts = useMemo(
    () => accountList.filter((account) => !account.isActive),
    [accountList]
  );

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
  const hasNoAccounts = !isLoading && accountList.length === 0;

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
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Assets
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.totalAssets === null
                  ? "Unavailable"
                  : formatCurrency(summary.totalAssets, summary.displayCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.valuationError
                  ? "Live investment valuation unavailable"
                  : "Bank, Cash, Deposito, Investments, Receivables, Personal Assets"}
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
                {summary.netWorth === null
                  ? "Unavailable"
                  : formatCurrency(summary.netWorth, summary.displayCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.valuationError
                  ? "Live investment valuation unavailable"
                  : "Assets - Liabilities"}
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
      ) : hasNoAccounts ? (
        <ContextualEmptyState
          title="Add your first account"
          description="Start by adding your main bank, cash, or investment account."
          icon={<Wallet className="h-5 w-5" />}
          action={<AddAccountDialog onSuccess={() => {}} />}
        />
      ) : (
        <>
          <AccountTableSection
            title="Active Accounts"
            searchPlaceholder="Search active accounts..."
            emptyMessage="No active accounts found. Create your first account to get started."
            emptySearchMessage="No active accounts match your search."
            accounts={activeAccounts}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          <AccountTableSection
            title="Inactive Accounts"
            searchPlaceholder="Search inactive accounts..."
            emptyMessage="No inactive accounts found."
            emptySearchMessage="No inactive accounts match your search."
            accounts={inactiveAccounts}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
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
