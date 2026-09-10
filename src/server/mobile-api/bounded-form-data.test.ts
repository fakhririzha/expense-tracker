import assert from "node:assert/strict";
import test from "node:test";

import { readFormDataWithLimit } from "./bounded-form-data";

test("bounded form data accepts a multipart image within the request limit", async () => {
  const data = new FormData();
  data.append("image", new Blob([new Uint8Array(32)], { type: "image/jpeg" }), "receipt.jpg");
  const result = await readFormDataWithLimit(
    new Request("https://finhealth.example/api/mobile/v1/transactions/ocr", {
      method: "POST",
      body: data,
    }),
    4_096
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.get("image") instanceof File, true);
  }
});

test("bounded form data rejects a multipart body before it exceeds memory limits", async () => {
  const data = new FormData();
  data.append("image", new Blob([new Uint8Array(4_096)], { type: "image/jpeg" }), "receipt.jpg");
  const result = await readFormDataWithLimit(
    new Request("https://finhealth.example/api/mobile/v1/transactions/ocr", {
      method: "POST",
      body: data,
    }),
    1_024
  );

  assert.deepEqual(result, {
    success: false,
    error: "Receipt upload is too large.",
    tooLarge: true,
  });
});
