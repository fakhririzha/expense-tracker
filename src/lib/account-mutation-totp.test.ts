import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";

test("generates a valid six-digit account mutation TOTP", async () => {
  const { createAccountMutationTotp } = await import("./account-mutation-totp");
  const totp = createAccountMutationTotp("JBSWY3DPEHPK3PXP", "user@example.com");
  const token = totp.generate();

  assert.match(token, /^\d{6}$/);
  assert.notEqual(totp.validate({ token, window: 0 }), null);
  assert.equal(totp.validate({ token: "000000", window: 0 }), null);
});

test("normalizes recovery code formatting before hashing", async () => {
  const originalSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-auth-secret";
  try {
    const {
      generateAccountMutationRecoveryCode,
      hashAccountMutationRecoveryCode,
    } = await import("./account-mutation-totp");
    const code = generateAccountMutationRecoveryCode();

    assert.match(code, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
    assert.equal(
      hashAccountMutationRecoveryCode(code),
      hashAccountMutationRecoveryCode(code.replaceAll("-", "").toLowerCase())
    );
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  }
});
