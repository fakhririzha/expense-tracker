import assert from "node:assert/strict";
import test from "node:test";

test("hashes rate-limit identifiers with scope separation", async () => {
  process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
  const originalSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-auth-secret";
  try {
    const { hashAuthRateLimitKey } = await import("./auth-rate-limit");
    const emailHash = hashAuthRateLimitKey("LOGIN_EMAIL", "user@example.com");
    const registrationHash = hashAuthRateLimitKey("REGISTER_EMAIL", "user@example.com");
    assert.match(emailHash, /^[a-f0-9]{64}$/);
    assert.notEqual(emailHash, registrationHash);
    assert.equal(emailHash.includes("user@example.com"), false);
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  }
});

test("trusts only configured platform or proxy client IP headers", async () => {
  process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
  const { getTrustedClientIp } = await import("./auth-rate-limit");
  const originalVercel = process.env.VERCEL;
  const originalTrustProxy = process.env.AUTH_TRUST_PROXY;
  try {
    delete process.env.VERCEL;
    delete process.env.AUTH_TRUST_PROXY;
    const spoofed = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    assert.equal(getTrustedClientIp(spoofed), null);

    process.env.AUTH_TRUST_PROXY = "true";
    assert.equal(getTrustedClientIp(spoofed), "203.0.113.10");
    assert.equal(
      getTrustedClientIp(
        new Request("https://example.test", {
          headers: { "x-forwarded-for": "invalid" },
        })
      ),
      null
    );
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalTrustProxy === undefined) delete process.env.AUTH_TRUST_PROXY;
    else process.env.AUTH_TRUST_PROXY = originalTrustProxy;
  }
});
