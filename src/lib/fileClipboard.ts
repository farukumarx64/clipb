import { invoke } from "@tauri-apps/api/core";
import type { Clip } from "../types";
import {
  saveBackedUpFileClip,
  saveFilePathClip,
} from "./db";
import { deleteAssetFile } from "./assets";
import { isSupportedImagePath } from "./imageFileImport";

interface FilePathInfo {
  path: string;
  name: string;
  size: number | null;
  is_file: boolean;
  is_dir: boolean;
}

interface BackedUpFileAsset {
  content_hash: string;
  asset_path: string;
  asset_name: string;
  asset_size: number;
  asset_mime: string;
}

export function getNonImageFilePaths(paths: string[]): string[] {
  return paths.filter((path) => !isSupportedImagePath(path));
}

async function inspectFilePath(path: string): Promise<FilePathInfo> {
  return invoke<FilePathInfo>("inspect_file_path", {
    path,
  });
}

async function backupFileToAssets(options: {
  path: string;
  maxSizeBytes: number;
}): Promise<BackedUpFileAsset> {
  return invoke<BackedUpFileAsset>("backup_file_to_assets", {
    path: options.path,
    max_size_bytes: options.maxSizeBytes,
  });
}

export async function saveFilePathFromPath(
  path: string,
  options?: {
    backupCopiedFiles?: boolean;
    maxBackupFileSizeMb?: number;
  },
): Promise<Clip | null> {
  const info = await inspectFilePath(path);

  const shouldBackup =
    Boolean(options?.backupCopiedFiles) &&
    info.is_file &&
    !info.is_dir;

  if (!shouldBackup) {
    return saveFilePathClip({
      path: info.path,
      name: info.name,
      size: info.size,
      isDirectory: info.is_dir,
    });
  }

  const maxBackupFileSizeMb = options?.maxBackupFileSizeMb ?? 25;
  const maxSizeBytes = maxBackupFileSizeMb * 1024 * 1024;

  try {
    const backedUpFile = await backupFileToAssets({
      path: info.path,
      maxSizeBytes,
    });

    const clip = await saveBackedUpFileClip({
      originalPath: info.path,
      contentHash: backedUpFile.content_hash,
      assetPath: backedUpFile.asset_path,
      assetName: backedUpFile.asset_name,
      assetSize: backedUpFile.asset_size,
      assetMime: backedUpFile.asset_mime,
    });

    if (!clip) {
      await deleteAssetFile(backedUpFile.asset_path);
    }

    return clip;
  } catch (error) {
    console.debug("Could not back up file, saving path only:", error);

    return saveFilePathClip({
      path: info.path,
      name: info.name,
      size: info.size,
      isDirectory: info.is_dir,
    });
  }
}