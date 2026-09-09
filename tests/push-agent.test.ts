import assert from "node:assert/strict";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import { test, mock } from "node:test";
import type { LookupFunction } from "node:net";
import { createSafePushAgent } from "../src/lib/push-subscription-security.ts";

test("safe DNS callback supports single and all address results without bypassing IP validation", async () => {
  let answers = [{ address: "17.57.146.1", family: 4 }, { address: "2620:149:208:4302::1", family: 6 }];
  const replacement = mock.method(dns, "lookup", (_host, options, callback) => {
    assert.equal(options.all, true);
    callback(null, answers);
  });
  syncBuiltinESMExports();
  const agent = createSafePushAgent();
  const lookup = agent.options.lookup as LookupFunction;
  try {
    const all = await new Promise((resolve, reject) => lookup("web.push.apple.com", { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)));
    assert.deepEqual(all, answers);
    await new Promise<void>((resolve, reject) => lookup("web.push.apple.com", { all: false }, (error, address, family) => {
      if (error) return reject(error);
      assert.equal(address, answers[0].address);
      assert.equal(family, 4);
      resolve();
    }));
    answers = [...answers, { address: "127.0.0.1", family: 4 }];
    await assert.rejects(new Promise((resolve, reject) => lookup("web.push.apple.com", { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses))), { name: "UnsafePushEndpointError" });
    answers = [];
    await assert.rejects(new Promise((resolve, reject) => lookup("web.push.apple.com", { all: false }, (error, addresses) => error ? reject(error) : resolve(addresses))), { name: "UnsafePushEndpointError" });
  } finally {
    agent.destroy();
    replacement.mock.restore();
    syncBuiltinESMExports();
  }
});
