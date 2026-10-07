import { hashKey, type QueryClient } from "@tanstack/react-query";

import { transactionKeys } from "@/hooks/query-keys";
import type {
  PaginatedTransactionsData,
  TransactionListQueryParams,
} from "@/types/transaction-list";

export function seedTransactionListCache(
  queryClient: QueryClient,
  filters: TransactionListQueryParams,
  data: PaginatedTransactionsData
): void {
  const requestedKey = transactionKeys.list(filters);
  const canonicalKey = transactionKeys.list({
    ...filters,
    page: data.page,
    pageSize: data.pageSize,
  });

  queryClient.setQueryData<PaginatedTransactionsData>(requestedKey, data);
  if (hashKey(requestedKey) !== hashKey(canonicalKey)) {
    queryClient.setQueryData<PaginatedTransactionsData>(canonicalKey, data);
  }
}
