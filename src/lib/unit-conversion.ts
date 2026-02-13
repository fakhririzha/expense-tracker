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
 * Check if a symbol is a precious metal
 */
export function isPreciousMetal(symbol: string): boolean {
  return PRECIOUS_METALS_SYMBOLS.includes(symbol.toUpperCase());
}

/**
 * Get the default unit type for a symbol
 * Precious metals are quoted in troy ounces on Yahoo Finance
 */
export function getDefaultUnitType(symbol: string): UnitType {
  if (isPreciousMetal(symbol)) {
    return "TROY_OUNCE";
  }
  return "UNIT";
}

/**
 * Convert price from one unit to another
 * @param price - The price to convert
 * @param fromUnit - The unit the price is currently in
 * @param toUnit - The unit to convert to
 * @returns The converted price
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
 * Convert quantity from one unit to another
 * @param quantity - The quantity to convert
 * @param fromUnit - The unit the quantity is currently in
 * @param toUnit - The unit to convert to
 * @returns The converted quantity
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
 * Get display label for unit type
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
 * Get full display label for unit type
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
