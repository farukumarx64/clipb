import JSZip from "jszip";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import type {
  Clip,
  ClipBArchiveClip,
  ClipBArchiveClipTag,
  ClipBArchiveManifest,
  ClipBArchiveTag,
} from "../types";
import {
  addArchiveClipTag,
  getAllClipsForArchive,
  getAllClipTagsForArchive,
  getAllTags,
  importArchiveClip,
  upsertArchiveTag,
} from "./db";
import { createAssetFilename, deleteAssetFile, getAssetPath } from "./assets";

function getExtensionFromName(name: string | null): string {
  if (!name) return "bin";

  const cleanName = name.split(/[\\/]/).pop() ?? name;
  const parts = cleanName.split(".");

  if (parts.length < 2) return "bin";

  return parts[parts.length - 1]?.toLowerCase() || "bin";
}

function sanitizeArchiveAssetName(name: string): string {
  return name
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getArchiveAssetPath(clip: Clip): string | null {
  if (!clip.asset_path) return null;

  const extension = getExtensionFromName(clip.asset_name);
  const baseName = sanitizeArchiveAssetName(
    clip.asset_name ?? `clip-${clip.id}.${extension}`,
  );

  return `assets/${clip.id}-${baseName}`;
}

function toArchiveClip(
  clip: Clip,
  assetArchivePath: string | null,
): ClipBArchiveClip {
  return {
    old_id: clip.id,
    content: clip.content,
    content_hash: clip.content_hash,
    content_type: clip.content_type,
    category: clip.category,
    note: clip.note,
    asset_archive_path: assetArchivePath,
    asset_name: clip.asset_name,
    asset_size: clip.asset_size,
    asset_mime: clip.asset_mime,
    created_at: clip.created_at,
    updated_at: clip.updated_at,
    is_pinned: clip.is_pinned,
    is_favorite: clip.is_favorite,
  };
}

function toArchiveTag(tag: {
  id: number;
  name: string;
  created_at: number;
}): ClipBArchiveTag {
  return {
    old_id: tag.id,
    name: tag.name,
    created_at: tag.created_at,
  };
}

function isValidManifest(value: unknown): value is ClipBArchiveManifest {
  if (!value || typeof value !== "object") return false;

  const manifest = value as ClipBArchiveManifest;

  return manifest.app === "ClipB" && manifest.formatVersion === 1;
}

async function readJsonFile<T>(zip: JSZip, path: string): Promise<T> {
  const file = zip.file(path);

  if (!file) {
    throw new Error(`Missing ${path}`);
  }

  const text = await file.async("text");

  return JSON.parse(text) as T;
}

export async function exportClipBArchive(): Promise<{
  cancelled: boolean;
  exported: number;
  assets: number;
}> {
  const outputPath = await save({
    title: "Export ClipB archive",
    defaultPath: `clipb-${new Date().toISOString().slice(0, 10)}.clipb`,
    filters: [
      {
        name: "ClipB Archive",
        extensions: ["clipb"],
      },
    ],
  });

  if (!outputPath) {
    return {
      cancelled: true,
      exported: 0,
      assets: 0,
    };
  }

  const clips = await getAllClipsForArchive();
  const tags = await getAllTags();
  const clipTags = await getAllClipTagsForArchive();

  const zip = new JSZip();

  const manifest: ClipBArchiveManifest = {
    app: "ClipB",
    formatVersion: 1,
    exportedAt: Date.now(),
  };

  const archiveClips: ClipBArchiveClip[] = [];
  let assetCount = 0;

  for (const clip of clips) {
    const archiveAssetPath = getArchiveAssetPath(clip);

    if (clip.asset_path && archiveAssetPath) {
      try {
        const bytes = await readFile(clip.asset_path);
        zip.file(archiveAssetPath, bytes);
        assetCount++;
      } catch (error) {
        console.warn("Could not add asset to archive:", error);
      }
    }

    archiveClips.push(toArchiveClip(clip, archiveAssetPath));
  }

  const archiveTags = tags.map(toArchiveTag);

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("clips.json", JSON.stringify(archiveClips, null, 2));
  zip.file("tags.json", JSON.stringify(archiveTags, null, 2));
  zip.file("clip_tags.json", JSON.stringify(clipTags, null, 2));

  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });

  await writeFile(outputPath, bytes);

  return {
    cancelled: false,
    exported: clips.length,
    assets: assetCount,
  };
}

export async function importClipBArchive(): Promise<{
  cancelled: boolean;
  imported: number;
  skipped: number;
  tags: number;
}> {
  const selectedPath = await open({
    title: "Import ClipB archive",
    multiple: false,
    filters: [
      {
        name: "ClipB Archive",
        extensions: ["clipb"],
      },
    ],
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    return {
      cancelled: true,
      imported: 0,
      skipped: 0,
      tags: 0,
    };
  }

  const archiveBytes = await readFile(selectedPath);
  const zip = await JSZip.loadAsync(archiveBytes);

  const manifest = await readJsonFile<ClipBArchiveManifest>(
    zip,
    "manifest.json",
  );

  if (!isValidManifest(manifest)) {
    throw new Error("Invalid ClipB archive manifest");
  }

  const clips = await readJsonFile<ClipBArchiveClip[]>(zip, "clips.json");
  const tags = await readJsonFile<ClipBArchiveTag[]>(zip, "tags.json");
  const clipTags = await readJsonFile<ClipBArchiveClipTag[]>(
    zip,
    "clip_tags.json",
  );

  const oldClipIdToNewClipId = new Map<number, number>();
  const oldTagIdToNewTagId = new Map<number, number>();

  let imported = 0;
  let skipped = 0;
  let importedTags = 0;

  for (const tag of tags) {
    const savedTag = await upsertArchiveTag(tag);

    if (savedTag) {
      oldTagIdToNewTagId.set(tag.old_id, savedTag.id);
      importedTags++;
    }
  }

  for (const clip of clips) {
    let localAssetPath: string | null = null;

    if (clip.asset_archive_path) {
      const assetFile = zip.file(clip.asset_archive_path);

      if (assetFile) {
        const assetBytes = await assetFile.async("uint8array");
        const extension = getExtensionFromName(clip.asset_name);

        const filename = createAssetFilename({
          prefix: "imported",
          extension,
        });

        localAssetPath = await getAssetPath(filename);

        await writeFile(localAssetPath, assetBytes);
      }
    }

    const savedClip = await importArchiveClip(clip, localAssetPath);

    if (!savedClip) {
      skipped++;

      if (localAssetPath) {
        await deleteAssetFile(localAssetPath);
      }

      continue;
    }

    oldClipIdToNewClipId.set(clip.old_id, savedClip.id);
    imported++;
  }

  for (const clipTag of clipTags) {
    const newClipId = oldClipIdToNewClipId.get(clipTag.clip_old_id);
    const newTagId = oldTagIdToNewTagId.get(clipTag.tag_old_id);

    if (!newClipId || !newTagId) continue;

    await addArchiveClipTag({
      clipId: newClipId,
      tagId: newTagId,
    });
  }

  return {
    cancelled: false,
    imported,
    skipped,
    tags: importedTags,
  };
}
