"use client";

import {
  type OnChangeFn,
  type SortingState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  ArrowUpDown,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSplitSummary } from "@/lib/transaction-allocation-service";
import { formatCurrency } from "@/lib/utils";
import {
  TRANSACTION_PAGE_SIZES,
  type TransactionListItem,
} from "@/types/transaction-list";

export type Transaction = TransactionListItem;

interface TransactionTableProps {
  transactions: Transaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sorting: SortingState;
  isPagePending?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortingChange: (sorting: SortingState) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
}

/**
 * Render an interactive transaction table with server-driven sorting and pagination.
 *
 * @param transactions - The current page of transactions to display.
 * @param page - The current 1-based page index.
 * @param pageSize - The current page size.
 * @param total - The total number of matching transactions across all pages.
 * @param totalPages - The total number of available pages.
 * @param sorting - The current server-side sorting state.
 * @param isPagePending - Whether the table is waiting for a newly requested page.
 * @param onPageChange - Callback invoked when the requested page changes.
 * @param onPageSizeChange - Callback invoked when the page size changes.
 * @param onSortingChange - Callback invoked when the sort order changes.
 * @param onEdit - Optional callback invoked with the full transaction when the user chooses "Edit".
 * @param onDelete - Optional callback invoked with the transaction id when the user chooses "Delete".
 * @returns The rendered transaction table element.
 */
export function TransactionTable({
  transactions,
  page,
  pageSize,
  total,
  totalPages,
  sorting,
  isPagePending = false,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return format(new Date(row.getValue("date")), "MMM dd, yyyy");
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return (
          <div className="flex items-center gap-2">
            {type === "INCOME" ? (
              <ArrowUpCircle className="h-4 w-4 text-green-500" />
            ) : type === "TRANSFER" ? (
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
            )}
            <Badge
              variant={
                type === "INCOME"
                  ? "default"
                  : type === "TRANSFER"
                    ? "secondary"
                    : "destructive"
              }
              className="capitalize"
            >
              {type.replace("_", " ")}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const transaction = row.original;
        const summary = getSplitSummary(transaction);
        if (!summary.isSplit) {
          const category = transaction.category;
          if (!category) return <span className="text-muted-foreground">-</span>;
          return (
            <div className="flex items-center gap-2">
              {category.icon && <span>{category.icon}</span>}
              <span>{category.name}</span>
            </div>
          );
        }

        const splitLines = transaction.splits.map((split) => ({
          id: split.id,
          label: split.category?.name || "Uncategorized",
          icon: split.category?.icon,
          amount: split.amount,
        }));

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">
                  <Badge variant="secondary">Split</Badge>
                  <div className="mt-1 text-sm">{summary.label}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="space-y-1">
                {splitLines.map((split) => (
                  <div key={split.id} className="flex items-center justify-between gap-4">
                    <span>
                      {split.icon ? `${split.icon} ` : ""}
                      {split.label}
                    </span>
                    <span>{formatCurrency(split.amount, transaction.currency)}</span>
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string | null;
        return description || <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => {
        const location = row.original.location;
        const latitude = row.original.latitude;
        const longitude = row.original.longitude;
        const googleMapsLink = row.original.googleMapsLink;

        if (!location && latitude == null && longitude == null && !googleMapsLink) {
          return <span className="text-muted-foreground">-</span>;
        }

        return (
          <div className="space-y-1">
            {location && <div className="max-w-55 truncate">{location}</div>}
            {(latitude != null || longitude != null) && (
              <div className="text-xs text-muted-foreground">
                {latitude != null ? latitude.toFixed(6) : "?"},{" "}
                {longitude != null ? longitude.toFixed(6) : "?"}
              </div>
            )}
            {googleMapsLink && (
              <a
                href={googleMapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open in Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "account",
      header: "Account",
      cell: ({ row }) => {
        const account = row.original.account;
        const toAccount = row.original.toAccount;
        if (row.original.type === "TRANSFER" && toAccount) {
          return (
            <div>
              <p>{account.name}</p>
              <p className="text-xs text-muted-foreground">
                to {toAccount.name}
              </p>
            </div>
          );
        }

        return account.name;
      },
    },
    {
      accessorKey: "amount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-full justify-end"
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        const currency = row.original.currency;
        const type = row.original.type;
        const formatted = formatCurrency(amount, currency);

        return (
          <div
            className={`text-right font-medium ${
              type === "INCOME"
                ? "text-green-600"
                : type === "TRANSFER"
                  ? "text-muted-foreground"
                  : "text-red-600"
            }`}
          >
            {type === "INCOME" ? "+" : type === "TRANSFER" ? "" : "-"}
            {formatted}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const transaction = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={transaction.isManagedByDeposito}
                onClick={() => onEdit?.(transaction)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={transaction.isManagedByDeposito}
                onClick={() => onDelete?.(transaction.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
              {transaction.isManagedByDeposito ? (
                <DropdownMenuItem disabled>
                  Managed by Deposito Tracker
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const nextSorting = typeof updater === "function" ? updater(sorting) : updater;
    onSortingChange(nextSorting);
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: Math.max(page - 1, 0),
        pageSize,
      },
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    enableSortingRemoval: false,
  });

  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startRow}-{endRow} of {total} transactions
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={isPagePending}
            >
              <SelectTrigger className="w-22">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={isPagePending || page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={isPagePending || page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
