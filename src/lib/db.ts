import Database from "@tauri-apps/plugin-sql";
import type {
  AppSettings,
  Clip,
  DailyCount,
  ExportedClip,
  RetentionDays,
  ThemeMode,
} from "../types";
import { hashText } from "./hash";
import { detectClipCategory } from "./clipDetection";
import type { ClipTag, Tag } from "../types";
import type { ClipFilters } from "../types";

const DB_URL = "sqlite:clipb.db";

type Db = Awaited<ReturnType<typeof Database.load>>;

let dbPromise: Promise<Db> | null = null;

const DEFAULT_SETTINGS: AppSettings = {
  historyRetentionDays: "never",
  protectPinnedClips: true,
  watchClipboard: true,
  themeMode: "system",
  launchOnStartup: false,

  minClipLength: 2,
  maxClipLength: 50000,
  ignoreSensitiveClips: true,
  ignoreLikelyPasswords: true,
  ignoreLikelyApiKeys: true,
  privateMode: false,
  pauseUntil: null,
  ignoredApps: [],
};

async function tryExecute(db: Db, sql: string) {
  try {
    await db.execute(sql);
  } catch (error) {
    const message = String(error).toLowerCase();

    if (
      message.includes("duplicate column") ||
      message.includes("already exists")
    ) {
      return;
    }

    throw error;
  }
}

function getBooleanSetting(
  map: Map<string, string>,
  key: string,
  fallback: boolean,
): boolean {
  const value = map.get(key);

  if (value === undefined) return fallback;

  return value === "true";
}

