import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_OCR_IMAGE_SIZE,
  validateOcrImageFile,
} from "./transaction-ocr-validation";

test("OCR rejects unsupported image types", () => {
  assert.deepEqual(
    validateOcrImageFile({
      name: "receipt.pdf",
      type: "application/pdf",
      size: 100,
    }),
    {
      success: false,
      error: "Use a JPEG, PNG, WebP, HEIC, or HEIF image.",
    }
  );
});

test("OCR requires the compressed image to be strictly smaller than 1 MB", () => {
  assert.equal(
    validateOcrImageFile({
      name: "receipt.jpg",
      type: "image/jpeg",
      size: MAX_OCR_IMAGE_SIZE - 1,
    }).success,
    true
  );
  assert.equal(
    validateOcrImageFile({
      name: "receipt.jpg",
      type: "image/jpeg",
      size: MAX_OCR_IMAGE_SIZE,
    }).success,
    false
  );
});
