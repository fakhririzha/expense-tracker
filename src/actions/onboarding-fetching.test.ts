import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const moduleMock = (mock as unknown as {
  module: (specifier: string | URL, options: { defaultExport?: unknown; namedExports?: Record<string, unknown> }) => void;
}).module.bind(mock);
const models = ["financialAccount", "transaction", "budget", "recurringRule", "subscription"] as const;
let existing = new Set<string>();
let authenticated = true;
let row: Record<string, unknown> | null = null;
let fail = false;
let calls: string[] = [];
moduleMock(new URL("../auth.ts", import.meta.url), { namedExports: { auth: async () => authenticated ? { user: { id: "owner" } } : null } });
moduleMock("next/cache", { namedExports: { revalidatePath: () => { throw new Error("Unexpected revalidation"); } } });
moduleMock(new URL("../lib/db.ts", import.meta.url), { defaultExport: {
  ...Object.fromEntries(models.map(model => [model, { findFirst: async (args: unknown) => {
    calls.push(model); assert.deepEqual(args, { where: { userId: "owner" }, select: { id: true } });
    if (fail) throw new Error("read failure");
    return existing.has(model) ? { id: "owned-record" } : null;
  } }])),
  userOnboardingState: { findUnique: async (args: { where: unknown }) => {
    assert.deepEqual(args.where, { userId: "owner" }); return row;
  } },
} });
const { getOnboardingProgress } = await import("./onboarding-actions");
beforeEach(context => { existing = new Set(); authenticated = true; row = null; fail = false; calls = []; if ("mock" in context) context.mock.method(console, "error", () => {}); });
test("empty owned existence checks leave six checklist items incomplete", async () => {
  const result = await getOnboardingProgress(); assert.equal(result.success, true); assert.ok(result.data);
  assert.equal(result.data.completedCount, 0); assert.equal(result.data.totalCount, 6);
  assert.equal(result.data.shouldShowChecklist, true); assert.equal(result.data.isComplete, false);
  assert.ok(result.data.items.every(item => item.status === "incomplete" && item.ctaLabel === "Start"));
  assert.deepEqual(calls.sort(), [...models].sort());
});
test("recurring or subscription existence completes the same automatic item", async () => {
  for (const model of ["recurringRule", "subscription"]) {
    existing = new Set(["financialAccount", "transaction", "budget", model]);
    const result = await getOnboardingProgress(); assert.ok(result.data);
    assert.equal(result.data.completedCount, 4);
    assert.equal(result.data.items.find(item => item.id === "add_recurring_or_subscription")?.completionSource, "auto");
    assert.equal(result.data.items.find(item => item.id === "review_categories")?.status, "incomplete");
  }
});
test("tour completion does not hide incomplete progress; skipping hides it without erasing profile progress", async () => {
  existing = new Set(["financialAccount"]); row = { hasCompletedMainTour: true, hasSkippedOnboarding: false };
  const toured = await getOnboardingProgress(); assert.ok(toured.data); assert.equal(toured.data.shouldShowChecklist, true);
  row.hasSkippedOnboarding = true;
  const skipped = await getOnboardingProgress(); assert.ok(skipped.data);
  assert.equal(skipped.data.shouldShowChecklist, false); assert.equal(skipped.data.completedCount, 1);
  assert.deepEqual(skipped.data.items, toured.data.items);
});
test("manual completion and skipped items retain existing completion semantics", async () => {
  existing = new Set(models);
  row = { checklistState: { review_categories: { completed: true }, review_reports_or_insights: { skipped: true } } };
  const result = await getOnboardingProgress(); assert.ok(result.data);
  assert.equal(result.data.completedCount, 5); assert.equal(result.data.isComplete, true); assert.equal(result.data.shouldShowChecklist, false);
  assert.equal(result.data.items.find(item => item.id === "review_categories")?.completionSource, "manual");
  assert.equal(result.data.items.find(item => item.id === "review_reports_or_insights")?.status, "skipped");
});
test("unauthorized requests perform no existence reads", async () => {
  authenticated = false; const result = await getOnboardingProgress();
  assert.equal(result.success, false); assert.equal(result.error, "Unauthorized"); assert.deepEqual(calls, []);
});
test("read failure returns an action error instead of false completion", async () => {
  fail = true; const result = await getOnboardingProgress();
  assert.equal(result.success, false); assert.equal(result.error, "Failed to fetch onboarding progress");
});
