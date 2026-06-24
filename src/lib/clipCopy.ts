import { invoke } from "@tauri-apps/api/core";
import { Image as TauriImage } from "@tauri-apps/api/image";
import { readFile } from "@tauri-apps/plugin-fs";
import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Clip } from "../types";

function getImageMime(clip: Clip): string {
  if (clip.asset_mime?.startsWith("image/")) {
    return clip.asset_mime;
  }

  if (clip.content_type.startsWith("image/")) {
    return clip.content_type;
  }

  return "image/png";
}

function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const safeBytes = new Uint8Array(bytes);

  const arrayBuffer = safeBytes.buffer.slice(
    safeBytes.byteOffset,
    safeBytes.byteOffset + safeBytes.byteLength,
  );

  return new Blob([arrayBuffer], {
    type: mime,
  });
}

async function decodeImageToRgbaBytes(blob: Blob): Promise<{
  rgba: Uint8Array;
  width: number;
  height: number;
}> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new window.Image();
    image.decoding = "async";
    image.src = objectUrl;

    await image.decode();

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      throw new Error("Image has invalid dimensions");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create image canvas context");
    }

    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, width, height);

    // Important:
    // imageData.data is Uint8ClampedArray.
    // Tauri Image.new expects Uint8Array, ArrayBuffer, or number[].
    const rgba = new Uint8Array(imageData.data.buffer.slice(0));

    return {
      rgba,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function copyImageClip(clip: Clip): Promise<void> {
  if (!clip.asset_path) {
    throw new Error("No image asset path available for this clip");
  }

  const bytes = await readFile(clip.asset_path);
  const blob = bytesToBlob(bytes, getImageMime(clip));
  const decoded = await decodeImageToRgbaBytes(blob);

  const tauriImage = await TauriImage.new(
    decoded.rgba,
    decoded.width,
    decoded.height,
  );

  try {
    await writeImage(tauriImage);
  } finally {
    await tauriImage.close();
  }
}

async function copyFileClip(clip: Clip): Promise<void> {
  const filePath =
    clip.content_type === "file/backup" && clip.asset_path
      ? clip.asset_path
      : clip.content;

  if (!filePath) {
    throw new Error("No file path available for this clip");
  }

  await invoke<void>("write_file_paths_to_clipboard", {
    paths: [filePath],
  });
}

export async function copyClipToClipboard(clip: Clip): Promise<void> {
  if (clip.category === "image") {
    await copyImageClip(clip);
    return;
  }

  if (clip.category === "file") {
    await copyFileClip(clip);
    return;
  }

  await writeText(clip.content);
}

export function getCopyLabel(clip: Clip, copied: boolean): string {
  if (copied) return "Copied";

  if (clip.category === "image") return "Copy image";
  if (clip.category === "file") return "Copy file";

  return "Copy";
}

export function getCopyTitle(clip: Clip, copied: boolean): string {
  if (copied) return "Copied";

  if (clip.category === "image") return "Copy image to clipboard";
  if (clip.category === "file") return "Copy file to clipboard";

  return "Copy clip";
}
