import { invoke } from "@tauri-apps/api/core";

export async function readNativeClipboardFilePaths(): Promise<string[]> {
  try {
    return await invoke<string[]>("read_clipboard_file_paths");
  } catch (error) {
    console.debug("No native file paths on clipboard:", error);
    return [];
  }
}