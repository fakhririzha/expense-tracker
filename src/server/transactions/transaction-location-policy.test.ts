import assert from "node:assert/strict";
import test from "node:test";

import {
  haveTransactionCoordinatesChanged,
  haveTransactionMapsLinksChanged,
  hasValidTransactionCoordinatePair,
  isTrustedTransactionMapsLinkOrEmpty,
} from "./transaction-location-policy";

test("transaction location coordinates must be provided or cleared together", () => {
  assert.equal(hasValidTransactionCoordinatePair(-6.2, 106.816666), true);
  assert.equal(hasValidTransactionCoordinatePair(null, null), true);
  assert.equal(hasValidTransactionCoordinatePair(undefined, undefined), true);
  assert.equal(hasValidTransactionCoordinatePair(-6.2, undefined), false);
  assert.equal(hasValidTransactionCoordinatePair(null, 106.816666), false);
});

test("legacy maps links are grandfathered only while unchanged", () => {
  const legacyLink = "http://maps.google.com/legacy";

  assert.equal(haveTransactionMapsLinksChanged(undefined, legacyLink), false);
  assert.equal(haveTransactionMapsLinksChanged(legacyLink, legacyLink), false);
  assert.equal(
    haveTransactionMapsLinksChanged(` ${legacyLink} `, legacyLink),
    false
  );
  assert.equal(
    haveTransactionMapsLinksChanged("https://www.google.com/maps", legacyLink),
    true
  );
  assert.equal(haveTransactionMapsLinksChanged(null, legacyLink), true);
});

test("legacy coordinate metadata changes only when a supplied value differs", () => {
  const legacyCoordinates = { latitude: -6.2, longitude: null };

  assert.equal(
    haveTransactionCoordinatesChanged({ latitude: -6.2 }, legacyCoordinates),
    false
  );
  assert.equal(
    haveTransactionCoordinatesChanged({ longitude: 106.816666 }, legacyCoordinates),
    true
  );
  assert.equal(
    haveTransactionCoordinatesChanged(
      { latitude: null, longitude: null },
      legacyCoordinates
    ),
    true
  );
});

test("transaction maps links must use trusted HTTPS hosts when present", () => {
  assert.equal(isTrustedTransactionMapsLinkOrEmpty(""), true);
  assert.equal(
    isTrustedTransactionMapsLinkOrEmpty("https://www.google.com/maps?q=-6.2,106.8"),
    true
  );
  assert.equal(
    isTrustedTransactionMapsLinkOrEmpty("https://maps.app.goo.gl/example"),
    true
  );
  assert.equal(isTrustedTransactionMapsLinkOrEmpty("http://google.com/maps"), false);
  assert.equal(isTrustedTransactionMapsLinkOrEmpty("https://example.com/maps"), false);
  assert.equal(isTrustedTransactionMapsLinkOrEmpty("not a URL"), false);
});
