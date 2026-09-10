import { format } from "date-fns";

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
export function formatTransactionDate(value: string) {
  try {
    return format(new Date(value), "d MMM yyyy, HH:mm");
  } catch {
    return value;
  }
}

export function typeLabel(type: string) {
  if (type === "INCOME") return "Income";
  if (type === "TRANSFER") return "Transfer";
  if (type === "LIABILITY_PAYMENT") return "Liability payment";
  return "Expense";
}

export function signedAmount(type: string, amount: number, currency: string) {
  const prefix = type === "INCOME" ? "+" : type === "EXPENSE" ? "−" : "";
  return `${prefix}${formatMoney(amount, currency)}`;
}

export function createClientMutationId() {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 3) | 8;
    return value.toString(16);
  });
}
