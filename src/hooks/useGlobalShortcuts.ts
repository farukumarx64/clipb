import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { showMainWindow, toggleQuickWindow } from "../lib/desktop";

const OPEN_MAIN_SHORTCUT = "CommandOrControl+Shift+B";
const QUICK_COPY_SHORTCUT = "CommandOrControl+Shift+V";

export function useGlobalShortcuts() {
  useEffect(() => {
    const shortcuts = [OPEN_MAIN_SHORTCUT, QUICK_COPY_SHORTCUT];

    async function setupShortcuts() {
      try {
        await unregister(shortcuts).catch(() => undefined);

        await register(shortcuts, async (event) => {
          if (event.state !== "Pressed") return;

          if (event.shortcut === OPEN_MAIN_SHORTCUT) {
            await showMainWindow();
          }

          if (event.shortcut === QUICK_COPY_SHORTCUT) {
            await toggleQuickWindow();
          }
        });
      } catch (error) {
        console.warn("Could not register global shortcuts:", error);
      }
    }

    setupShortcuts();

    return () => {
      unregister(shortcuts).catch(() => undefined);
    };
  }, []);
}

export const desktopShortcuts = {
  openMain: OPEN_MAIN_SHORTCUT,
  quickCopy: QUICK_COPY_SHORTCUT,
};
