import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { ImageIcon } from "lucide-react";
import { formatBytes } from "../lib/assets";

interface AssetImageProps {
  assetPath: string | null;
  assetMime: string | null;
  assetName: string | null;
  assetSize: number | null;
}

export function AssetImage({
  assetPath,
  assetMime,
  assetName,
  assetSize,
}: AssetImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      if (!assetPath) {
        setFailed(true);
        return;
      }

      try {
        setFailed(false);

        const bytes = await readFile(assetPath);
        const blob = new Blob([bytes], {
          type: assetMime ?? "image/png",
        });

        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setSrc(objectUrl);
        }
      } catch (error) {
        console.error("Could not load image asset:", error);

        if (!cancelled) {
          setFailed(true);
          setSrc(null);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [assetPath, assetMime]);

  if (failed || !src) {
    return (
      <div className="clip-asset-preview__placeholder">
        <ImageIcon size={24} aria-hidden="true" />
        <span>{assetName ?? "Clipboard image"}</span>
        <small>{formatBytes(assetSize)}</small>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={assetName ?? "Clipboard image"}
      loading="lazy"
    />
  );
}