import { invoke } from "@tauri-apps/api/core";

export interface ActiveAppInfo {
  app_name: string;
  title: string;
  process_path: string;
  process_id: number;
}

export async function getActiveApp(): Promise<ActiveAppInfo | null> {
  try {
    return await invoke<ActiveAppInfo>("get_active_app");
  } catch (error) {
    console.warn("Could not get active app:", error);
    return null;
  }
}

function normalizeAppName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.app$/i, "")
    .replace(/\.exe$/i, "")
    .replace(/[\s_-]+/g, "");
}

export function isIgnoredApp(
  activeApp: ActiveAppInfo | null,
  ignoredApps: string[],
): boolean {
  if (!activeApp) return false;
  if (ignoredApps.length === 0) return false;

  const activeNames = [
    activeApp.app_name,
    activeApp.title,
    activeApp.process_path,
  ]
    .filter(Boolean)
    .map(normalizeAppName);

  return ignoredApps.some((ignoredApp) => {
    const normalizedIgnoredApp = normalizeAppName(ignoredApp);

    if (!normalizedIgnoredApp) return false;

    return activeNames.some((activeName) => {
      return (
        activeName === normalizedIgnoredApp ||
        activeName.includes(normalizedIgnoredApp)
      );
    });
  });
}
