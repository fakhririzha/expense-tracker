import assert from "node:assert/strict";
import { test } from "node:test";
import { createECDH } from "node:crypto";
import { applicationServerKeyMatches, pushRegistrationError } from "../src/lib/push-browser.ts";
import { pushDiagnostics, pushProvider } from "../src/lib/push-diagnostics.ts";
import { vapidKeysMatch } from "../src/lib/vapid-key-validation.ts";
import { validatePushEndpoint } from "../src/lib/push-subscription-security.ts";

test("VAPID pairs and browser keys distinguish current, stale and invalid keys", () => {
  const curve = createECDH("prime256v1");
  const pub = curve.generateKeys();
  const publicKey = pub.toString("base64url");
  assert.equal(vapidKeysMatch(publicKey, curve.getPrivateKey().toString("base64url")), true);
  const other = createECDH("prime256v1"); other.generateKeys();
  assert.equal(vapidKeysMatch(publicKey, other.getPrivateKey().toString("base64url")), false);
  assert.equal(vapidKeysMatch("invalid", "invalid"), false);
  assert.equal(applicationServerKeyMatches(Uint8Array.from(pub).buffer, publicKey), true);
  assert.equal(applicationServerKeyMatches(Uint8Array.from(other.getPublicKey()).buffer, publicKey), false);
  assert.equal(applicationServerKeyMatches(null, publicKey), false);
  assert.equal(applicationServerKeyMatches(Uint8Array.from(pub).buffer, "!"), false);
});

test("provider diagnostics never retain arbitrary response data", () => {
  const result = pushDiagnostics({ statusCode: 403, body: JSON.stringify({ reason: "VapidPkHashMismatch", endpoint: "secret" }), headers: { "apns-id": "12345678-1234-1234-1234-123456789abc", authorization: "secret" } });
  assert.equal(result.permanent, true);
  assert.equal(result.appleReason, "VapidPkHashMismatch");
  assert.ok(result.apnsId);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(pushDiagnostics({ body: '{"reason":"secret"}', headers: { "apns-id": "secret" } }).appleReason, undefined);
  assert.equal(pushDiagnostics({ statusCode: 403 }).permanent, false);
  for (const statusCode of [404, 410]) assert.equal(pushDiagnostics({ statusCode }).permanent, true);
  for (const statusCode of [429, 500, 503]) assert.equal(pushDiagnostics({ statusCode }).temporary, true);
  assert.equal(pushDiagnostics(new Error("secret timeout")).temporary, true);
});

test("endpoint allowlist and browser guidance", () => {
  for (const endpoint of ["broken", "https://evil.example/push", "http://fcm.googleapis.com/push", "https://fcm.googleapis.com@evil.example/push"]) assert.throws(() => validatePushEndpoint(endpoint));
  assert.equal(pushProvider(validatePushEndpoint("https://web.push.apple.com/test").href), "Apple");
  assert.match(pushRegistrationError(new Error("Registration failed - push service error")), /VPN or firewall/);
});
