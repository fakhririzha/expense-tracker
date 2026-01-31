/**
 * Trade history type definitions for the investments dashboard.
 */

/**
 * Represents a single trade record in the trade history.
 */
export interface TradeHistoryItem {
  id: string;
  type: "BUY" | "SELL";
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  fees: number;
  date: string; // ISO 8601 date string
  notes: string | null;
  realizedPnL: number | null;
  assetId: string;
  userId: string;
  // Account linkage for audit trail
  accountId: string | null;
  account?: {
    id: string;
    name: string;
    currency: string;
  } | null;
  // Audit trail fields
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    symbol: string;
    name: string | null;
    currency: string;
  };
}

/**
 * API response for fetching trade history.
 */
export interface TradeHistoryResponse {
  trades: TradeHistoryItem[];
}

/**
 * Query parameters for filtering and sorting trade history.
 */
export interface TradeHistoryQuery {
  assetId?: string;
  type?: "BUY" | "SELL" | "ALL";
  sortBy?: "date" | "type" | "quantity" | "pricePerUnit" | "totalAmount" | "fees";
  sortOrder?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
}

/**
 * Form data for creating a new trade record.
 */
export interface TradeFormData {
  assetId: string;
  type: "BUY" | "SELL";
  quantity: number;
  pricePerUnit: number;
  fees: number;
  date: Date;
  notes?: string;
  accountId: string; // Required investment account for the transaction
}

/**
 * Form data for creating a new investment asset (buy transaction).
 */
export interface InvestmentAssetFormData {
  symbol: string;
  name?: string;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
  accountId: string; // Required investment account for the purchase
}
