import { clsx, type ClassValue } from "cnfast";
import { twMerge } from "cnfast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as a currency string using the specified locale and currency.
 *
 * @param amount - The numeric value to format
 * @param currency - The ISO 4217 currency code to use (default: "IDR")
 * @param locale - The BCP 47 locale string to use for formatting (default: "id-ID")
 * @returns The formatted currency string, e.g. "Rp12.345,00"
 */
export function formatCurrency(
  amount: number,
  currency: string = "IDR",
  locale: string = "id-ID"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/**
 * Format a number using the specified locale with exactly two fraction digits.
 *
 * @param value - The numeric value to format
 * @param locale - BCP 47 locale tag used for formatting (defaults to "id-ID")
 * @returns The localized number string with two digits after the decimal separator
 */
export function formatNumber(
  value: number,
  locale: string = "id-ID"
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a Date or date string into a localized date string using Indonesian locale.
 *
 * @param date - A Date object or a date string parseable by the JavaScript Date constructor
 * @param options - Intl.DateTimeFormatOptions that control the output; defaults to year: "numeric", month: "short", day: "numeric"
 * @returns The formatted date string according to the provided options and the "id-ID" locale
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", options);
}

/**
 * Get up to two uppercase initials from a person's name.
 *
 * @param name - The full name (may contain multiple words or extra spaces)
 * @returns A string with the first one or two uppercase initials from `name`; returns an empty string if no characters are available
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}