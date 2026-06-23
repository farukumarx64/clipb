export type ViewMode = "day" | "week" | "month" | "year";

export type RetentionDays = "never" | "7" | "30" | "90" | "180" | "365";

export type ThemeMode = "system" | "light" | "dark";

export interface Clip {
  id: number;
  content: string;
  content_hash: string;
  content_type: "text/plain";
  created_at: number;
  updated_at: number;
  is_pinned: number;
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
