/**
 * Unit conversion utilities for investment assets
 * Handles conversion between troy ounces and grams for precious metals
 */

import { UnitType } from "@prisma/client";

// Conversion factor: 1 troy ounce = 31.1035 grams
export const TROY_OUNCE_TO_GRAM = 31.1035;

// Precious metals symbols that are traded in troy ounces on Yahoo Finance
export const PRECIOUS_METALS_SYMBOLS = [
  "GC=F",   // Gold Futures
  "SI=F",   // Silver Futures
  "PL=F",   // Platinum Futures
  "PA=F",   // Palladium Futures
  "MGC=F",  // Micro Gold Futures
  "SIL=F",  // Micro Silver Futures
];

/**
 * Determine whether a market symbol represents a supported precious metal.
 *
 * @param symbol - The market/ticker symbol to check (case-insensitive)
 * @returns `true` if the symbol matches a known precious metals symbol, `false` otherwise.
 */
export function isPreciousMetal(symbol: string): boolean {
  return PRECIOUS_METALS_SYMBOLS.includes(symbol.toUpperCase());
}

/**
 * Determine the default unit type for an asset symbol.
 *
 * @param symbol - The asset ticker or symbol (case-insensitive, e.g., Yahoo Finance symbol)
 * @returns `"TROY_OUNCE"` if the symbol represents a precious metal quoted in troy ounces, `"UNIT"` otherwise.
 */
export function getDefaultUnitType(symbol: string): UnitType {
  if (isPreciousMetal(symbol)) {
    return "TROY_OUNCE";
  }
  return "UNIT";
}

/**
 * Convert a monetary price between supported unit types.
 *
 * Converts between TROY_OUNCE and GRAM using the file's conversion factor; returns the original value when units are identical or when no supported conversion path exists (e.g., `UNIT`).
 *
 * @param price - The price value to convert
 * @param fromUnit - The unit the price is currently expressed in
 * @param toUnit - The unit to convert the price into
 * @returns The `price` expressed in `toUnit` (`price` unchanged if no conversion is applied)
 */
export function convertPrice(
  price: number,
  fromUnit: UnitType,
  toUnit: UnitType
): number {
  if (fromUnit === toUnit) return price;
  
  // Convert from troy ounce to gram
  if (fromUnit === "TROY_OUNCE" && toUnit === "GRAM") {
    return price / TROY_OUNCE_TO_GRAM;
  }
  
  // Convert from gram to troy ounce
  if (fromUnit === "GRAM" && toUnit === "TROY_OUNCE") {
    return price * TROY_OUNCE_TO_GRAM;
  }
  
  // No conversion for UNIT type
  return price;
}

/**
 * Convert a numeric quantity between TROY_OUNCE and GRAM units; returns the input unchanged for identical units or unsupported unit pairs.
 *
 * @param quantity - The quantity to convert
 * @param fromUnit - The unit the quantity is currently in
 * @param toUnit - The unit to convert to
 * @returns The quantity expressed in `toUnit`; for identical or unsupported unit pairs returns the original `quantity`
 */
export function convertQuantity(
  quantity: number,
  fromUnit: UnitType,
  toUnit: UnitType
): number {
  if (fromUnit === toUnit) return quantity;
  
  // Convert from troy ounce to gram
  if (fromUnit === "TROY_OUNCE" && toUnit === "GRAM") {
    return quantity * TROY_OUNCE_TO_GRAM;
  }
  
  // Convert from gram to troy ounce
  if (fromUnit === "GRAM" && toUnit === "TROY_OUNCE") {
    return quantity / TROY_OUNCE_TO_GRAM;
  }
  
  return quantity;
}

/**
 * Get a short, human-readable label for the specified unit type.
 *
 * @param unit - The unit type (`TROY_OUNCE`, `GRAM`, or `UNIT`)
 * @returns A short label: `Troy oz` for `TROY_OUNCE`, `gram` for `GRAM`, and `unit` for `UNIT`
 */
export function getUnitLabel(unit: UnitType): string {
  switch (unit) {
    case "TROY_OUNCE":
      return "Troy oz";
    case "GRAM":
      return "gram";
    case "UNIT":
    default:
      return "unit";
  }
}

/**
 * Get the full display label for a unit type.
 *
 * @returns The full human-readable label corresponding to the provided unit type.
 */
export function getUnitLabelFull(unit: UnitType): string {
  switch (unit) {
    case "TROY_OUNCE":
      return "Troy Ounce";
    case "GRAM":
      return "Gram";
    case "UNIT":
    default:
      return "Unit (Share)";
  }
}