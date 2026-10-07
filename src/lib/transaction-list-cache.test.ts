import assert from "node:assert/strict";
import test from "node:test";

import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";

import { transactionKeys } from "../hooks/query-keys";
import type { PaginatedTransactionsData, TransactionListQueryParams } from "../types/transaction-list";
import { seedTransactionListCache } from "./transaction-list-cache";

function pageData(page: number, pageSize: number, total = 0): PaginatedTransactionsData {
  return { transactions: [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

test("hydrates oversized requested and canonical pages without a second fetch", async () => {
  const serverClient = new QueryClient();
  const filters: TransactionListQueryParams = {
    page: 9999,
    pageSize: 25,
    accountId: "account-1",
    categoryId: "category-1",
    type: "EXPENSE",
    startDate: new Date(2026, 8, 1),
    endDate: new Date(2026, 8, 30),
    sortBy: "amount",
    sortOrder: "asc",
  };
  const data = pageData(3, 25, 61);
  seedTransactionListCache(serverClient, filters, data);
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
  hydrate(client, dehydrate(serverClient));
  let fetches = 0;
  for (const page of [9999, 3]) {
    const result = await client.fetchQuery({
      queryKey: transactionKeys.list({ ...filters, page }),
      queryFn: async () => { fetches++; return data; },
    });
    assert.deepEqual(result, data);
  }
  assert.equal(fetches, 0);
  assert.equal(client.getQueryData(transactionKeys.list({ ...filters, page: 3, accountId: "other" })), undefined);
});

test("seeds empty results at page one and uses the returned page size", () => {
  const client = new QueryClient();
  const filters = { page: 9999, pageSize: 100 };
  const data = pageData(1, 10);
  seedTransactionListCache(client, filters, data);
  assert.deepEqual(client.getQueryData(transactionKeys.list(filters)), data);
  assert.deepEqual(client.getQueryData(transactionKeys.list({ page: 1, pageSize: 10 })), data);
  assert.equal(client.getQueryData(transactionKeys.list({ page: 1, pageSize: 100 })), undefined);
});

test("refreshes cached requested and canonical data after a client-side clamp", () => {
  const client = new QueryClient();
  const filters = { page: 5, pageSize: 50, sortBy: "date", sortOrder: "desc" } as const;
  client.setQueryData(transactionKeys.list(filters), pageData(5, 50, 250));
  const data = pageData(2, 50, 75);
  seedTransactionListCache(client, filters, data);
  assert.deepEqual(client.getQueryData(transactionKeys.list(filters)), data);
  assert.deepEqual(client.getQueryData(transactionKeys.list({ ...filters, page: 2 })), data);
});

test("unchanged page and size produce only one cache entry", () => {
  const client = new QueryClient();
  seedTransactionListCache(client, { page: 1, pageSize: 10 }, pageData(1, 10));
  assert.equal(client.getQueryCache().getAll().length, 1);
});
