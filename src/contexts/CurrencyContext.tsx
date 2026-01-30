"use client";

import { useExchangeRateQuery } from "@/hooks/useExchangeRateQuery";
import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from "react";

/**
 * Context type for currency-related state and operations.
 * Maintains backward compatibility while adding TanStack Query error states.
 */
interface CurrencyContextType {
  /** The currently selected display currency */
  displayCurrency: string;
  /** Function to update the display currency */
  setDisplayCurrency: (currency: string) => void;
  /** The user's main/base currency */
  mainCurrency: string;
  /** The current exchange rate from mainCurrency to displayCurrency */
  exchangeRate: number;
  /** Whether the exchange rate is being fetched */
  isLoading: boolean;
  /** Whether an error occurred while fetching the exchange rate */
  isError: boolean;
  /** The error object if fetching failed */
  error: Error | null;
  /** Convert an amount from mainCurrency to displayCurrency */
  convertAmount: (amount: number, fromCurrency?: string) => number;
  /** Format an amount in the display currency */
  formatInDisplayCurrency: (amount: number, fromCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

interface CurrencyProviderProps {
  children: ReactNode;
  mainCurrency: string;
  initialDisplayCurrency?: string;
}

/**
 * Provider component for currency context.
 * 
 * Uses TanStack Query for exchange rate fetching with:
 * - Automatic caching and background refetching
 * - Proper error handling and loading states
 * - Query keys that invalidate when currency parameters change
 * 
 * @example
 * ```tsx
 * <CurrencyProvider mainCurrency="USD">
 *   <App />
 * </CurrencyProvider>
 * ```
 */
export function CurrencyProvider({
  children,
  mainCurrency,
  initialDisplayCurrency,
}: CurrencyProviderProps) {
  const [displayCurrency, setDisplayCurrency] = useState(
    initialDisplayCurrency || mainCurrency
  );

  // Use TanStack Query for declarative exchange rate fetching
  const {
    data: exchangeRate = 1,
    isLoading,
    isError,
    error,
  } = useExchangeRateQuery({
    mainCurrency,
    displayCurrency,
  });

  const convertAmount = (amount: number, fromCurrency?: string): number => {
    if (fromCurrency && fromCurrency !== mainCurrency) {
      // If the amount is in a different currency, we'd need to convert it first
      // For simplicity, we assume amounts are already in mainCurrency
      return amount * exchangeRate;
    }
    return amount * exchangeRate;
  };

  const formatInDisplayCurrency = (
    amount: number,
    fromCurrency?: string
  ): string => {
    const convertedAmount = convertAmount(amount, fromCurrency);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
  };

  return (
    <CurrencyContext.Provider
      value={{
        displayCurrency,
        setDisplayCurrency,
        mainCurrency,
        exchangeRate,
        isLoading,
        isError,
        error,
        convertAmount,
        formatInDisplayCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Hook to access the currency context.
 * Must be used within a CurrencyProvider.
 * 
 * @throws Error if used outside of CurrencyProvider
 */
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
