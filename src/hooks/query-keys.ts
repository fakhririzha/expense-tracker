import type { TransactionListQueryParams } from "@/types/transaction-list";

function getLocalDateKey(value?: Date): string | undefined {
  if (!value) return undefined;

  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function getTransactionListKeyFilters(filters: TransactionListQueryParams) {
  return {
    ...filters,
    startDate: getLocalDateKey(filters.startDate),
    endDate: getLocalDateKey(filters.endDate),
  };
}

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters: TransactionListQueryParams) =>
    [...transactionKeys.lists(), getTransactionListKeyFilters(filters)] as const,
  summary: (startDate?: Date, endDate?: Date) =>
    [...transactionKeys.all, "summary", { startDate, endDate }] as const,
};

export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
  list: (type?: string) => [...accountKeys.lists(), { type }] as const,
  summary: () => [...accountKeys.all, "summary"] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  list: (type?: "INCOME" | "EXPENSE" | "TRANSFER") =>
    [...categoryKeys.all, "list", { type }] as const,
};
