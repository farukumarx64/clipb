import { invoke } from "@tauri-apps/api/core";
import type { Clip } from "../types";
import { saveAssetClip } from "./db";

interface ImportedImageAsset {
  content_hash: string;
  asset_path: string;
  asset_name: string;
  asset_size: number;
  asset_mime: Clip["content_type"];
}

const IMAGE_FILE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function fileUrlToPath(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "file:") return null;

    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

export function getImagePathFromClipboardText(text: string): string | null {
  const candidates = text
    .split(/\r?\n/)
    .map(stripWrappingQuotes)
    .map((line) => {
      if (line.startsWith("file://")) {
        return fileUrlToPath(line) ?? line;
      }

      return line;
    })
    .map((line) => line.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();

    if (
      IMAGE_FILE_EXTENSIONS.some((extension) =>
        lowerCandidate.endsWith(extension),
      )
    ) {
      return candidate;
    }
  }

  return null;
}

export async function saveImageFileFromPath(
  path: string,
): Promise<Clip | null> {
  const imported = await invoke<ImportedImageAsset>(
    "import_image_file_to_assets",
    {
      path,
    },
  );

  return saveAssetClip({
    content: path,
    contentHash: imported.content_hash,
    contentType: imported.asset_mime,
    category: "image",
    assetPath: imported.asset_path,
    assetName: imported.asset_name,
    assetSize: imported.asset_size,
    assetMime: imported.asset_mime,
  });
}

export function isSupportedImagePath(path: string): boolean {
  const lowerPath = path.toLowerCase();

  return IMAGE_FILE_EXTENSIONS.some((extension) =>
    lowerPath.endsWith(extension),
  );
}

export function getFirstImagePathFromPaths(paths: string[]): string | null {
  return paths.find(isSupportedImagePath) ?? null;
}
