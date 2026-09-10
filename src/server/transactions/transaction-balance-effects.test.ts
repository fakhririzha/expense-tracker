import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTransactionBalanceDeltas,
  getTransactionUpdateBalanceDeltas,
} from "./transaction-balance-effects";

describe("transaction balance effects", () => {
  it("applies income and expense to the source account", () => {
    assert.deepEqual(
      getTransactionBalanceDeltas(
        {
          amount: 125,
          type: "INCOME",
          accountId: "bank",
          toAccountId: null,
        },
        "apply"
      ),
      [{ accountId: "bank", amount: 125 }]
    );
    assert.deepEqual(
      getTransactionBalanceDeltas(
        {
          amount: 40,
          type: "EXPENSE",
          accountId: "cash",
          toAccountId: null,
        },
        "apply"
      ),
      [{ accountId: "cash", amount: -40 }]
    );
  });

  it("moves a transfer between both accounts", () => {
    assert.deepEqual(
      getTransactionBalanceDeltas(
        {
          amount: 75,
          type: "TRANSFER",
          accountId: "bank",
          toAccountId: "cash",
        },
        "apply"
      ),
      [
        { accountId: "bank", amount: -75 },
        { accountId: "cash", amount: 75 },
      ]
    );
  });

  it("reverses every original balance effect for update and delete", () => {
    assert.deepEqual(
      getTransactionBalanceDeltas(
        {
          amount: 75,
          type: "TRANSFER",
          accountId: "bank",
          toAccountId: "cash",
        },
        "reverse"
      ),
      [
        { accountId: "bank", amount: 75 },
        { accountId: "cash", amount: -75 },
      ]
    );
  });

  it("reverses the old effect before applying changed amount and accounts", () => {
    assert.deepEqual(
      getTransactionUpdateBalanceDeltas(
        {
          amount: 75,
          type: "TRANSFER",
          accountId: "bank",
          toAccountId: "cash",
        },
        {
          amount: 125,
          type: "TRANSFER",
          accountId: "savings",
          toAccountId: "wallet",
        }
      ),
      [
        { accountId: "bank", amount: 75 },
        { accountId: "cash", amount: -75 },
        { accountId: "savings", amount: -125 },
        { accountId: "wallet", amount: 125 },
      ]
    );
  });

  it("rejects a transfer without a destination", () => {
    assert.throws(() =>
      getTransactionBalanceDeltas(
        {
          amount: 1,
          type: "TRANSFER",
          accountId: "bank",
          toAccountId: null,
        },
        "apply"
      )
    );
  });
});
