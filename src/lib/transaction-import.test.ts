import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectColumnMapping,
  MAX_CSV_BYTES,
  parseCSVContent,
  previewImport,
} from "@/lib/transaction-import";

const HEADER = "Date,Amount,Type,Account,Currency";
const VALID_ROW = "2026-07-27,125000,expense,Cash,idr";

function csvWithRows(count: number): string {
  return [HEADER, ...Array.from({ length: count }, () => VALID_ROW)].join("\n");
}

describe("transaction CSV parsing", () => {
  it("rejects empty content", () => {
    const parsed = parseCSVContent(" \n ");

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV file is empty.");
  });

  it("parses and previews a valid transaction", () => {
    const csv = `${HEADER}\n${VALID_ROW}`;
    const parsed = parseCSVContent(csv);

    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.headers, ["date", "amount", "type", "account", "currency"]);

    const preview = previewImport(csv, detectColumnMapping(parsed.headers));
    assert.equal(preview.success, true);
    assert.deepEqual(preview.summary, { total: 1, valid: 1, invalid: 0 });
    assert.equal(preview.transactions[0].type, "EXPENSE");
    assert.equal(preview.transactions[0].currency, "IDR");
  });

  it("rejects content over the UTF-8 byte limit", () => {
    const csv = `${HEADER}\n${"é".repeat(MAX_CSV_BYTES / 2)}`;
    const parsed = parseCSVContent(csv);

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV file must be 512 KB or smaller.");
  });

  it("rejects more than 1,000 transaction rows", () => {
    const parsed = parseCSVContent(csvWithRows(1001));

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV can contain at most 1,000 transaction rows.");
  });

  it("accepts exactly 1,000 transaction rows", () => {
    const parsed = parseCSVContent(csvWithRows(1000));

    assert.equal(parsed.success, true);
    assert.equal(parsed.data.length, 1000);
  });

  it("rejects more than 32 columns", () => {
    const headers = Array.from({ length: 33 }, (_, index) => `column${index}`);
    const parsed = parseCSVContent(headers.join(","));

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV can contain at most 32 columns.");
  });

  it("rejects headers longer than 128 characters", () => {
    const parsed = parseCSVContent(`${"a".repeat(129)},amount\nvalue,1`);

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV headers must be 128 characters or fewer.");
  });

  it("rejects cells longer than 2,048 characters", () => {
    const parsed = parseCSVContent(
      `date,amount,type,account,description\n2026-07-27,1,EXPENSE,Cash,${"a".repeat(2049)}`
    );

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV cells must be 2,048 characters or fewer.");
  });

  it("rejects duplicate normalized headers", () => {
    const parsed = parseCSVContent("Date, date ,Amount,Type,Account\n2026-07-27,x,1,EXPENSE,Cash");

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV contains duplicate column headers.");
  });

  it("rejects blank headers", () => {
    const parsed = parseCSVContent("date,,amount,type,account\n2026-07-27,x,1,EXPENSE,Cash");

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV column headers cannot be blank.");
  });

  it("rejects malformed CSV syntax", () => {
    const parsed = parseCSVContent(
      'date,amount,type,account\n"2026-07-27,1,EXPENSE,Cash'
    );

    assert.equal(parsed.success, false);
    assert.equal(parsed.error, "CSV contains invalid formatting.");
  });

  it("rejects rows with more cells than headers", () => {
    const parsed = parseCSVContent("date,amount\n2026-07-27,1,extra");

    assert.equal(parsed.success, false);
    assert.equal(
      parsed.error,
      "CSV rows must not contain more values than the header row."
    );
  });
});

describe("transaction CSV mapping", () => {
  it("rejects a missing required mapping", () => {
    const preview = previewImport(`${HEADER}\n${VALID_ROW}`, {
      date: "date",
      amount: "amount",
      type: "type",
    });

    assert.equal(preview.success, false);
    assert.equal(
      preview.error,
      "Map the required Date, Amount, Type, and Account columns."
    );
  });

  it("rejects unknown mapping fields and headers", () => {
    const preview = previewImport(`${HEADER}\n${VALID_ROW}`, {
      date: "date",
      amount: "amount",
      type: "type",
      account: "missing",
      unexpected: "currency",
    });

    assert.equal(preview.success, false);
    assert.equal(
      preview.error,
      "Column mapping contains an unknown field or header."
    );
  });

  it("rejects mapping one column more than once", () => {
    const preview = previewImport(`${HEADER}\n${VALID_ROW}`, {
      date: "date",
      amount: "amount",
      type: "type",
      account: "account",
      category: "account",
    });

    assert.equal(preview.success, false);
    assert.equal(preview.error, "Each CSV column can only be mapped once.");
  });

  it("reports an unexpected transaction type as a row error", () => {
    const csv = `${HEADER}\n2026-07-27,10,refund,Cash,IDR`;
    const preview = previewImport(csv, {
      date: "date",
      amount: "amount",
      type: "type",
      account: "account",
      currency: "currency",
    });

    assert.equal(preview.success, true);
    assert.equal(preview.transactions[0].isValid, false);
    assert.ok(
      preview.transactions[0].errors.includes(
        "Type must be INCOME, EXPENSE, or TRANSFER"
      )
    );
  });

  it("normalizes valid currency and rejects malformed currency", () => {
    const csv = `${HEADER}\n2026-07-27,10,expense,Cash,usd\n2026-07-27,10,expense,Cash,US12`;
    const preview = previewImport(csv, {
      date: "date",
      amount: "amount",
      type: "type",
      account: "account",
      currency: "currency",
    });

    assert.equal(preview.success, true);
    assert.equal(preview.transactions[0].currency, "USD");
    assert.equal(preview.transactions[0].isValid, true);
    assert.equal(preview.transactions[1].isValid, false);
    assert.ok(
      preview.transactions[1].errors.includes("Currency must be a 3-letter code")
    );
  });
});
