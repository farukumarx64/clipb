import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, remove } from "@tauri-apps/plugin-fs";

const ASSETS_DIR_NAME = "assets";

export async function getClipBAssetsDir(): Promise<string> {
  const dataDir = await appDataDir();
  const assetsDir = await join(dataDir, ASSETS_DIR_NAME);

  const alreadyExists = await exists(assetsDir);

  if (!alreadyExists) {
    await mkdir(assetsDir, {
      recursive: true,
    });
  }

  return assetsDir;
}

export async function getAssetPath(filename: string): Promise<string> {
  const assetsDir = await getClipBAssetsDir();

  return join(assetsDir, filename);
}

export async function deleteAssetFile(assetPath: string | null): Promise<void> {
  if (!assetPath) return;

  try {
    const assetExists = await exists(assetPath);

    if (!assetExists) return;

    await remove(assetPath);
  } catch (error) {
    console.warn("Could not delete asset file:", error);
  }
}

export function getAssetExtensionFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";

  return "bin";
}

export function createAssetFilename(options: {
  prefix: string;
  extension: string;
}): string {
  const safePrefix = options.prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${safePrefix || "asset"}-${randomPart}.${options.extension}`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "Unknown size";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}