function getNumberSetting(
  map: Map<string, string>,
  key: string,
  fallback: number,
): number {
  const value = map.get(key);

  if (value === undefined) return fallback;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function getNullableNumberSetting(
  map: Map<string, string>,
  key: string,
  fallback: number | null,
): number | null {
  const value = map.get(key);

  if (value === undefined || value === "null") return fallback;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function getStringArraySetting(
  map: Map<string, string>,
  key: string,
  fallback: string[],
): string[] {
  const value = map.get(key);

  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return fallback;

    return parsed.filter((item) => typeof item === "string");
  } catch {
    return fallback;
  }
}

async function initDb(db: Db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'text/plain',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_clips_created_at
    ON clips(created_at DESC);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_clips_hash
    ON clips(content_hash);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_clips_pinned
    ON clips(is_pinned);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await db.execute(
    `
      INSERT OR IGNORE INTO settings (key, value)
      VALUES (?, ?);
    `,
    ["theme_mode", DEFAULT_SETTINGS.themeMode],
  );

  await db.execute(
    `
      INSERT OR IGNORE INTO settings (key, value)
      VALUES (?, ?);
    `,
    ["protect_pinned_clips", String(DEFAULT_SETTINGS.protectPinnedClips)],
  );

  await db.execute(
    `
      INSERT OR IGNORE INTO settings (key, value)
      VALUES (?, ?);
    `,
    ["watch_clipboard", String(DEFAULT_SETTINGS.watchClipboard)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["launch_on_startup", String(DEFAULT_SETTINGS.launchOnStartup)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["min_clip_length", String(DEFAULT_SETTINGS.minClipLength)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["max_clip_length", String(DEFAULT_SETTINGS.maxClipLength)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignore_sensitive_clips", String(DEFAULT_SETTINGS.ignoreSensitiveClips)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignore_likely_passwords", String(DEFAULT_SETTINGS.ignoreLikelyPasswords)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignore_likely_api_keys", String(DEFAULT_SETTINGS.ignoreLikelyApiKeys)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["private_mode", String(DEFAULT_SETTINGS.privateMode)],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["pause_until", "null"],
  );

  await db.execute(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignored_apps", JSON.stringify(DEFAULT_SETTINGS.ignoredApps)],
  );

  await tryExecute(
    db,
    `
    ALTER TABLE clips ADD COLUMN category TEXT NOT NULL DEFAULT 'text';
  `,
  );

  await tryExecute(
    db,
    `
    ALTER TABLE clips ADD COLUMN note TEXT DEFAULT NULL;
  `,
  );

  await tryExecute(
    db,
    `
    ALTER TABLE clips ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
  `,
  );

  await db.execute(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );
`);

  await db.execute(`
  CREATE TABLE IF NOT EXISTS clip_tags (
    clip_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (clip_id, tag_id),
    FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`);
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).then(async (db) => {
      await initDb(db);
      return db;
    });
  }

  return dbPromise;
}

export async function saveClip(content: string): Promise<Clip | null> {
  const cleanContent = content.trim();

  if (!cleanContent) return null;

  const category = detectClipCategory(cleanContent);
  const now = Date.now();
  const contentHash = hashText(cleanContent);
  const db = await getDb();

  const latest = await db.select<Clip[]>(
    `
      SELECT *
      FROM clips
      ORDER BY created_at DESC
      LIMIT 1;
    `,
  );

  const latestClip = latest[0];

  if (
    latestClip &&
    latestClip.content_hash === contentHash &&
    latestClip.content === cleanContent
  ) {
    return null;
  }

  const result = await db.execute(
    `
      INSERT INTO clips (
        content,
        content_hash,
        content_type,
        category,
        note,
        created_at,
        updated_at,
        is_pinned,
        is_favorite
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [cleanContent, contentHash, "text/plain", category, null, now, now, 0, 0],
  );

  const insertedId = result.lastInsertId;

  if (!insertedId) return null;

  const rows = await db.select<Clip[]>(
    `
      SELECT *
      FROM clips
      WHERE id = ?;
    `,
    [insertedId],
  );

  return rows[0] ?? null;
}

export async function getClips(options: {
  start: number;
  end: number;
  query?: string;
}): Promise<Clip[]> {
  const db = await getDb();
  const search = options.query?.trim();

  if (search) {
    return db.select<Clip[]>(
      `
        SELECT *
        FROM clips
        WHERE created_at >= ?
          AND created_at < ?
          AND content LIKE ?
        ORDER BY is_pinned DESC, created_at DESC
        LIMIT 500;
      `,
      [options.start, options.end, `%${search}%`],
    );
  }

  return db.select<Clip[]>(
    `
      SELECT *
      FROM clips
      WHERE created_at >= ?
        AND created_at < ?
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 500;
    `,
    [options.start, options.end],
  );
}

export async function getRecentClips(options?: {
  query?: string;
  limit?: number;
}): Promise<Clip[]> {
  const db = await getDb();

  const query = options?.query?.trim();
  const limit = options?.limit ?? 30;

  if (query) {
    return db.select<Clip[]>(
      `
        SELECT *
        FROM clips
        WHERE content_type = 'text/plain'
          AND content LIKE ?
        ORDER BY is_pinned DESC, created_at DESC
        LIMIT ?;
      `,
      [`%${query}%`, limit],
    );
  }

  return db.select<Clip[]>(
    `
      SELECT *
      FROM clips
      WHERE content_type = 'text/plain'
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT ?;
    `,
    [limit],
  );
}

export async function getAllTextClips(): Promise<Clip[]> {
  const db = await getDb();

  return db.select<Clip[]>(
    `
      SELECT *
      FROM clips
      WHERE content_type = 'text/plain'
      ORDER BY created_at ASC;
    `,
  );
}

export async function getDailyCountsForMonth(
  date: Date,
): Promise<DailyCount[]> {
  const db = await getDb();

  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();

  return db.select<DailyCount[]>(
    `
      SELECT
        strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') as day,
        COUNT(*) as count
      FROM clips
      WHERE created_at >= ?
        AND created_at < ?
      GROUP BY day
      ORDER BY day ASC;
    `,
    [start, end],
  );
}

export async function deleteClip(id: number): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      DELETE FROM clips
      WHERE id = ?;
    `,
    [id],
  );
}

export async function togglePinClip(
  id: number,
  currentValue: number,
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      UPDATE clips
      SET is_pinned = ?, updated_at = ?
      WHERE id = ?;
    `,
    [currentValue ? 0 : 1, Date.now(), id],
  );
}

export async function clearAllClips(): Promise<number> {
  const db = await getDb();

  const result = await db.execute(`
    DELETE FROM clips;
  `);

  return result.rowsAffected ?? 0;
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDb();

  const rows = await db.select<Array<{ key: string; value: string }>>(
    `
      SELECT key, value
      FROM settings;
    `,
  );

  const map = new Map(rows.map((row) => [row.key, row.value]));

  const retentionValue = map.get("history_retention_days");

  const validRetentionValues: RetentionDays[] = [
    "never",
    "7",
    "30",
    "90",
    "180",
    "365",
  ];

  const historyRetentionDays = validRetentionValues.includes(
    retentionValue as RetentionDays,
  )
    ? (retentionValue as RetentionDays)
    : DEFAULT_SETTINGS.historyRetentionDays;

  const themeValue = map.get("theme_mode");

  const validThemeValues: ThemeMode[] = ["system", "light", "dark"];

  const themeMode = validThemeValues.includes(themeValue as ThemeMode)
    ? (themeValue as ThemeMode)
    : DEFAULT_SETTINGS.themeMode;

  return {
    historyRetentionDays,
    themeMode,

    protectPinnedClips: getBooleanSetting(
      map,
      "protect_pinned_clips",
      DEFAULT_SETTINGS.protectPinnedClips,
    ),

    watchClipboard: getBooleanSetting(
      map,
      "watch_clipboard",
      DEFAULT_SETTINGS.watchClipboard,
    ),

    launchOnStartup: getBooleanSetting(
      map,
      "launch_on_startup",
      DEFAULT_SETTINGS.launchOnStartup,
    ),

    minClipLength: getNumberSetting(
      map,
      "min_clip_length",
      DEFAULT_SETTINGS.minClipLength,
    ),

    maxClipLength: getNumberSetting(
      map,
      "max_clip_length",
      DEFAULT_SETTINGS.maxClipLength,
    ),

    ignoreSensitiveClips: getBooleanSetting(
      map,
      "ignore_sensitive_clips",
      DEFAULT_SETTINGS.ignoreSensitiveClips,
    ),

    ignoreLikelyPasswords: getBooleanSetting(
      map,
      "ignore_likely_passwords",
      DEFAULT_SETTINGS.ignoreLikelyPasswords,
    ),

    ignoreLikelyApiKeys: getBooleanSetting(
      map,
      "ignore_likely_api_keys",
      DEFAULT_SETTINGS.ignoreLikelyApiKeys,
    ),

    privateMode: getBooleanSetting(
      map,
      "private_mode",
      DEFAULT_SETTINGS.privateMode,
    ),

    pauseUntil: getNullableNumberSetting(
      map,
      "pause_until",
      DEFAULT_SETTINGS.pauseUntil,
    ),

    ignoredApps: getStringArraySetting(
      map,
      "ignored_apps",
      DEFAULT_SETTINGS.ignoredApps,
    ),
  };
}

export async function updateAppSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?);
    `,
    ["history_retention_days", settings.historyRetentionDays],
  );

  await db.execute(
    `
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?);
    `,
    ["protect_pinned_clips", String(settings.protectPinnedClips)],
  );

  await db.execute(
    `
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?);
    `,
    ["watch_clipboard", String(settings.watchClipboard)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["theme_mode", settings.themeMode],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["launch_on_startup", String(settings.launchOnStartup)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["min_clip_length", String(settings.minClipLength)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["max_clip_length", String(settings.maxClipLength)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignore_sensitive_clips", String(settings.ignoreSensitiveClips)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignore_likely_passwords", String(settings.ignoreLikelyPasswords)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignore_likely_api_keys", String(settings.ignoreLikelyApiKeys)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["private_mode", String(settings.privateMode)],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    [
      "pause_until",
      settings.pauseUntil === null ? "null" : String(settings.pauseUntil),
    ],
  );

  await db.execute(
    `
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?);
  `,
    ["ignored_apps", JSON.stringify(settings.ignoredApps)],
  );
}

export async function runRetentionCleanup(
  settings?: AppSettings,
): Promise<number> {
  const activeSettings = settings ?? (await getAppSettings());

  if (activeSettings.historyRetentionDays === "never") {
    return 0;
  }

  const db = await getDb();
  const days = Number(activeSettings.historyRetentionDays);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const result = activeSettings.protectPinnedClips
    ? await db.execute(
        `
          DELETE FROM clips
          WHERE created_at < ?
            AND is_pinned = 0;
        `,
        [cutoff],
      )
    : await db.execute(
        `
          DELETE FROM clips
          WHERE created_at < ?;
        `,
        [cutoff],
      );

  return result.rowsAffected ?? 0;
}

export async function importClipsFromBackup(
  exportedClips: ExportedClip[],
): Promise<{ imported: number; skipped: number }> {
  const db = await getDb();

  let imported = 0;
  let skipped = 0;

  for (const clip of exportedClips) {
    if (clip.type !== "text/plain") {
      skipped++;
      continue;
    }

    const cleanContent = clip.content.trim();

    if (!cleanContent) {
      skipped++;
      continue;
    }

    const createdAt =
      Number.isFinite(clip.createdAt) && clip.createdAt > 0
        ? clip.createdAt
        : Date.now();

    const updatedAt =
      Number.isFinite(clip.updatedAt) && clip.updatedAt > 0
        ? clip.updatedAt
        : createdAt;

    const contentHash = hashText(cleanContent);

    const existing = await db.select<Clip[]>(
      `
        SELECT *
        FROM clips
        WHERE content_hash = ?
          AND content = ?
          AND created_at = ?
        LIMIT 1;
      `,
      [contentHash, cleanContent, createdAt],
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const category = detectClipCategory(cleanContent);

    await db.execute(
      `
    INSERT INTO clips (
      content,
      content_hash,
      content_type,
      category,
      note,
      created_at,
      updated_at,
      is_pinned,
      is_favorite
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
      [
        cleanContent,
        contentHash,
        "text/plain",
        category,
        null,
        createdAt,
        updatedAt,
        clip.isPinned ? 1 : 0,
        0,
      ],
    );

    imported++;
  }

  return {
    imported,
    skipped,
  };
}

