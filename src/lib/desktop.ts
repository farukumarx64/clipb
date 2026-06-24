import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function showMainWindow() {
  await invoke("show_main_window");
}

export async function hideMainWindow() {
  await invoke("hide_main_window");
}

export async function toggleQuickWindow() {
  await invoke("toggle_quick_window");
}

export async function hideQuickWindow() {
  await invoke("hide_quick_window");
}

export async function quitClipB() {
  await invoke("quit_app");
}

export async function getLaunchOnStartupEnabled(): Promise<boolean> {
  return isEnabled();
}

export async function setLaunchOnStartup(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}
