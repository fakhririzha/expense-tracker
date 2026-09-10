import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

const MAX_RECEIPT_BYTES = 1_000_000;

export async function prepareReceiptImage(asset: ImagePickerAsset) {
  if (asset.type && asset.type !== "image") throw new Error("Please choose an image of your receipt.");

  let width = Math.min(asset.width || 1600, 1600);
  let resultFile: File | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rendered = await ImageManipulator.manipulate(asset.uri)
      .resize({ width })
      .renderAsync();
    const saved = await rendered.saveAsync({
      compress: Math.max(0.2, 0.78 - attempt * 0.13),
      format: SaveFormat.JPEG,
    });
    const file = new File(saved.uri);
    const size = file.info().size ?? file.size;
    if (size > 0 && size < MAX_RECEIPT_BYTES) return file;
    resultFile = file;
    width = Math.max(640, Math.round(width * 0.78));
  }

  throw new Error(
    `This image is still too large to scan (${Math.ceil((resultFile?.size ?? 0) / 1024)} KB). Try a closer, simpler photo.`,
  );
}