export async function updateClipFavorite(
  clipId: number,
  isFavorite: boolean,
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      UPDATE clips
      SET is_favorite = ?, updated_at = ?
      WHERE id = ?;
    `,
    [isFavorite ? 1 : 0, Date.now(), clipId],
  );
}

export async function updateClipNote(
  clipId: number,
  note: string | null,
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      UPDATE clips
      SET note = ?, updated_at = ?
      WHERE id = ?;
    `,
    [note?.trim() ? note.trim() : null, Date.now(), clipId],
  );
}

export async function updateClipCategory(
  clipId: number,
  category: Clip["category"],
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      UPDATE clips
      SET category = ?, updated_at = ?
      WHERE id = ?;
    `,
    [category, Date.now(), clipId],
  );
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();

  return db.select<Tag[]>(
    `
      SELECT *
      FROM tags
      ORDER BY name ASC;
    `,
  );
}

export async function getClipTags(clipId: number): Promise<ClipTag[]> {
  const db = await getDb();

  return db.select<ClipTag[]>(
    `
      SELECT
        clip_tags.clip_id,
        tags.id AS tag_id,
        tags.name
      FROM clip_tags
      INNER JOIN tags ON tags.id = clip_tags.tag_id
      WHERE clip_tags.clip_id = ?
      ORDER BY tags.name ASC;
    `,
    [clipId],
  );
}

export async function addTagToClip(
  clipId: number,
  tagName: string,
): Promise<void> {
  const db = await getDb();
  const normalizedName = normalizeTagName(tagName);

  if (!normalizedName) return;

  const now = Date.now();

  await db.execute(
    `
      INSERT OR IGNORE INTO tags (name, created_at)
      VALUES (?, ?);
    `,
    [normalizedName, now],
  );

  const tags = await db.select<Tag[]>(
    `
      SELECT *
      FROM tags
      WHERE name = ?
      LIMIT 1;
    `,
    [normalizedName],
  );

  const tag = tags[0];

  if (!tag) return;

  await db.execute(
    `
      INSERT OR IGNORE INTO clip_tags (clip_id, tag_id)
      VALUES (?, ?);
    `,
    [clipId, tag.id],
  );
}

export async function removeTagFromClip(
  clipId: number,
  tagId: number,
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `
      DELETE FROM clip_tags
      WHERE clip_id = ? AND tag_id = ?;
    `,
    [clipId, tagId],
  );
}

export async function getClipsByRangeWithFilters({
  start,
  end,
  filters,
}: {
  start: number;
  end: number;
  filters: ClipFilters;
}): Promise<Clip[]> {
  const db = await getDb();

  const conditions = ["created_at >= ?", "created_at < ?"];
  const params: unknown[] = [start, end];

  const query = filters.query?.trim();

  if (query) {
    conditions.push("(content LIKE ? OR note LIKE ?)");
    params.push(`%${query}%`, `%${query}%`);
  }

  if (filters.contentFilter !== "all") {
    conditions.push("category = ?");
    params.push(filters.contentFilter);
  }

  if (filters.pinnedOnly) {
    conditions.push("is_pinned = 1");
  }

  if (filters.favoritesOnly) {
    conditions.push("is_favorite = 1");
  }

  return db.select<Clip[]>(
    `
      SELECT *
      FROM clips
      WHERE ${conditions.join(" AND ")}
      ORDER BY is_pinned DESC, created_at DESC;
    `,
    params,
  );
}
