import assert from "node:assert/strict";
import test from "node:test";

import { transactionKeys } from "../hooks/query-keys";
import { normalizeTransactionListQueryParams } from "./transaction-list-query-params";

test("uses transaction-list defaults when parameters are missing", () => {
  assert.deepEqual(normalizeTransactionListQueryParams({}), {
    type: undefined,
    categoryId: undefined,
    accountId: undefined,
    startDate: undefined,
    endDate: undefined,
    page: 1,
    pageSize: 10,
    sortBy: "date",
    sortOrder: "desc",
  });
});

test("normalizes invalid page values, sizes, and dates", () => {
  const result = normalizeTransactionListQueryParams(
    new URLSearchParams({
      page: "0",
      pageSize: "12",
      startDate: "not-a-date",
      endDate: "2026-02-30",
    })
  );

  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 10);
  assert.equal(result.startDate, undefined);
  assert.equal(result.endDate, undefined);
});

test("keeps supported types and amount sorting", () => {
  const result = normalizeTransactionListQueryParams(
    new URLSearchParams({
      type: "EXPENSE",
      page: "2",
      pageSize: "25",
      sortBy: "amount",
      sortOrder: "asc",
    })
  );

  assert.equal(result.type, "EXPENSE");
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 25);
  assert.equal(result.sortBy, "amount");
  assert.equal(result.sortOrder, "asc");
});

test("rejects unsupported transaction types and sort values", () => {
  const result = normalizeTransactionListQueryParams(
    new URLSearchParams({
      type: "LIABILITY_PAYMENT",
      sortBy: "description",
      sortOrder: "descending",
    })
  );

  assert.equal(result.type, undefined);
  assert.equal(result.sortBy, "date");
  assert.equal(result.sortOrder, "desc");
});

test("normalizes server records and client search parameters equivalently", () => {
  const record = {
    type: "INCOME",
    categoryId: "category-1",
    accountId: "account-1",
    startDate: "2026-09-01",
    endDate: "2026-09-22",
    page: "3",
    pageSize: "50",
    sortBy: "amount",
    sortOrder: "asc",
  };

  const fromRecord = normalizeTransactionListQueryParams(record);
  const fromUrl = normalizeTransactionListQueryParams(new URLSearchParams(record));

  assert.deepEqual(fromRecord, fromUrl);
  assert.deepEqual(
    transactionKeys.list(fromRecord),
    transactionKeys.list(fromUrl)
  );
});
