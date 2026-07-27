import assert from "node:assert/strict";
import test from "node:test";

import {
  EncryptionConfigurationError,
  getMasterKey,
  isValidKey,
} from "./encryption";

test("accepts only canonical Base64-encoded 32-byte master keys", () => {
  const valid = Buffer.alloc(32, 7).toString("base64");
  assert.equal(isValidKey(valid), true);
  assert.equal(isValidKey(` ${valid}`), false);
  assert.equal(isValidKey(valid.replace(/=$/, "")), false);
  assert.equal(isValidKey(Buffer.alloc(31).toString("base64")), false);
});

test("getMasterKey rejects missing and malformed configuration", () => {
  const original = process.env.ENCRYPTION_MASTER_KEY;
  try {
    delete process.env.ENCRYPTION_MASTER_KEY;
    assert.throws(() => getMasterKey(), EncryptionConfigurationError);
    process.env.ENCRYPTION_MASTER_KEY = "not-base64";
    assert.throws(() => getMasterKey(), EncryptionConfigurationError);
  } finally {
    if (original === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
    else process.env.ENCRYPTION_MASTER_KEY = original;
  }
});
