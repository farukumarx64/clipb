import { invoke } from "@tauri-apps/api/core";
import type { Clip } from "../types";
import { saveFilePathClip } from "./db";
import { isSupportedImagePath } from "./imageFileImport";

interface FilePathInfo {
  path: string;
  name: string;
  size: number | null;
  is_file: boolean;
  is_dir: boolean;
}

export function getNonImageFilePaths(paths: string[]): string[] {
  return paths.filter((path) => !isSupportedImagePath(path));
}

export async function saveFilePathFromPath(path: string): Promise<Clip | null> {
  const info = await invoke<FilePathInfo>("inspect_file_path", {
    path,
  });

  return saveFilePathClip({
    path: info.path,
    name: info.name,
    size: info.size,
    isDirectory: info.is_dir,
  });
}
