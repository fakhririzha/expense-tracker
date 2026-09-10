import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveMobileTransactionCapabilities } from "./transaction-capability-policy";

const ordinaryExpense = {
  type: "EXPENSE",
  accountType: "BANK",
  toAccountType: null,
  hasSplits: false,
  isManagedByDeposito: false,
  isManagedByBankInterest: false,
};

describe("mobile transaction capabilities", () => {
  it("allows ordinary income, expense, and transfer records", () => {
    assert.deepEqual(deriveMobileTransactionCapabilities(ordinaryExpense), {
      canEdit: true,
      canDelete: true,
    });
    assert.equal(
      deriveMobileTransactionCapabilities({
        ...ordinaryExpense,
        type: "TRANSFER",
        toAccountType: "CASH",
      }).canEdit,
      true
    );
  });

  it("protects managed and advanced transactions", () => {
    const protectedFacts = [
      { ...ordinaryExpense, isManagedByDeposito: true },
      { ...ordinaryExpense, isManagedByBankInterest: true },
      { ...ordinaryExpense, type: "LIABILITY_PAYMENT" },
      {
        ...ordinaryExpense,
        type: "TRANSFER",
        toAccountType: "LOAN_RECEIVABLE",
      },
      { ...ordinaryExpense, hasSplits: true },
    ];

    for (const facts of protectedFacts) {
      const capabilities = deriveMobileTransactionCapabilities(facts);
      assert.equal(capabilities.canEdit, false);
      assert.equal(capabilities.canDelete, false);
      assert.ok(capabilities.reason);
    }
  });
});
