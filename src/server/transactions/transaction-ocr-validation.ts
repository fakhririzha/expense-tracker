export const MAX_OCR_IMAGE_SIZE = 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const IMAGE_EXTENSION_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export function getOcrImageMimeType(file: Pick<File, "name" | "type">) {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return file.type;

  const fileName = file.name.toLowerCase();
  const extension = Object.keys(IMAGE_EXTENSION_TYPES).find((item) =>
    fileName.endsWith(item)
  );
  return extension ? IMAGE_EXTENSION_TYPES[extension] : null;
}

export function validateOcrImageFile(
  file: Pick<File, "name" | "type" | "size">
): { success: true; mimeType: string } | { success: false; error: string } {
  const mimeType = getOcrImageMimeType(file);
  if (!mimeType) {
    return {
      success: false,
      error: "Use a JPEG, PNG, WebP, HEIC, or HEIF image.",
    };
  }

  if (file.size >= MAX_OCR_IMAGE_SIZE) {
    return {
      success: false,
      error: "Compressed bill photo must be smaller than 1 MB.",
    };
  }

  return { success: true, mimeType };
}
