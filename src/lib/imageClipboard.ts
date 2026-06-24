import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { Clip } from "../types";
import { createAssetFilename, deleteAssetFile, getAssetPath } from "./assets";
import { hashBytes } from "./hash";
import { saveAssetClip } from "./db";

type EncodedImageMime = "image/webp" | "image/png";

interface EncodedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  mime: EncodedImageMime;
}

const MAX_IMAGE_SIDE = 1800;
const MAX_IMAGE_PIXELS = 2_500_000;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode image"));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function getScaledSize(width: number, height: number) {
  const sideScale = MAX_IMAGE_SIDE / Math.max(width, height);
  const pixelScale = Math.sqrt(MAX_IMAGE_PIXELS / (width * height));

  const scale = Math.min(1, sideScale, pixelScale);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: scale < 1,
  };
}

async function encodeRgbaToPreviewImage(options: {
  rgba: Uint8Array;
  width: number;
  height: number;
}): Promise<EncodedImage> {
  const sourceCanvas = document.createElement("canvas");

  sourceCanvas.width = options.width;
  sourceCanvas.height = options.height;

  const sourceContext = sourceCanvas.getContext("2d");

  if (!sourceContext) {
    throw new Error("Could not create image canvas context");
  }

  const imageData = new ImageData(
    new Uint8ClampedArray(options.rgba),
    options.width,
    options.height,
  );

  sourceContext.putImageData(imageData, 0, 0);

  const scaledSize = getScaledSize(options.width, options.height);

  const outputCanvas = document.createElement("canvas");

  outputCanvas.width = scaledSize.width;
  outputCanvas.height = scaledSize.height;

  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    throw new Error("Could not create output canvas context");
  }

  outputContext.drawImage(
    sourceCanvas,
    0,
    0,
    scaledSize.width,
    scaledSize.height,
  );

  const blob = await canvasToBlob(outputCanvas, "image/png");
  const mime: EncodedImageMime = "image/png";

  const arrayBuffer = await blob.arrayBuffer();

  return {
    bytes: new Uint8Array(arrayBuffer),
    width: scaledSize.width,
    height: scaledSize.height,
    mime,
  };
}

export async function saveClipboardImage(options?: {
  previousHash?: string;
}): Promise<{
  clip: Clip | null;
  hash: string | null;
  skipped: boolean;
}> {
  const clipboardImage = await readImage();

  try {
    const [rgba, size] = await Promise.all([
      clipboardImage.rgba(),
      clipboardImage.size(),
    ]);

    const imageHash = await hashBytes(rgba);

    if (options?.previousHash && imageHash === options.previousHash) {
      return {
        clip: null,
        hash: imageHash,
        skipped: true,
      };
    }

    const encoded = await encodeRgbaToPreviewImage({
      rgba,
      width: size.width,
      height: size.height,
    });

    const extension = "png";

    const filename = createAssetFilename({
      prefix: "image",
      extension,
    });

    const assetPath = await getAssetPath(filename);

    await writeFile(assetPath, encoded.bytes);

    const clip = await saveAssetClip({
      content: filename,
      contentHash: imageHash,
      contentType: encoded.mime,
      category: "image",
      assetPath,
      assetName: filename,
      assetSize: encoded.bytes.byteLength,
      assetMime: encoded.mime,
    });

    if (!clip) {
      await deleteAssetFile(assetPath);
    }

    return {
      clip,
      hash: imageHash,
      skipped: !clip,
    };
  } finally {
    await clipboardImage.close();
  }
}
