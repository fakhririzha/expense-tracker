"use client";

import { X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTradeHistory } from "@/hooks/useTradeHistory";

import { TradeHistoryTable } from "./TradeHistoryTable";

interface TradeHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string | null;
  assetSymbol: string;
  assetName: string | null;
  assetCurrency: string;
}

/**
 * Dialog component for displaying trade history of a specific investment asset.
 *
 * @param isOpen - Whether the dialog is currently visible
 * @param onClose - Callback to close the dialog
 * @param assetId - The ID of the investment asset to show history for
 * @param assetSymbol - The symbol of the asset (e.g., "AAPL")
 * @param assetName - The name of the asset (e.g., "Apple Inc.")
 * @param assetCurrency - The currency of the asset for price formatting
 */
export function TradeHistoryDialog({
  isOpen,
  onClose,
  assetId,
  assetSymbol,
  assetName,
  assetCurrency,
}: TradeHistoryDialogProps) {
  const { data: trades = [], isLoading, error } = useTradeHistory(assetId, {
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-xl font-bold">
              Trade History
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {assetSymbol}
              {assetName && assetName !== assetSymbol && (
                <span className="ml-2 text-muted-foreground/70">({assetName})</span>
              )}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[300px]">
          <TradeHistoryTable
            trades={trades}
            isLoading={isLoading}
            error={error}
            assetCurrency={assetCurrency}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
