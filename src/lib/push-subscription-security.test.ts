import assert from "node:assert/strict";
import test from "node:test";

import {
  isPublicIpAddress,
  validatePushEndpoint,
  validatePushKey,
} from "./push-subscription-security";

test("allows only supported HTTPS push providers", () => {
  assert.equal(validatePushEndpoint("https://fcm.googleapis.com/send/abc").hostname, "fcm.googleapis.com");
  assert.equal(validatePushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc").hostname, "updates.push.services.mozilla.com");
  assert.throws(() => validatePushEndpoint("https://127.0.0.1/push"));
  assert.throws(() => validatePushEndpoint("https://evil.example/push"));
  assert.throws(() => validatePushEndpoint("https://fcm.googleapis.com:444/push"));
  assert.throws(() => validatePushEndpoint("https://user@fcm.googleapis.com/push"));
});

test("validates browser push key encodings and lengths", () => {
  const p256dh = Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64, 1)]).toString("base64url");
  const auth = Buffer.alloc(16, 2).toString("base64url");
  assert.equal(validatePushKey(p256dh, 65, 128), true);
  assert.equal(validatePushKey(auth, 16, 64), true);
  assert.equal(validatePushKey(`${auth}=`, 16, 64), false);
  assert.equal(validatePushKey(Buffer.alloc(16).toString("base64url"), 65, 128), false);
});

test("rejects non-public resolved addresses", () => {
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("127.0.0.1"), false);
  assert.equal(isPublicIpAddress("169.254.1.1"), false);
  assert.equal(isPublicIpAddress("2001:4860:4860::8888"), true);
  assert.equal(isPublicIpAddress("::1"), false);
  assert.equal(isPublicIpAddress("fc00::1"), false);
  assert.equal(isPublicIpAddress("2001:db8::1"), false);
});
