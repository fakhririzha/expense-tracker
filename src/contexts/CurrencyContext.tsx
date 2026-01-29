"use client";

import { getExchangeRate } from "@/lib/finance-service";
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";

interface CurrencyContextType {
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
  mainCurrency: string;
  exchangeRate: number;
  isLoading: boolean;
  convertAmount: (amount: number, fromCurrency?: string) => number;
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

export function CurrencyProvider({
  children,
  mainCurrency,
  initialDisplayCurrency,
}: CurrencyProviderProps) {
  const [displayCurrency, setDisplayCurrency] = useState(
    initialDisplayCurrency || mainCurrency
  );
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchExchangeRate() {
      if (displayCurrency === mainCurrency) {
        setExchangeRate(1);
        return;
      }

      setIsLoading(true);
      try {
        const rate = await getExchangeRate(mainCurrency, displayCurrency);
        setExchangeRate(rate ?? 1);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        setExchangeRate(1);
      } finally {
        setIsLoading(false);
      }
    }

    fetchExchangeRate();
  }, [displayCurrency, mainCurrency]);

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
        convertAmount,
        formatInDisplayCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
