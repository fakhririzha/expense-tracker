import assert from "node:assert/strict";
import test from "node:test";

import {
  isoDateSchema,
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

test("mobile locations require a valid coordinate pair and HTTPS maps link", () => {
  assert.equal(
    mobileCreateTransactionSchema.safeParse({
      ...baseTransaction,
      latitude: -6.2,
      longitude: 106.816666,
      googleMapsLink: "https://www.google.com/maps/search/?api=1&query=-6.2,106.816666",
    }).success,
    true
  );
  assert.equal(
    mobileCreateTransactionSchema.safeParse({
      ...baseTransaction,
      latitude: -6.2,
    }).success,
    false
  );
  assert.equal(
    mobileCreateTransactionSchema.safeParse({
      ...baseTransaction,
      latitude: -91,
      longitude: 106.816666,
    }).success,
    false
  );
  assert.equal(
    mobileCreateTransactionSchema.safeParse({
      ...baseTransaction,
      googleMapsLink: "http://www.google.com/maps",
    }).success,
    false
  );
});

test("mobile pagination stays on existing server page sizes", () => {
  assert.equal(transactionListQuerySchema.safeParse({ pageSize: "25" }).success, true);
  assert.equal(transactionListQuerySchema.safeParse({ pageSize: "24" }).success, false);
});

test("OCR dates must be calendar-valid ISO dates", () => {
  assert.equal(isoDateSchema.safeParse("2028-02-29").success, true);
  assert.equal(isoDateSchema.safeParse("2027-02-29").success, false);
  assert.equal(isoDateSchema.safeParse("2026-04-31").success, false);
});
