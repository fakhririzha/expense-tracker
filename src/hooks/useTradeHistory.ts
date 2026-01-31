import { TradeHistoryItem, TradeHistoryResponse } from "@/types/trade-history";
import { useQuery } from "@tanstack/react-query";

/**
 * Query key factory for trade history queries.
 */
export const tradeHistoryKeys = {
  all: ["tradeHistory"] as const,
  asset: (assetId: string) => [...tradeHistoryKeys.all, assetId] as const,
  filtered: (assetId: string, filters: Record<string, string>) =>
    [...tradeHistoryKeys.asset(assetId), filters] as const,
};

/**
 * Fetches trade history for a specific investment asset.
 * 
 * @param assetId - The ID of the investment asset
 * @returns Promise with trade history data
 */
async function fetchTradeHistory(
  assetId: string,
  options?: {
    type?: "BUY" | "SELL" | "ALL";
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
): Promise<TradeHistoryItem[]> {
  const params = new URLSearchParams();
  
  if (options?.type && options.type !== "ALL") {
    params.append("type", options.type);
  }
  if (options?.sortBy) {
    params.append("sortBy", options.sortBy);
  }
  if (options?.sortOrder) {
    params.append("sortOrder", options.sortOrder);
  }

  const queryString = params.toString();
  const url = `/api/investments/${assetId}/trades${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch trade history");
  }

  const data: TradeHistoryResponse = await response.json();
  return data.trades;
}

/**
 * React Query hook for fetching trade history data.
 * 
 * @param assetId - The ID of the investment asset
 * @param options - Optional filters and sorting
 * @returns Query result with trade history data, loading state, and error
 */
export function useTradeHistory(
  assetId: string | null,
  options?: {
    type?: "BUY" | "SELL" | "ALL";
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: tradeHistoryKeys.filtered(assetId || "", {
      type: options?.type || "ALL",
      sortBy: options?.sortBy || "date",
      sortOrder: options?.sortOrder || "desc",
    }),
    queryFn: () => fetchTradeHistory(assetId!, options),
    enabled: !!assetId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
