export type BoundedFormDataResult =
  | { success: true; data: FormData }
  | { success: false; error: string; tooLarge: boolean };

export async function readFormDataWithLimit(
  request: Request,
  maxBytes: number
): Promise<BoundedFormDataResult> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    return {
      success: false,
      error: "Upload a receipt image as multipart form data.",
      tooLarge: false,
    };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      success: false,
      error: "Receipt upload is too large.",
      tooLarge: true,
    };
  }

  if (!request.body) {
    return {
      success: false,
      error: "Please choose a bill photo to scan.",
      tooLarge: false,
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      return {
        success: false,
        error: "Receipt upload is too large.",
        tooLarge: true,
      };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const formData = await new Response(body, {
      headers: { "Content-Type": contentType },
    }).formData();
    return { success: true, data: formData };
  } catch {
    return {
      success: false,
      error: "Receipt upload could not be read.",
      tooLarge: false,
    };
  }
}
