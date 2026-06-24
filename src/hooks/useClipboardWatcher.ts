import { useEffect, useRef, useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import type { AppSettings } from "../types";
import { saveClip } from "../lib/db";
import { scanClipPrivacy } from "../lib/privacy";
import { getActiveApp, isIgnoredApp } from "../lib/activeApp";
import { saveClipboardImage } from "../lib/imageClipboard";
import {
  getNonImageFilePaths,
  saveFilePathFromPath,
} from "../lib/fileClipboard";
import {
  getImagePathFromClipboardText,
  saveImageFileFromPath,
  getFirstImagePathFromPaths,
  isSupportedImagePath,
} from "../lib/imageFileImport";
import { readNativeClipboardFilePaths } from "../lib/nativeClipboardFiles";

interface UseClipboardWatcherOptions {
  settings: AppSettings;
  intervalMs?: number;
  onSaved?: () => void;
  onSkipped?: (reason: string) => void;
}

export function useClipboardWatcher({
  settings,
  intervalMs = 1000,
  onSaved,
  onSkipped,
}: UseClipboardWatcherOptions) {
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const lastSeenTextRef = useRef<string>("");
  const lastSeenImageHashRef = useRef<string>("");
  const lastSeenImagePathRef = useRef<string>("");
  const isCheckingRef = useRef(false);
  const lastImageProbeAtRef = useRef(0);
  const lastSeenNativeFileKeyRef = useRef<string>("");

  const IMAGE_PROBE_COOLDOWN_MS = 3500;

  useEffect(() => {
    let cancelled = false;

    async function checkClipboard() {
      if (isCheckingRef.current) return;

      isCheckingRef.current = true;

      try {
        if (!settings.watchClipboard) return;
        if (settings.privateMode) return;

        if (settings.pauseUntil && settings.pauseUntil > Date.now()) {
          return;
        }

        const activeApp = await getActiveApp();

        if (isIgnoredApp(activeApp, settings.ignoredApps)) {
          onSkipped?.(
            activeApp?.app_name
              ? `ignored_app:${activeApp.app_name}`
              : "ignored_app",
          );
          return;
        }

        // 1. Try native copied files first.
        // This catches normal Finder Command+C file copies on macOS.
        const nativeFilePaths = await readNativeClipboardFilePaths();

        if (nativeFilePaths.length > 0) {
          const nativeFileKey = nativeFilePaths.join("\n");

          // Important:
          // If native file paths exist, do not continue to readImage().
          // macOS Finder can also expose a preview image on the clipboard,
          // which would create duplicate image clips.
          if (nativeFileKey === lastSeenNativeFileKeyRef.current) {
            return;
          }

          lastSeenNativeFileKeyRef.current = nativeFileKey;

          let savedAny = false;

          const imageFilePaths = nativeFilePaths.filter(isSupportedImagePath);
          const nonImagePaths = getNonImageFilePaths(nativeFilePaths);

          for (const path of imageFilePaths) {
            try {
              const saved = await saveImageFileFromPath(path);

              if (saved) {
                savedAny = true;
              }
            } catch (error) {
              console.debug(
                "Could not import native copied image file:",
                error,
              );
            }
          }

          for (const path of nonImagePaths) {
            try {
              const saved = await saveFilePathFromPath(path);

              if (saved) {
                savedAny = true;
              }
            } catch (error) {
              console.debug("Could not save copied file path:", error);
            }
          }

          if (savedAny) {
            setLastSavedAt(Date.now());
            onSaved?.();
            setError(null);
          }

          return;
        }

        // 1. Try image clipboard first.
        // This should fail silently when the clipboard is just text.
        const now = Date.now();
        const canProbeImage =
          now - lastImageProbeAtRef.current >= IMAGE_PROBE_COOLDOWN_MS;

        if (canProbeImage) {
          lastImageProbeAtRef.current = now;

          try {
            const imageResult = await saveClipboardImage({
              previousHash: lastSeenImageHashRef.current,
            });

            if (cancelled) return;

            if (imageResult.hash) {
              lastSeenImageHashRef.current = imageResult.hash;
            }

            if (imageResult.clip) {
              setLastSavedAt(Date.now());
              onSaved?.();
              setError(null);
              return;
            }

            if (imageResult.skipped) {
              return;
            }
          } catch (error) {
            console.debug("No image pixels on clipboard:", error);
          }
        }

        const nonImagePaths = getNonImageFilePaths(nativeFilePaths);

        if (nonImagePaths.length > 0) {
          let savedAny = false;

          for (const path of nonImagePaths) {
            try {
              const saved = await saveFilePathFromPath(path);

              if (saved) {
                savedAny = true;
              }
            } catch (error) {
              console.debug("Could not save copied file path:", error);
            }
          }

          if (savedAny) {
            setLastSavedAt(Date.now());
            onSaved?.();
            setError(null);
          }

          return;
        }

        // 2. Then try text clipboard.
        let text: string | null = null;

        try {
          text = await readText();
        } catch (err) {
          // This can happen when the clipboard contains an image, file, HTML,
          // or another non-text clipboard format. It does not always mean
          // permissions are broken.
          console.debug("No text clipboard content:", err);
          setError(null);
          return;
        }

        if (cancelled) return;

        const cleanText = text?.trim();

        if (!cleanText) return;

        if (cleanText === lastSeenTextRef.current) return;

        const imageFilePath = getImagePathFromClipboardText(cleanText);

        if (imageFilePath) {
          lastSeenTextRef.current = cleanText;

          if (imageFilePath === lastSeenImagePathRef.current) {
            return;
          }

          lastSeenImagePathRef.current = imageFilePath;

          try {
            const saved = await saveImageFileFromPath(imageFilePath);

            if (saved) {
              setLastSavedAt(Date.now());
              onSaved?.();
              setError(null);
              return;
            }

            // If it was a duplicate, still refresh once so the UI stays honest.
            onSaved?.();
            setError(null);
            return;
          } catch (error) {
            console.debug("Could not import copied image file:", error);
            setError(null);
            return;
          }
        }

        const privacyScan = scanClipPrivacy(cleanText, settings);

        if (!privacyScan.shouldSave) {
          lastSeenTextRef.current = cleanText;
          onSkipped?.(privacyScan.reason ?? "privacy_filter");
          return;
        }

        const saved = await saveClip(cleanText);

        lastSeenTextRef.current = cleanText;

        if (saved) {
          setLastSavedAt(Date.now());
          onSaved?.();
        }

        setError(null);
      } finally {
        isCheckingRef.current = false;
      }
    }

    checkClipboard();

    const timer = window.setInterval(checkClipboard, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings, intervalMs, onSaved, onSkipped]);

  return {
    error,
    lastSavedAt,
  };
}
