"use client";

import {
    ColumnDef,
    SortingState,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercentage } from "@/lib/utils";

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
  currentPrice: number;
  previousClose: number;
  currentValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

interface PortfolioTableProps {
  assets: PortfolioAsset[];
  displayCurrency?: string;
}

export function PortfolioTable({
  assets,
  displayCurrency = "USD",
}: PortfolioTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<PortfolioAsset>[] = [
    {
      accessorKey: "symbol",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Symbol
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <div>
            <div className="font-medium">{row.getValue("symbol")}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.name}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        return quantity.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        });
      },
    },
    {
      accessorKey: "avgBuyPrice",
      header: "Avg Cost",
      cell: ({ row }) => {
        const price = row.getValue("avgBuyPrice") as number;
        const currency = row.original.currency;
        return formatCurrency(price, currency);
      },
    },
    {
      accessorKey: "currentPrice",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Current Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const price = row.getValue("currentPrice") as number;
        const currency = row.original.currency;
        const dayChangePercent = row.original.dayChangePercent;
        const isPositive = dayChangePercent >= 0;

        return (
          <div>
            <div>{formatCurrency(price, currency)}</div>
            <div
              className={`text-sm flex items-center gap-1 ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercentage(dayChangePercent)}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "currentValue",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="justify-end w-full"
          >
            Market Value
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.getValue("currentValue") as number;
        return (
          <div className="text-right font-medium">
            {formatCurrency(value, displayCurrency)}
          </div>
        );
      },
    },
    {
      accessorKey: "unrealizedPnL",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="justify-end w-full"
          >
            P&L
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const pnl = row.getValue("unrealizedPnL") as number;
        const pnlPercent = row.original.unrealizedPnLPercent;
        const isPositive = pnl >= 0;

        return (
          <div className="text-right">
            <div
              className={`font-medium ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {formatCurrency(pnl, displayCurrency)}
            </div>
            <div
              className={`text-sm ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatPercentage(pnlPercent)}
            </div>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: assets,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

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
            {table.getRowModel().rows?.length ? (
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
                  No investments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
