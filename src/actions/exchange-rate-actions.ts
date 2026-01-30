"use server";

import { getExchangeRate } from "@/lib/finance-service";

export async function fetchExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  return getExchangeRate(fromCurrency, toCurrency);
}
