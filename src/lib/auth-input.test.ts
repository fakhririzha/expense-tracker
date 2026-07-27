import assert from "node:assert/strict";
import test from "node:test";

import { loginSchema, normalizeAuthEmail, registerSchema } from "./auth-input";

test("normalizes authentication emails consistently", () => {
  assert.equal(normalizeAuthEmail("  User@Example.COM "), "user@example.com");
  assert.equal(loginSchema.parse({ email: " A@B.COM ", password: "legacy" }).email, "a@b.com");
});

test("requires stronger new passwords while preserving legacy login input", () => {
  assert.equal(loginSchema.safeParse({ email: "a@b.com", password: "123456" }).success, true);
  assert.equal(registerSchema.safeParse({ name: "Test", email: "a@b.com", password: "short", mainCurrency: "IDR" }).success, false);
  assert.equal(registerSchema.safeParse({ name: "Test", email: "a@b.com", password: "123456789012", mainCurrency: "idr" }).success, true);
  assert.equal(registerSchema.safeParse({ name: "Test", email: "a@b.com", password: "é".repeat(37), mainCurrency: "IDR" }).success, false);
});
