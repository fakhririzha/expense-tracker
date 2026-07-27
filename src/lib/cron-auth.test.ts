import assert from "node:assert/strict";
import test from "node:test";

import { isCronRequestAuthorized } from "./cron-auth";

test("cron authorization fails closed without a configured secret", () => {
  const original = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(
      isCronRequestAuthorized(
        new Request("https://example.test", {
          headers: { authorization: "Bearer undefined" },
        })
      ),
      false
    );
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

test("cron authorization requires the exact bearer value", () => {
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "correct-secret";
    assert.equal(isCronRequestAuthorized(new Request("https://example.test")), false);
    assert.equal(
      isCronRequestAuthorized(new Request("https://example.test", { headers: { authorization: "bearer correct-secret" } })),
      false
    );
    assert.equal(
      isCronRequestAuthorized(new Request("https://example.test", { headers: { authorization: "Bearer  correct-secret" } })),
      false
    );
    assert.equal(
      isCronRequestAuthorized(new Request("https://example.test", { headers: { authorization: "Bearer correct-secret" } })),
      true
    );
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});
