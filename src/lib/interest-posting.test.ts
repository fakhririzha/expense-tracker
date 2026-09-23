import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";

import { createInterestExchangeRateResolver } from "./interest-exchange-rate";
import { getCurrentJakartaBoundary } from "./bank-interest";
import { getTodayUtc } from "./deposito";

// Node 22 supports module mocks; this repository still uses Node 20 type declarations.
const moduleMock = (mock as unknown as {
  module: (specifier: string | URL, options: {
    defaultExport?: unknown;
    namedExports?: Record<string, unknown>;
  }) => void;
}).module.bind(mock);

let activeTransaction = false;
let transactionStarts = 0;
let lookups = 0;
let lookup: () => Promise<number | null> = async () => 15000;
let failAudit = false;
const originalCronSecret = process.env.CRON_SECRET;
after(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});
beforeEach(context => { context.mock.method(console, "error", () => {}); });
const day = 86_400_000;
function fixture(kind: "bank" | "deposito", id = "first") {
  const boundary = kind === "bank" ? getCurrentJakartaBoundary() : getTodayUtc();
  return {
    id, userId: "owner", enabled: true, status: "ACTIVE",
    user: { id: "owner", mainCurrency: "IDR" },
    account: { id, userId: "owner", currency: "USD", balance: 1000, type: kind === "bank" ? "BANK" : "DEPOSITO", isActive: true, nameEncrypted: "encrypted" },
    annualRate: 36.5, frequency: "DAILY", interestRate: 36.5,
    interestFrequency: "DAILY", taxRate: 0, termMode: "OPEN_ENDED",
    maturityDate: null, closedAt: null,
    startDate: new Date(boundary.getTime() - 3 * day),
    nextPostingDate: new Date(boundary.getTime() - 2 * day),
    nextInterestDate: new Date(boundary.getTime() - 2 * day),
    interestPostings: [] as { postingDate: Date }[],
  };
}
type Setting = ReturnType<typeof fixture>;
let settings: Setting[] = [];
let listed: Setting[] = [];
let transactions: Record<string, unknown>[] = [];
let audits: Record<string, unknown>[] = [];
function reset(kind: "bank" | "deposito") {
  settings = [fixture(kind), fixture(kind, "second")];
  listed = structuredClone(settings);
  transactions = []; audits = []; lookups = 0; transactionStarts = 0;
  failAudit = false; lookup = async () => 15000;
}
const model = {
  findMany: async () => listed,
  findUnique: async ({ where }: { where: { id: string } }) => settings.find(item => item.id === where.id),
  update: async ({ where, data }: { where: { id: string }; data: Partial<Setting> }) => {
    assert.equal(activeTransaction, true);
    Object.assign(settings.find(item => item.id === where.id)!, data);
  },
};
const auditModel = {
  create: async ({ data }: { data: Record<string, unknown> }) => {
    assert.equal(activeTransaction, true);
    if (failAudit) throw new Error("injected audit failure");
    audits.push(data);
  },
};
const tx = {
  bankInterestSetting: model, depositoAccount: model,
  category: { findFirst: async () => ({ id: "interest-category" }) },
  transaction: { create: async ({ data }: { data: Record<string, unknown> }) => {
    assert.equal(activeTransaction, true);
    transactions.push(data);
    return { id: `transaction-${transactions.length}` };
  } },
  financialAccount: { update: async ({ where, data }: { where: { id: string }; data: { balance: { increment: number } } }) => {
    assert.equal(activeTransaction, true);
    settings.find(item => item.account.id === where.id)!.account.balance += data.balance.increment;
  } },
  bankInterestPosting: auditModel, depositoInterestPosting: auditModel,
};
moduleMock(new URL("./db.ts", import.meta.url), { defaultExport: {
  bankInterestSetting: model, depositoAccount: model,
  // This fixture checks callback grouping only, not real database isolation or uniqueness.
  $transaction: async (callback: (client: typeof tx) => Promise<unknown>, options: Record<string, unknown>) => {
    assert.equal(options.isolationLevel, "Serializable");
    assert.equal(options.timeout, 10000);
    transactionStarts++;
    const before = structuredClone({ settings, transactions, audits });
    activeTransaction = true;
    try { return await callback(tx); }
    catch (error) {
      ({ settings, transactions, audits } = before);
      throw error;
    } finally { activeTransaction = false; }
  },
} });
moduleMock(new URL("./finance-service.ts", import.meta.url), { namedExports: {
  getExchangeRate: async () => {
    assert.equal(activeTransaction, false, "FX must run before the financial transaction");
    lookups++;
    return lookup();
  },
} });
moduleMock(new URL("../auth.ts", import.meta.url), { namedExports: { auth: async () => null } });
moduleMock(new URL("./account-crypto.ts", import.meta.url), { namedExports: {
  decryptAccountName: async () => "Account", decryptAccountRecords: async () => [],
  encryptAccountName: async () => "encrypted", encryptAccountDescription: async () => "encrypted",
  sortAccountsByName: () => [],
} });
moduleMock(new URL("./user-encryption.ts", import.meta.url), { namedExports: {
  encryptUserField: async () => "encrypted", decryptUserField: async () => "decrypted",
} });
moduleMock(new URL("./encryption.ts", import.meta.url), { namedExports: { rethrowEncryptionConfigurationError: () => {} } });
moduleMock("next/cache", { namedExports: { revalidatePath: () => {} } });
const { processBankInterest } = await import("./bank-interest-service");
const { processDepositoInterest } = await import("../actions/deposito-actions");

