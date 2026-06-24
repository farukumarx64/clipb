export type ViewMode = "day" | "week" | "month" | "year";

export type RetentionDays = "never" | "7" | "30" | "90" | "180" | "365";

export type ThemeMode = "system" | "light" | "dark";

export type ClipCategory = "text" | "url" | "code" | "image" | "file";

export type ClipContentFilter =
  | "all"
  | "text"
  | "url"
  | "code"
  | "image"
  | "file";

export interface ClipFilters {
  query?: string;
  contentFilter: ClipContentFilter;
  pinnedOnly: boolean;
  favoritesOnly: boolean;
  selectedTagId: number | null;
}

export interface Clip {
  id: number;
  content: string;
  content_hash: string;
  content_type: ClipContentType;
  category: ClipCategory;
  note: string | null;

  asset_path: string | null;
  asset_name: string | null;
  asset_size: number | null;
  asset_mime: string | null;

  created_at: number;
  updated_at: number;
  is_pinned: number;
  is_favorite: number;
}

export interface DailyCount {
  day: string;
  count: number;
}

export interface AppSettings {
  historyRetentionDays: RetentionDays;
  protectPinnedClips: boolean;
  watchClipboard: boolean;
  themeMode: ThemeMode;
  launchOnStartup: boolean;

  minClipLength: number;
  maxClipLength: number;
  ignoreSensitiveClips: boolean;
  ignoreLikelyPasswords: boolean;
  ignoreLikelyApiKeys: boolean;
  privateMode: boolean;
  pauseUntil: number | null;
  ignoredApps: string[];

  backupCopiedFiles: boolean;
  maxBackupFileSizeMb: number;
}

export interface ExportedClip {
  type: "text/plain";
  content: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
}

export interface ClipBExportFile {
  app: "ClipB";
  formatVersion: 1;
  exportedAt: number;
  clips: ExportedClip[];
}

export interface Tag {
  id: number;
  name: string;
  created_at: number;
}

export interface ClipTag {
  clip_id: number;
  tag_id: number;
  name: string;
}

export type ClipContentType =
  | "text/plain"
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif"
  | "file/path"
  | "file/backup";

export interface ClipBArchiveManifest {
  app: "ClipB";
  formatVersion: 1;
  exportedAt: number;
}

export interface ClipBArchiveClip {
  old_id: number;
  content: string;
  content_hash: string;
  content_type: ClipContentType;
  category: ClipCategory;
  note: string | null;
  asset_archive_path: string | null;
  asset_name: string | null;
  asset_size: number | null;
  asset_mime: string | null;
  created_at: number;
  updated_at: number;
  is_pinned: number;
  is_favorite: number;
}

export interface ClipBArchiveTag {
  old_id: number;
  name: string;
  created_at: number;
}

export interface ClipBArchiveClipTag {
  clip_old_id: number;
  tag_old_id: number;
}

export interface ClipBArchivePayload {
  manifest: ClipBArchiveManifest;
  clips: ClipBArchiveClip[];
  tags: ClipBArchiveTag[];
  clipTags: ClipBArchiveClipTag[];
}
