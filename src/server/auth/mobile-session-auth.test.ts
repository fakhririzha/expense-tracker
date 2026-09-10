import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authenticateMobileRequestWithStore,
  deleteMobileSessionWithStore,
  type MobileSessionRecord,
  type MobileSessionStore,
} from "./mobile-session-auth";
import { hashMobileSessionToken } from "./mobile-session-token";

const token = "native-session-token";
const validSession: MobileSessionRecord = {
  id: "session-1",
  userId: "user-1",
  expiresAt: new Date("2026-10-10T00:00:00.000Z"),
  user: {
    id: "user-1",
    name: "Mobile User",
    email: "mobile@example.com",
    mainCurrency: "IDR",
  },
};

function createStore(
  session: MobileSessionRecord | null = validSession
): MobileSessionStore & { deletedIds: string[]; deletedHashes: string[] } {
  const deletedIds: string[] = [];
  const deletedHashes: string[] = [];
  return {
    deletedIds,
    deletedHashes,
    findByTokenHash: async (tokenHash) =>
      tokenHash === hashMobileSessionToken(token) ? session : null,
    deleteById: async (id) => {
      deletedIds.push(id);
    },
    deleteByTokenHash: async (tokenHash) => {
      deletedHashes.push(tokenHash);
      return tokenHash === hashMobileSessionToken(token);
    },
  };
}

describe("mobile session authentication", () => {
  it("rejects missing and unknown bearer tokens", async () => {
    const store = createStore();
    assert.equal(
      await authenticateMobileRequestWithStore(
        new Request("https://finhealth.example"),
        store
      ),
      null
    );
    assert.equal(
      await authenticateMobileRequestWithStore(
        new Request("https://finhealth.example", {
          headers: { Authorization: "Bearer unknown" },
        }),
        store
      ),
      null
    );
  });

  it("rejects and removes an expired session", async () => {
    const store = createStore({
      ...validSession,
      expiresAt: new Date("2026-09-09T00:00:00.000Z"),
    });
    const result = await authenticateMobileRequestWithStore(
      new Request("https://finhealth.example", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      store,
      new Date("2026-09-10T00:00:00.000Z")
    );
    assert.equal(result, null);
    assert.deepEqual(store.deletedIds, ["session-1"]);
  });

  it("returns only the user owned by the matching session", async () => {
    const store = createStore();
    const result = await authenticateMobileRequestWithStore(
      new Request("https://finhealth.example", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      store,
      new Date("2026-09-10T00:00:00.000Z")
    );
    assert.equal(result?.userId, "user-1");
    assert.equal(result?.user.email, "mobile@example.com");
  });

  it("revokes logout by token hash without passing the raw token to storage", async () => {
    const store = createStore();
    assert.equal(await deleteMobileSessionWithStore(token, store), true);
    assert.deepEqual(store.deletedHashes, [hashMobileSessionToken(token)]);
    assert.notEqual(store.deletedHashes[0], token);
  });
});
