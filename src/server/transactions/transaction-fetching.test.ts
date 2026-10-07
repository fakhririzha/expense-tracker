import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const moduleMock = (mock as unknown as {
  module: (specifier: string | URL, options: { defaultExport?: unknown; namedExports?: Record<string, unknown> }) => void;
}).module.bind(mock);
let events: string[] = [];
let total = 25;
let rows: ReturnType<typeof fixture>[] = [];
let release: (() => void) | undefined;
let gate: Promise<void> = Promise.resolve();
let failBank = false;
const reads: Record<string, unknown>[] = [];
function fixture(id: string, type = "EXPENSE", accountType = "BANK", split = false) {
  return { id, type, amount: 100, currency: "IDR", exchangeRate: 1, date: new Date("2026-10-01"),
    description: null, descriptionEncrypted: "secret", referenceNumber: null, referenceNumberEncrypted: null,
    createdBy: null, createdByEncrypted: null, toAccount: null,
    account: { id: "shared-account", type: accountType, nameEncrypted: "account-secret" },
    splits: split ? [{ id: "split", description: null, descriptionEncrypted: null }] : [] };
}
moduleMock(new URL("../../lib/db.ts", import.meta.url), { defaultExport: {
  transaction: {
    count: async (args: unknown) => { events.push("count"); reads.push({ count: args }); return total; },
    findMany: async (args: unknown) => { assert.deepEqual(events, ["count"]); events.push("page"); reads.push({ page: args }); return rows; },
  },
  bankInterestPosting: { findMany: async (args: unknown) => {
    events.push("bank"); reads.push({ bank: args }); await gate;
    if (failBank) throw new Error("bank lookup failed");
    return [{ transactionId: "bank-managed" }];
  } },
} });
moduleMock(new URL("../../lib/deposito-managed-transactions.ts", import.meta.url), { namedExports: {
  getManagedDepositoTransactionIds: async (userId: string, ids: string[]) => {
    events.push("deposito"); assert.equal(userId, "owner"); assert.deepEqual(ids, rows.map(row => row.id));
    await gate; return new Set(["deposito-managed"]);
  }, isManagedDepositoTransaction: async () => false,
} });
moduleMock(new URL("../../lib/account-crypto.ts", import.meta.url), { namedExports: {
  decryptAccountName: async (userId: string) => { assert.equal(userId, "owner"); events.push("account"); await gate; return "Account"; },
} });
moduleMock(new URL("../../lib/user-encryption.ts", import.meta.url), { namedExports: {
  decryptUserField: async (userId: string) => { assert.equal(userId, "owner"); events.push("decrypt"); await gate; return "Description"; },
  encryptUserField: async () => { throw new Error("Unexpected write helper"); },
} });
const { getTransactionsForUser } = await import("./transaction-service");
beforeEach(context => {
  events = []; reads.length = 0; total = 25; rows = [fixture("ordinary")]; gate = Promise.resolve(); failBank = false;
  if ("mock" in context) context.mock.method(console, "error", () => {});
});
test("count bounds the offset before reading one filtered, owned page", async () => {
  const result = await getTransactionsForUser("owner", { page: 9999, pageSize: 10, accountId: "account", categoryId: "category", sortBy: "amount", sortOrder: "asc" });
  assert.equal(result.success, true);
  assert.equal(result.data.page, 3);
  assert.equal(result.data.total, 25);
  const count = reads[0].count as { where: unknown };
  const page = reads[1].page as { where: unknown; skip: number; take: number; orderBy: unknown };
  assert.deepEqual(count.where, { userId: "owner", accountId: "account", OR: [{ categoryId: "category" }, { splits: { some: { categoryId: "category" } } }] });
  assert.deepEqual(page.where, count.where);
  assert.equal(page.skip, 20); assert.equal(page.take, 10); assert.deepEqual(page.orderBy, { amount: "asc" });
  assert.deepEqual(reads[2].bank, { where: { userId: "owner", transactionId: { in: ["ordinary"] } }, select: { transactionId: true } });
});
test("management lookups and decryption start before any enrichment resolves", async () => {
  gate = new Promise(resolve => { release = resolve; });
  const pending = getTransactionsForUser("owner");
  await new Promise(resolve => setImmediate(resolve));
  try { for (const stage of ["deposito", "bank", "account", "decrypt"]) assert.ok(events.includes(stage), `${stage} must start concurrently`); }
  finally { release!(); }
  assert.equal((await pending).success, true);
});
test("capabilities preserve ordinary, managed, liability, receivable and split restrictions", async () => {
  rows = [fixture("ordinary"), fixture("deposito-managed"), fixture("bank-managed"), fixture("liability", "LIABILITY_PAYMENT"), fixture("receivable", "TRANSFER", "LOAN_RECEIVABLE"), fixture("split", "EXPENSE", "BANK", true)];
  const result = await getTransactionsForUser("owner"); assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.transactions[0].capabilities, { canEdit: true, canDelete: true });
  for (const row of result.data.transactions.slice(1)) {
    assert.equal(row.capabilities.canEdit, false); assert.equal(row.capabilities.canDelete, false); assert.ok(row.capabilities.reason);
  }
  assert.equal(result.data.transactions[1].isManagedByDeposito, true);
  assert.equal(events.filter(event => event === "account").length, 1, "shared account names decrypt once");
  assert.equal(result.data.transactions[0].description, "Description");
});
test("empty results canonicalize to page one without bank posting reads", async () => {
  total = 0; rows = [];
  const result = await getTransactionsForUser("owner", { page: 9999, pageSize: 20 });
  assert.equal(result.success, true); assert.equal(result.data.page, 1); assert.equal(result.data.totalPages, 1);
  assert.deepEqual(result.data.transactions, []); assert.equal(events.includes("bank"), false);
  assert.equal((reads[1].page as { skip: number }).skip, 0);
});
test("management lookup failure returns no partially enriched records", async () => {
  failBank = true; const result = await getTransactionsForUser("owner");
  assert.equal(result.success, false); assert.deepEqual(result.data.transactions, []);
});
