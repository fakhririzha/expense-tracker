import assert from "node:assert/strict";
import test from "node:test";

import {
  mobileCreateTransactionSchema,
  transactionListQuerySchema,
} from "./transaction";

const baseTransaction = {
  clientMutationId: "a5f66f6c-9f6d-465a-8f25-31e12d042f30",
  amount: 100,
  currency: "IDR",
  exchangeRate: 1,
  type: "EXPENSE" as const,
  date: "2026-09-10T10:00:00.000Z",
  accountId: "account-1",
};

test("mobile create accepts only ordinary transaction types", () => {
  assert.equal(mobileCreateTransactionSchema.safeParse(baseTransaction).success, true);
  assert.equal(
    mobileCreateTransactionSchema.safeParse({
      ...baseTransaction,
      type: "LIABILITY_PAYMENT",
      toAccountId: "liability-1",
    }).success,
    false
  );
});

test("mobile transfer requires a distinct destination", () => {
  assert.equal(
    mobileCreateTransactionSchema.safeParse({
      ...baseTransaction,
      type: "TRANSFER",
      toAccountId: "account-1",
    }).success,
    false
  );
});

test("mobile pagination stays on existing server page sizes", () => {
  assert.equal(transactionListQuerySchema.safeParse({ pageSize: "25" }).success, true);
  assert.equal(transactionListQuerySchema.safeParse({ pageSize: "24" }).success, false);
});
