import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  verifyCredentialsWithDependencies,
  type VerifyCredentialsDependencies,
} from "./verify-credentials-core";

const request = new Request("https://finhealth.example/api/mobile/v1/auth/login");
const validInput = { email: " USER@example.com ", password: "valid-password" };

function createDependencies(
  overrides: Partial<VerifyCredentialsDependencies> = {}
): VerifyCredentialsDependencies {
  return {
    consumeRateLimits: async () => true,
    findUser: async () => ({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      image: null,
      mainCurrency: "IDR",
      password: "stored-hash",
    }),
    comparePassword: async () => true,
    clearEmailRateLimit: async () => undefined,
    ...overrides,
  };
}

describe("credential verification", () => {
  it("rejects malformed credentials before consuming a rate-limit bucket", async () => {
    let consumed = false;
    const result = await verifyCredentialsWithDependencies(
      { email: "invalid", password: "" },
      request,
      createDependencies({
        consumeRateLimits: async () => {
          consumed = true;
          return true;
        },
      })
    );
    assert.equal(result, null);
    assert.equal(consumed, false);
  });

  it("rejects rate-limited and incorrect credentials", async () => {
    assert.equal(
      await verifyCredentialsWithDependencies(
        validInput,
        request,
        createDependencies({ consumeRateLimits: async () => false })
      ),
      null
    );
    assert.equal(
      await verifyCredentialsWithDependencies(
        validInput,
        request,
        createDependencies({ comparePassword: async () => false })
      ),
      null
    );
  });

  it("performs a dummy comparison when the user does not exist", async () => {
    let comparisons = 0;
    const result = await verifyCredentialsWithDependencies(
      validInput,
      request,
      createDependencies({
        findUser: async () => null,
        comparePassword: async () => {
          comparisons += 1;
          return false;
        },
      })
    );
    assert.equal(result, null);
    assert.equal(comparisons, 1);
  });

  it("normalizes email and clears the email bucket after success", async () => {
    let consumedEmail = "";
    let clearedEmail = "";
    const result = await verifyCredentialsWithDependencies(
      validInput,
      request,
      createDependencies({
        consumeRateLimits: async (email) => {
          consumedEmail = email;
          return true;
        },
        clearEmailRateLimit: async (email) => {
          clearedEmail = email;
        },
      })
    );
    assert.equal(result?.id, "user-1");
    assert.equal(consumedEmail, "user@example.com");
    assert.equal(clearedEmail, "user@example.com");
  });
});
