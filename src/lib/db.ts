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

const DB_URL = "sqlite:clipb.db";

type Db = Awaited<ReturnType<typeof Database.load>>;

let dbPromise: Promise<Db> | null = null;

const DEFAULT_SETTINGS: AppSettings = {
  historyRetentionDays: "never",
  protectPinnedClips: true,
  watchClipboard: true,
  themeMode: "system",
  launchOnStartup: false,
};

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
        created_at,
        updated_at,
        is_pinned
      )
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    [cleanContent, contentHash, "text/plain", now, now, 0],
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
      [`%${query}%`, limit]
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
    [limit]
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
    protectPinnedClips:
      map.get("protect_pinned_clips") === undefined
        ? DEFAULT_SETTINGS.protectPinnedClips
        : map.get("protect_pinned_clips") === "true",
    watchClipboard:
      map.get("watch_clipboard") === undefined
        ? DEFAULT_SETTINGS.watchClipboard
        : map.get("watch_clipboard") === "true",
    launchOnStartup:
      map.get("launch_on_startup") === undefined
        ? DEFAULT_SETTINGS.launchOnStartup
        : map.get("launch_on_startup") === "true",
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

    await db.execute(
      `
        INSERT INTO clips (
          content,
          content_hash,
          content_type,
          created_at,
          updated_at,
          is_pinned
        )
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      [
        cleanContent,
        contentHash,
        "text/plain",
        createdAt,
        updatedAt,
        clip.isPinned ? 1 : 0,
      ],
    );

    imported++;
  }

  return {
    imported,
    skipped,
  };
}
