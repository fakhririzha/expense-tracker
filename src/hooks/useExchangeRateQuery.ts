import { fetchExchangeRate as fetchExchangeRateAction } from '@/actions/exchange-rate-actions'
import { useQuery } from '@tanstack/react-query'

/**
 * Options for the useExchangeRateQuery hook
 */
interface UseExchangeRateQueryOptions {
  /** The base currency to convert from */
  mainCurrency: string
  /** The target currency to convert to */
  displayCurrency: string
  /** Whether the query should be enabled (default: true) */
  enabled?: boolean
}

/**
 * Query key factory for exchange rate queries.
 * Uses a structured approach to ensure proper cache invalidation.
 */
export const exchangeRateKeys = {
  /** Base key for all exchange rate queries */
  all: ['exchange-rate'] as const,
  /** Key for a specific currency pair */
  pair: (from: string, to: string) => 
    [...exchangeRateKeys.all, from, to] as const,
}

/**
 * Provides a React Query hook that returns the exchange rate for a currency pair.
 *
 * When `mainCurrency` and `displayCurrency` are identical, the hook returns an exchange rate of `1` immediately and skips network fetching.
 *
 * @param mainCurrency - The base currency code to convert from (e.g., `"USD"`).
 * @param displayCurrency - The target currency code to convert to (e.g., `"EUR"`).
 * @param enabled - Optional flag to enable or disable the query (default: `true`).
 * @returns The TanStack Query result object whose `data` is the numeric exchange rate and which includes standard query status fields (`isLoading`, `isError`, etc.).
 */
export function useExchangeRateQuery({
  mainCurrency,
  displayCurrency,
  enabled = true,
}: UseExchangeRateQueryOptions) {
  const isSameCurrency = mainCurrency === displayCurrency

  return useQuery({
    // Query key includes both currencies for proper invalidation on change
    queryKey: exchangeRateKeys.pair(mainCurrency, displayCurrency),
    queryFn: async () => {
      // Return 1 for same currency (no conversion needed)
      if (isSameCurrency) {
        return 1
      }

      const rate = await fetchExchangeRateAction(mainCurrency, displayCurrency)
      return rate ?? 1
    },
    // Skip fetching if currencies are the same (rate is always 1)
    enabled: enabled && !isSameCurrency,
    // Return 1 immediately for same currency without fetching
    initialData: isSameCurrency ? 1 : undefined,
    // Refetch every 5 minutes for live exchange rates
    refetchInterval: 5 * 60 * 1000,
    // Consider data fresh for 5 minutes (prevents excessive API calls)
    staleTime: 5 * 60 * 1000,
    // Keep data in cache for 10 minutes after becoming inactive
    gcTime: 10 * 60 * 1000,
  })
}