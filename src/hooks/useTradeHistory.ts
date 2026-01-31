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
 * Retrieve trade history for the specified investment asset.
 *
 * @param assetId - ID of the investment asset to query
 * @param options - Optional query modifiers
 * @param options.type - Filter by trade type: `"BUY"`, `"SELL"`, or `"ALL"` (when `"ALL"` no type filter is applied)
 * @param options.sortBy - Field name to sort results by
 * @param options.sortOrder - Sort direction, `"asc"` or `"desc"`
 * @returns An array of trade history items for the asset
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
    let errorMessage: string;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || "Failed to fetch trade history";
    } catch {
      const errorText = await response.text();
      errorMessage = errorText || "Failed to fetch trade history";
    }
    throw new Error(errorMessage);
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
    queryFn: () => fetchTradeHistory(assetId as string, options),
    enabled: !!assetId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}