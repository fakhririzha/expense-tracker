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
import { ArrowUpDown, Eye, Info, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatInvestmentQuantity } from "@/lib/investment-quantity";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { UnitType } from "@/generated/prisma/client/client";
import { TradeHistoryDialog } from "./TradeHistoryDialog";

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
  unitType: UnitType;
  unitLabel: string;
  realizedPnL: number;
}

interface PortfolioTableProps {
  assets: PortfolioAsset[];
  displayCurrency?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}

/**
 * Render a sortable, paginated table of portfolio assets.
 *
 * @param assets - Array of portfolio assets to display in the table
 * @param displayCurrency - ISO currency code used to format market value and P&L columns (default: "IDR")
 * @param onRefresh - Optional callback to refresh prices
 * @param isRefreshing - Whether prices are being refreshed
 * @param lastUpdated - Last update time for prices
 * @returns The rendered portfolio table React element
 */
export function PortfolioTable({
  assets,
  displayCurrency = "IDR",
  onRefresh,
  isRefreshing = false,
  lastUpdated,
}: PortfolioTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleViewTradeHistory = (asset: PortfolioAsset) => {
    setSelectedAsset(asset);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAsset(null);
  };

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
        const isSold = row.original.quantity === 0;
        return (
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium">{row.getValue("symbol")}</div>
              <div className="text-sm text-muted-foreground">
                {row.original.name}
              </div>
            </div>
            {isSold && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                Fully Sold
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        const unitLabel = row.original.unitLabel;
        const isNonUnit = row.original.unitType !== "UNIT";
        
        return (
          <div className="flex items-center gap-1">
            <span>{formatInvestmentQuantity(quantity)}</span>
            {isNonUnit && (
              <span className="text-muted-foreground text-sm">
                {unitLabel}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "avgBuyPrice",
      header: "Avg Cost",
      cell: ({ row }) => {
        const price = row.getValue("avgBuyPrice") as number;
        const currency = row.original.currency;
        const unitLabel = row.original.unitLabel;
        const isNonUnit = row.original.unitType !== "UNIT";
        
        return (
          <div>
            <span>{formatCurrency(price, currency)}</span>
            {isNonUnit && (
              <span className="text-muted-foreground text-sm">/{unitLabel}</span>
            )}
          </div>
        );
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
        const isSold = row.original.quantity === 0;
        const price = row.getValue("currentPrice") as number;
        const currency = row.original.currency;
        const dayChangePercent = row.original.dayChangePercent;
        const isPositive = dayChangePercent >= 0;
        const unitLabel = row.original.unitLabel;
        const isNonUnit = row.original.unitType !== "UNIT";

        // For sold assets, show dash
        if (isSold) {
          return (
            <div className="text-muted-foreground">
              —
            </div>
          );
        }

        return (
          <div>
            <div className="flex items-center gap-1">
              <span>{formatCurrency(price, currency)}</span>
              {isNonUnit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground text-sm flex items-center">
                        /{unitLabel}
                        <Info className="h-3 w-3 ml-1" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Precious metal prices are converted from troy ounces</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
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
        const isSold = row.original.quantity === 0;
        const value = row.getValue("currentValue") as number;
        
        // For sold assets, show dash instead of 0
        if (isSold) {
          return (
            <div className="text-right font-medium text-muted-foreground">
              —
            </div>
          );
        }
        
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
        const isSold = row.original.quantity === 0;
        const unrealizedPnl = row.getValue("unrealizedPnL") as number;
        const unrealizedPnlPercent = row.original.unrealizedPnLPercent;
        const realizedPnl = row.original.realizedPnL;
        
        // For sold assets, show realized PnL; for active assets, show unrealized PnL
        const pnl = isSold ? realizedPnl : unrealizedPnl;
        const pnlPercent = isSold ? null : unrealizedPnlPercent;
        const isPositive = pnl >= 0;
        const pnlLabel = isSold ? "Realized" : "Unrealized";

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
              {pnlPercent !== null ? formatPercentage(pnlPercent) : pnlLabel}
            </div>
          </div>
        );
      },
    },
    {
      id: "tradeHistory",
      header: "Trade History",
      cell: ({ row }) => {
        const asset = row.original;
        return (
          <div className="text-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewTradeHistory(asset)}
              title="View trade history"
              aria-label="View trade history"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
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
      {onRefresh && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {lastUpdated && (
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Prices
          </Button>
        </div>
      )}
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
              table.getRowModel().rows.map((row) => {
                const isSold = row.original.quantity === 0;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={isSold ? "bg-muted/30 opacity-70" : ""}
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
                );
              })
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

      <TradeHistoryDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        assetId={selectedAsset?.id || null}
        assetSymbol={selectedAsset?.symbol || ""}
        assetName={selectedAsset?.name || null}
        assetCurrency={selectedAsset?.currency || displayCurrency}
      />
    </div>
  );
}