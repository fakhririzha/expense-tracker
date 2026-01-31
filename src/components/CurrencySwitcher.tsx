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
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  // { code: "EUR", name: "Euro", symbol: "€" },
  // { code: "GBP", name: "British Pound", symbol: "£" },
  // { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  // { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  // { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  // { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  // { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  // { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  // { code: "INR", name: "Indian Rupee", symbol: "₹" },
  // { code: "KRW", name: "South Korean Won", symbol: "₩" },
  // { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  // { code: "THB", name: "Thai Baht", symbol: "฿" },
  // { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
];

/**
 * Provides a hydration-safe boolean that indicates whether the component is mounted.
 *
 * @returns `true` after the component has mounted on the client, `false` during server render or before mount
 */
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
 * Renders a hydration-safe currency selector that shows loading and error states.
 *
 * Displays a spinner while currencies or rates are loading, an error indicator when loading fails,
 * and the current selected currency otherwise. Selection changes are propagated via the currency context.
 *
 * @param className - Optional container CSS class name for layout or styling
 * @returns The currency selector React element
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