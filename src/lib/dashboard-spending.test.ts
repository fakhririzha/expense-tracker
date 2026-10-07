import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as nodeModule from "node:module";
import { mock, test } from "node:test";
import { createElement } from "react";
import { startOfMonth } from "date-fns";

// Match Next's server-only alias when running outside its compiler.
const require = createRequire(import.meta.url);
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown;
  }) => void;
};
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "server-only" ? require.resolve("next/dist/compiled/server-only/empty") : specifier, context);
} });
const moduleMock = (mock as unknown as {
  module: (specifier: string | URL, options: { namedExports: Record<string, unknown> }) => void;
}).module.bind(mock);
interface SpendingInput { userId: string; types: string[]; from: Date; to: Date }
const calls: SpendingInput[] = [];
let fail = false;
moduleMock(new URL("./transaction-aggregates.ts", import.meta.url), { namedExports: {
  sumNormalizedAmount: async (input: SpendingInput) => {
    calls.push(input);
    if (fail) throw new Error("aggregate unavailable");
    return input.userId === "alice" ? 120 : 240;
  },
} });
const { getDashboardMonthSpending } = await import("./dashboard-spending");
const { getRequestNowIso } = await import("./server-request-clock");
const { renderToReadableStream } = require("next/dist/compiled/react-server-dom-webpack/server.node") as {
  renderToReadableStream: (element: ReturnType<typeof createElement>, manifest: Record<string, unknown>, options: { onError: (error: unknown) => void }) => ReadableStream;
};
async function render(work: () => Promise<unknown>) {
  async function Component() { return JSON.stringify(await work()); }
  let renderError: unknown;
  await new Response(renderToReadableStream(createElement(Component), {}, {
    onError: (error) => { renderError = error; },
  })).text();
  if (renderError) throw renderError;
}
const nowIso = "2026-10-07T08:00:00.000Z";

test("one server render shares a monthly aggregate and cutoff, while users remain isolated", async () => {
  calls.length = 0;
  await render(async () => {
    const firstClock = getRequestNowIso();
    assert.equal(getRequestNowIso(), firstClock);
    const values = await Promise.all([
      getDashboardMonthSpending("alice", nowIso),
      getDashboardMonthSpending("alice", new Date(nowIso).toISOString()),
      getDashboardMonthSpending("bob", nowIso),
    ]);
    assert.deepEqual(values, [120, 120, 240]);
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(input => input.userId).sort(), ["alice", "bob"]);
  for (const input of calls) {
    assert.deepEqual(input.types, ["EXPENSE", "LIABILITY_PAYMENT"]);
    assert.equal(input.from.getTime(), startOfMonth(new Date(nowIso)).getTime());
    assert.equal(input.to.toISOString(), nowIso);
  }
});

test("a later render recalculates spending even for identical user and date bounds", async () => {
  calls.length = 0;
  for (let index = 0; index < 2; index++) {
    await render(() => getDashboardMonthSpending("alice", nowIso));
  }
  assert.equal(calls.length, 2);
});

test("failed spending reads are shared within a render and retried by the next render", async () => {
  calls.length = 0;
  fail = true;
  await render(async () => {
    const results = await Promise.allSettled([
      getDashboardMonthSpending("alice", nowIso),
      getDashboardMonthSpending("alice", nowIso),
    ]);
    assert.deepEqual(results.map(result => result.status), ["rejected", "rejected"]);
  });
  assert.equal(calls.length, 1);
  fail = false;
  await render(async () => assert.equal(await getDashboardMonthSpending("alice", nowIso), 120));
  assert.equal(calls.length, 2);
});
