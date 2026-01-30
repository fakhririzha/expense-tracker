"use server";

import { getExchangeRate } from "@/lib/finance-service";

/**
 * Fetches the exchange rate between two currencies.
 *
 * @param fromCurrency - ISO currency code to convert from
 * @param toCurrency - ISO currency code to convert to
 * @returns The exchange rate (units of `toCurrency` per one `fromCurrency`), or `null` if unavailable
 */
export async function fetchExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  return getExchangeRate(fromCurrency, toCurrency);
}