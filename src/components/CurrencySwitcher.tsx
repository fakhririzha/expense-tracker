"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AlertCircle, Loader2 } from "lucide-react";
import { useSyncExternalStore } from "react";

const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
];

// Helper to prevent hydration mismatch in Radix UI components
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

interface CurrencySwitcherProps {
  className?: string;
}

/**
 * Currency switcher component with TanStack Query integration.
 * 
 * Displays:
 * - Loading spinner when fetching exchange rates
 * - Error indicator when fetch fails
 * - Current currency selection
 * 
 * Uses useSyncExternalStore to prevent hydration mismatches.
 */
export function CurrencySwitcher({ className }: CurrencySwitcherProps) {
  const { displayCurrency, setDisplayCurrency, mainCurrency, isLoading, isError } =
    useCurrency();
  const mounted = useMounted();

  // Prevent hydration mismatch by not rendering Select until mounted
  if (!mounted) {
    return (
      <div className={className}>
        <div className="border-input data-placeholder:text-muted-foreground flex w-[140px] items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs h-9">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
        <SelectTrigger className="w-[140px]">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isError ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Error</span>
            </span>
          ) : (
            <SelectValue placeholder="Currency" />
          )}
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                <span className="font-mono">{currency.code}</span>
                {currency.code === mainCurrency && (
                  <span className="text-xs text-muted-foreground">(Main)</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { SUPPORTED_CURRENCIES };
