import assert from "node:assert/strict";
import test from "node:test";

import {
  createMobileSessionToken,
  extractBearerToken,
  hashMobileSessionToken,
  isMobileSessionExpired,
} from "./mobile-session-token";

test("mobile session tokens are random, URL-safe, and stored as hashes", () => {
  const first = createMobileSessionToken();
  const second = createMobileSessionToken();

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.equal(hashMobileSessionToken(first).length, 64);
  assert.notEqual(hashMobileSessionToken(first), first);
});

test("sessions expire exactly at their expiry instant", () => {
  const expiry = new Date("2026-09-10T12:00:00.000Z");
  assert.equal(
    isMobileSessionExpired(expiry, new Date("2026-09-10T11:59:59.999Z")),
    false
  );
  assert.equal(isMobileSessionExpired(expiry, expiry), true);
});

test("bearer parsing rejects missing and malformed authorization", () => {
  assert.equal(extractBearerToken(new Request("https://example.com")), null);
  assert.equal(
    extractBearerToken(
      new Request("https://example.com", {
        headers: { Authorization: "Basic abc" },
      })
    ),
    null
  );
  assert.equal(
    extractBearerToken(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer token-value" },
      })
    ),
    "token-value"
  );
});
