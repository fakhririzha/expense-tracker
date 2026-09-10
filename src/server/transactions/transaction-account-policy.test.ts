import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateNewTransactionAccounts } from "./transaction-account-policy";

const bank = {
  id: "bank",
  type: "BANK",
  currency: "IDR",
  isActive: true,
};

describe("new transaction account policy", () => {
  it("rejects missing or inactive owned accounts", () => {
    assert.equal(
      validateNewTransactionAccounts({
        type: "EXPENSE",
        accountId: "missing",
        account: null,
        toAccount: null,
      }).success,
      false
    );
    assert.equal(
      validateNewTransactionAccounts({
        type: "EXPENSE",
        accountId: "bank",
        account: { ...bank, isActive: false },
        toAccount: null,
      }).success,
      false
    );
  });

  it("rejects same-account and cross-currency transfers", () => {
    assert.equal(
      validateNewTransactionAccounts({
        type: "TRANSFER",
        accountId: "bank",
        toAccountId: "bank",
        account: bank,
        toAccount: bank,
      }).success,
      false
    );
    assert.equal(
      validateNewTransactionAccounts({
        type: "TRANSFER",
        accountId: "bank",
        toAccountId: "cash",
        account: bank,
        toAccount: { ...bank, id: "cash", type: "CASH", currency: "USD" },
      }).success,
      false
    );
  });

  it("allows a same-currency transfer between supported account types", () => {
    assert.deepEqual(
      validateNewTransactionAccounts({
        type: "TRANSFER",
        accountId: "bank",
        toAccountId: "cash",
        account: bank,
        toAccount: { ...bank, id: "cash", type: "CASH" },
      }),
      { success: true }
    );
  });
});
