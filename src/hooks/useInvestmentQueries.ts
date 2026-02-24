import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPortfolio,
  getPortfolioSummary,
  getInvestmentAccountsAction,
  getSellableInvestments,
  createInvestmentAsset,
  recordTrade,
  refreshPortfolioPrices,
  searchSymbolsAction,
  getAssetPriceWithConversion,
} from "@/actions/investment-actions";
import { accountKeys } from "./useAccountQueries";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const investmentKeys = {
  all: ["investments"] as const,
  portfolio: () => [...investmentKeys.all, "portfolio"] as const,
  summary: () => [...investmentKeys.all, "summary"] as const,
  accounts: () => [...investmentKeys.all, "accounts"] as const,
  sellable: () => [...investmentKeys.all, "sellable"] as const,
  symbols: (query: string) =>
    [...investmentKeys.all, "symbols", query] as const,
  price: (symbol: string, unitType?: string) =>
    [...investmentKeys.all, "price", symbol, unitType] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePortfolio() {
  return useQuery({
    queryKey: investmentKeys.portfolio(),
    queryFn: async () => {
      const result = await getPortfolio();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: investmentKeys.summary(),
    queryFn: async () => {
      const result = await getPortfolioSummary();
      if (!result.success) throw new Error(result.error);
      return "data" in result ? result.data : null;
    },
  });
}

export function useInvestmentAccounts() {
  return useQuery({
    queryKey: investmentKeys.accounts(),
    queryFn: async () => {
      const result = await getInvestmentAccountsAction();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useSellableInvestments() {
  return useQuery({
    queryKey: investmentKeys.sellable(),
    queryFn: async () => {
      const result = await getSellableInvestments();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useSearchSymbols(query: string) {
  return useQuery({
    queryKey: investmentKeys.symbols(query),
    queryFn: async () => {
      const result = await searchSymbolsAction(query);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: query.length >= 2,
  });
}

/**
 * Hook to fetch the current price for a symbol with proper currency conversion.
 * 
 * - Indonesian stocks (symbols containing `.JK`) are returned as-is (already in IDR)
 * - US stocks and precious metals are converted from USD to IDR using IDR=X rate
 * - Precious metals can optionally be converted from TROY_OUNCE to GRAM
 *
 * @param symbol - The stock/asset symbol to fetch the price for
 * @param unitType - Optional unit type for precious metals ("GRAM" or "TROY_OUNCE")
 * @returns TanStack Query result with the converted price in IDR
 */
export function useAssetPrice(
  symbol: string | undefined,
  unitType?: "UNIT" | "TROY_OUNCE" | "GRAM"
) {
  return useQuery({
    queryKey: investmentKeys.price(symbol || "", unitType),
    queryFn: async () => {
      if (!symbol) return null;
      const result = await getAssetPriceWithConversion(symbol, unitType);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    enabled: !!symbol && symbol.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateInvestmentAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof createInvestmentAsset>[0]) => {
      const result = await createInvestmentAsset(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useRecordTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof recordTrade>[0]) => {
      const result = await recordTrade(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useRefreshPortfolioPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await refreshPortfolioPrices();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all });
    },
  });
}
