import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getJakartaDayBounds, hasRemainingOcrQuota } from "./transaction-ocr-policy";
import { parseTransactionOcrResult } from "./transaction-ocr-result";

describe("transaction OCR policy", () => {
  it("keeps the quota boundary and Jakarta calendar day", () => {
    assert.equal(hasRemainingOcrQuota(1, 2), true);
    assert.equal(hasRemainingOcrQuota(2, 2), false);
    assert.deepEqual(
      getJakartaDayBounds(new Date("2026-09-10T18:00:00.000Z")),
      {
        start: new Date("2026-09-10T17:00:00.000Z"),
        end: new Date("2026-09-11T17:00:00.000Z"),
      }
    );
  });

  it("returns a valid result and sanitizes categories from the provider", () => {
    const result = parseTransactionOcrResult(
      JSON.stringify({
        type: "EXPENSE",
        amount: 125000,
        date: "2026-09-10",
        description: "Groceries",
        location: "Jakarta",
        categoryId: "income-category",
        lineItems: [
          {
            description: "Milk",
            amount: 25000,
            categoryId: "expense-category",
            confidence: 0.9,
          },
        ],
        confidence: 0.95,
        warnings: [],
      }),
      [
        { id: "income-category", type: "INCOME" },
        { id: "expense-category", type: "EXPENSE" },
      ]
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.amount, 125000);
    assert.equal(result.data.categoryId, null);
    assert.equal(result.data.lineItems[0]?.categoryId, "expense-category");
    assert.equal(result.data.warnings.length, 1);
  });
});
