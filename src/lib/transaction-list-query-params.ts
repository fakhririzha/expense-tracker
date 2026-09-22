import { parseISO } from "date-fns";

import {
  DEFAULT_TRANSACTION_PAGE,
  DEFAULT_TRANSACTION_PAGE_SIZE,
  TRANSACTION_PAGE_SIZES,
  type TransactionListQueryParams,
  type TransactionSortField,
  type TransactionSortOrder,
} from "@/types/transaction-list";

const DEFAULT_SORT_BY: TransactionSortField = "date";
const DEFAULT_SORT_ORDER: TransactionSortOrder = "desc";

type SearchParameterValue = string | string[] | null | undefined;
type SearchParameterRecord = Record<string, SearchParameterValue>;

interface SearchParameterReader {
  get(name: string): string | null;
}

export type TransactionListSearchParams = SearchParameterRecord | SearchParameterReader;

export interface NormalizedTransactionListQueryParams
  extends Omit<TransactionListQueryParams, "type"> {
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
}

function getSearchParameter(
  searchParams: TransactionListSearchParams,
  name: string
): string | null {
  const reader = searchParams as SearchParameterReader;
  if (typeof reader.get === "function") {
    return reader.get(name);
  }

  const value = (searchParams as SearchParameterRecord)[name];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeTransactionListQueryParams(
  searchParams: TransactionListSearchParams
): NormalizedTransactionListQueryParams {
  const type = getSearchParameter(searchParams, "type");
  const pageSize = parsePositiveInteger(
    getSearchParameter(searchParams, "pageSize"),
    DEFAULT_TRANSACTION_PAGE_SIZE
  );

  return {
    type:
      type === "INCOME" || type === "EXPENSE" || type === "TRANSFER"
        ? type
        : undefined,
    categoryId: getSearchParameter(searchParams, "categoryId") || undefined,
    accountId: getSearchParameter(searchParams, "accountId") || undefined,
    startDate: parseDateParam(getSearchParameter(searchParams, "startDate")),
    endDate: parseDateParam(getSearchParameter(searchParams, "endDate")),
    page: parsePositiveInteger(
      getSearchParameter(searchParams, "page"),
      DEFAULT_TRANSACTION_PAGE
    ),
    pageSize: TRANSACTION_PAGE_SIZES.includes(
      pageSize as (typeof TRANSACTION_PAGE_SIZES)[number]
    )
      ? pageSize
      : DEFAULT_TRANSACTION_PAGE_SIZE,
    sortBy:
      getSearchParameter(searchParams, "sortBy") === "amount"
        ? "amount"
        : DEFAULT_SORT_BY,
    sortOrder:
      getSearchParameter(searchParams, "sortOrder") === "asc"
        ? "asc"
        : DEFAULT_SORT_ORDER,
  };
}
