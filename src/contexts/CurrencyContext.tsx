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
 * Provides currency-related state and utilities to descendant components.
 *
 * Supplies the current display currency, a setter to change it, the main (base) currency,
 * the latest exchange rate between main and display currencies, loading/error flags,
 * and helper functions to convert and format amounts in the display currency.
 *
 * @param children - React children that will have access to the currency context
 * @param mainCurrency - The user's base currency used as the source for conversions
 * @param initialDisplayCurrency - Optional initial display currency; defaults to `mainCurrency` if omitted
 * @returns A React context provider that makes currency state and helpers available to descendants
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
 * Accesses the current currency context.
 *
 * @returns The current CurrencyContext value including display currency, main currency, exchange rate, loading/error state, and conversion/formatting helpers.
 * @throws Error if called outside of a CurrencyProvider
 */
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}