for (const kind of ["bank", "deposito"] as const) {
  const run = async () => {
    process.env.CRON_SECRET = "interest-test";
    return kind === "bank" ? processBankInterest() : processDepositoInterest("interest-test");
  };
  test(`${kind}: deferred FX completes before transactions and is reused across accounts and overdue periods`, async (context) => {
    reset(kind);
    context.mock.timers.enable({ apis: ["setTimeout"] });
    lookup = () => new Promise(resolve => { setTimeout(() => resolve(15000), 8000); });
    const pending = run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lookups, 1);
    assert.equal(transactionStarts, 0);
    // Simulate a balance change during provider waiting; posting must use the fresh value.
    settings[0].account.balance = 2000;
    context.mock.timers.tick(7999);
    assert.equal(transactionStarts, 0);
    context.mock.timers.tick(1);
    const result = await pending;
    assert.equal(result.success, true);
    assert.equal(result.data?.postedTransactions, 6, JSON.stringify(result));
    assert.equal(lookups, 1);
    assert.equal(audits.length, 6);
    assert.equal(audits[0].balanceBefore, 2000);
    assert.ok(transactions.every(item => item.exchangeRate === 15000));
    assert.ok(Math.abs(settings[0].account.balance - Number(audits[2].balanceAfter)) < 0.00001);
    lookup = async () => 15000;
    await run();
    assert.equal(transactions.length, 6, "fresh due-date validation prevents repeat posting");
  });
  test(`${kind}: unavailable FX is attempted once and leaves every overdue posting untouched`, async () => {
    reset(kind); lookup = async () => null;
    const before = structuredClone(settings);
    const result = await run();
    assert.equal(result.data?.failed, 2);
    assert.equal(lookups, 1);
    assert.equal(transactionStarts, 0);
    assert.deepEqual(settings, before);
    assert.equal(transactions.length, 0);
  });
  test(`${kind}: same-currency interest does not fetch FX`, async () => {
    reset(kind);
    for (const item of [...settings, ...listed]) item.account.currency = "IDR";
    await run();
    assert.equal(lookups, 0);
    assert.equal(transactions.length, 6);
    assert.ok(transactions.every(item => item.exchangeRate === 1));
  });
  for (const changed of ["account currency", "main currency", "owner", "account owner", "account id"] as const) {
    test(`${kind}: changed ${changed} rejects the prepared rate before writes`, async () => {
      reset(kind);
      for (const item of settings) {
        if (changed === "account currency") item.account.currency = "EUR";
        if (changed === "main currency") item.user.mainCurrency = "EUR";
        if (changed === "owner") item.userId = "new-owner";
        if (changed === "account owner") item.account.userId = "new-owner";
        if (changed === "account id") item.account.id = "new-account";
      }
      const result = await run();
      assert.equal(result.data?.failed, 2);
      assert.equal(transactions.length, 0);
      assert.equal(audits.length, 0);
    });
  }
  test(`${kind}: inactive accounts are cleaned up without waiting for unavailable FX`, async () => {
    reset(kind); lookup = async () => null;
    for (const item of [...settings, ...listed]) item.account.isActive = false;
    const result = await run();
    assert.equal(result.data?.failed, 0);
    assert.equal(lookups, 0);
    assert.equal(transactions.length, 0);
    for (const item of settings) {
      assert.equal(kind === "bank" ? item.nextPostingDate : item.nextInterestDate, null);
    }
  });
  test(`${kind}: reactivated accounts defer posting when no rate was prepared`, async () => {
    reset(kind);
    for (const item of listed) item.account.isActive = false;
    const result = await run();
    assert.equal(result.data?.failed, 2);
    assert.equal(lookups, 0);
    assert.equal(transactions.length, 0);
  });
  test(`${kind}: audit failure rolls back balance and transactions through the same callback`, async () => {
    reset(kind); failAudit = true;
    const before = structuredClone(settings);
    const result = await run();
    assert.equal(result.data?.failed, 2);
    assert.deepEqual(settings, before);
    assert.equal(transactions.length, 0);
    assert.equal(audits.length, 0);
  });
}

test("resolver deduplicates pending requests and preserves pair direction", async () => {
  const pairs: string[] = [];
  const resolve = createInterestExchangeRateResolver(async (from, to) => { pairs.push(`${from}/${to}`); return 2; });
  await Promise.all([resolve("USD", "IDR"), resolve("USD", "IDR"), resolve("IDR", "USD")]);
  assert.deepEqual(pairs, ["USD/IDR", "IDR/USD"]);
});

test("resolver caches invalid and rejected results only within its run", async () => {
  for (const value of [null, 0, -1, NaN, Infinity, "reject"] as const) {
    let calls = 0;
    const fetch = async () => { calls++; if (value === "reject") throw new Error("provider failed"); return value; };
    const resolve = createInterestExchangeRateResolver(fetch);
    await assert.rejects(resolve("USD", "IDR"));
    await assert.rejects(resolve("USD", "IDR"));
    assert.equal(calls, 1);
    await assert.rejects(createInterestExchangeRateResolver(fetch)("USD", "IDR"));
    assert.equal(calls, 2);
  }
});
