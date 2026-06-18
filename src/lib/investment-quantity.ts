export const INVESTMENT_QUANTITY_DECIMALS = 8;
export const INVESTMENT_QUANTITY_EPSILON = 10 ** -INVESTMENT_QUANTITY_DECIMALS;

export function formatInvestmentQuantity(quantity: number): string {
  return quantity.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: INVESTMENT_QUANTITY_DECIMALS,
  });
}

export function roundInvestmentQuantity(quantity: number): number {
  return Number(quantity.toFixed(INVESTMENT_QUANTITY_DECIMALS));
}

export function hasSufficientInvestmentQuantity(
  availableQuantity: number,
  requestedQuantity: number
): boolean {
  return requestedQuantity <= availableQuantity + INVESTMENT_QUANTITY_EPSILON;
}

export function normalizeSellQuantity(
  requestedQuantity: number,
  availableQuantity: number
): number {
  if (
    Math.abs(availableQuantity - requestedQuantity) <=
    INVESTMENT_QUANTITY_EPSILON
  ) {
    return availableQuantity;
  }

  return roundInvestmentQuantity(requestedQuantity);
}

export function calculateRemainingInvestmentQuantity(
  availableQuantity: number,
  executedQuantity: number
): number {
  const remainingQuantity = roundInvestmentQuantity(
    availableQuantity - executedQuantity
  );

  return Math.abs(remainingQuantity) <= INVESTMENT_QUANTITY_EPSILON
    ? 0
    : remainingQuantity;
}
