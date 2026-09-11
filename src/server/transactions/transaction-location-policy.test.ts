import assert from "node:assert/strict";
import test from "node:test";

import {
  hasValidTransactionCoordinatePair,
  isHttpsTransactionMapsLinkOrEmpty,
} from "./transaction-location-policy";

test("transaction location coordinates must be provided or cleared together", () => {
  assert.equal(hasValidTransactionCoordinatePair(-6.2, 106.816666), true);
  assert.equal(hasValidTransactionCoordinatePair(null, null), true);
  assert.equal(hasValidTransactionCoordinatePair(undefined, undefined), true);
  assert.equal(hasValidTransactionCoordinatePair(-6.2, undefined), false);
  assert.equal(hasValidTransactionCoordinatePair(null, 106.816666), false);
});

test("transaction maps links must use HTTPS when present", () => {
  assert.equal(isHttpsTransactionMapsLinkOrEmpty(""), true);
  assert.equal(
    isHttpsTransactionMapsLinkOrEmpty("https://www.google.com/maps?q=-6.2,106.8"),
    true
  );
  assert.equal(isHttpsTransactionMapsLinkOrEmpty("http://example.com"), false);
  assert.equal(isHttpsTransactionMapsLinkOrEmpty("not a URL"), false);
});
