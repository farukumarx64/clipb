import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Clipboard } from "lucide-react";
import { copyClipToClipboard } from "./lib/clipCopy";
import { confirm, message } from "@tauri-apps/plugin-dialog";

import type {
  AppSettings,
  Clip,
  DailyCount,
  ViewMode,
  ClipContentFilter,
  ClipTag,
  Tag,
} from "./types";
import { ClipCard } from "./components/ClipCard";
import { EmptyState } from "./components/EmptyState";
import { Sidebar } from "./components/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import {
  addTagToClip,
  clearAllClips,
  deleteClip,
  getAllTags,
  getAppSettings,
  getClipsByRangeWithFilters,
  getDailyCountsForMonth,
  getTagsForClipIds,
  removeTagFromClip,
  runRetentionCleanup,
  togglePinClip,
  updateAppSettings,
  updateClipFavorite,
  updateClipNote,
  deleteUnusedTags,
} from "./lib/db";
import { useClipboardWatcher } from "./hooks/useClipboardWatcher";
import { exportClipsToJsonFile, importClipsFromJsonFile } from "./lib/backup";

import {
  getLaunchOnStartupEnabled,
  setLaunchOnStartup,
  toggleQuickWindow,
} from "./lib/desktop";

import {
  Toast,
  type ToastMessage,
  type ToastVariant,
} from "./components/Toast";
import {
  formatDayHeading,
  formatViewTitle,
  getRangeForView,
  moveDate,
  toDayKey,
} from "./lib/dates";
import { exportClipBArchive, importClipBArchive } from "./lib/clipbArchive";

function groupClipsByDay(clips: Clip[]) {
  return clips.reduce<Record<string, Clip[]>>((groups, clip) => {
    const key = toDayKey(clip.created_at);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(clip);

    return groups;
  }, {});
}

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
  backupCopiedFiles: false,
  maxBackupFileSizeMb: 25,
};

function formatPauseRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getClipboardStatus(settings: AppSettings, currentTime: number) {
  if (settings.privateMode) {
    return {
      text: "Private mode active",
      variant: "private",
      active: false,
    };
  }

  if (settings.pauseUntil && settings.pauseUntil > currentTime) {
    return {
      text: `Paused — resumes in ${formatPauseRemaining(
        settings.pauseUntil - currentTime,
      )}`,
      variant: "paused",
      active: false,
    };
  }

  if (!settings.watchClipboard) {
    return {
      text: "Clipboard watching paused",
      variant: "paused",
      active: false,
    };
  }

  return {
    text: "Watching clipboard",
    variant: "active",
    active: true,
  };
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [query, setQuery] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [contentFilter, setContentFilter] = useState<ClipContentFilter>("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [clipTagsByClipId, setClipTagsByClipId] = useState<
    Record<number, ClipTag[]>
  >({});
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const loadClips = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? true;

      if (showLoading) {
        setLoading(true);
      }

      try {
        const range = getRangeForView(selectedDate, viewMode);

        const rows = await getClipsByRangeWithFilters({
          start: range.start,
          end: range.end,
          filters: {
            query,
            contentFilter,
            pinnedOnly,
            favoritesOnly,
            selectedTagId,
          },
        });

        const tagsByClipId = await getTagsForClipIds(
          rows.map((clip) => clip.id),
        );

        setClips(rows);
        setClipTagsByClipId(tagsByClipId);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [
      selectedDate,
      viewMode,
      query,
      contentFilter,
      pinnedOnly,
      favoritesOnly,
      selectedTagId,
    ],
  );

  const loadDailyCounts = useCallback(async () => {
    const counts = await getDailyCountsForMonth(selectedDate);
    setDailyCounts(counts);
  }, [selectedDate]);

  const loadAllTags = useCallback(async () => {
    const tags = await getAllTags();
    setAllTags(tags);
  }, []);

  const refreshData = useCallback(async () => {
    await loadClips();
    await loadDailyCounts();
    await loadAllTags();
  }, [loadClips, loadDailyCounts, loadAllTags]);

  const handleClipboardSaved = useCallback(async () => {
    await loadClips({ showLoading: false });
    await loadDailyCounts();
  }, [loadClips, loadDailyCounts]);

  const { error: watcherError } = useClipboardWatcher({
    settings,
    intervalMs: 1000,
    onSaved: handleClipboardSaved,
  });

  useEffect(() => {
    if (!settings.pauseUntil) return;

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [settings.pauseUntil]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode;
  }, [settings.themeMode]);

  useEffect(() => {
    if (!settings.pauseUntil) return;
    if (settings.pauseUntil > currentTime) return;

    const nextSettings = {
      ...settings,
      pauseUntil: null,
    };

    setSettings(nextSettings);
    updateAppSettings(nextSettings).catch(console.error);
  }, [settings, currentTime]);

  useEffect(() => {
    async function boot() {
      const loadedSettings = await getAppSettings();

      const launchOnStartup = await getLaunchOnStartupEnabled().catch(() => {
        return loadedSettings.launchOnStartup;
      });

      const mergedSettings = {
        ...loadedSettings,
        launchOnStartup,
      };

      setSettings(mergedSettings);

      if (launchOnStartup !== loadedSettings.launchOnStartup) {
        await updateAppSettings(mergedSettings);
      }

      await runRetentionCleanup(mergedSettings);
      await refreshData();
    }

    boot().catch(console.error);
  }, [refreshData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const groupedClips = useMemo(() => groupClipsByDay(clips), [clips]);

  const groupedEntries = useMemo(() => {
    return Object.entries(groupedClips).sort(([a], [b]) => {
      return b.localeCompare(a);
    });
  }, [groupedClips]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(
    title: string,
    description?: string,
    variant: ToastVariant = "info",
  ) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast({
      id: Date.now(),
      title,
      description,
      variant,
    });

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  }

  async function handleAddTag(clipId: number, tagName: string) {
    await addTagToClip(clipId, tagName);

    const tagsByClipId = await getTagsForClipIds([clipId]);
    const updatedAllTags = await getAllTags();

    setClipTagsByClipId((current) => ({
      ...current,
      [clipId]: tagsByClipId[clipId] ?? [],
    }));

    setAllTags(updatedAllTags);
  }

  async function handleRemoveTag(clipId: number, tagId: number) {
    await removeTagFromClip(clipId, tagId);
    await deleteUnusedTags();

    const updatedAllTags = await getAllTags();

    setClipTagsByClipId((current) => ({
      ...current,
      [clipId]: (current[clipId] ?? []).filter((tag) => tag.tag_id !== tagId),
    }));

    setAllTags(updatedAllTags);

    if (selectedTagId === tagId) {
      setSelectedTagId(null);
      await refreshData();
    }
  }

  function handleSelectTag(tagId: number) {
    setSelectedTagId(tagId);
  }

  async function handleCopy(clip: Clip) {
    try {
      await copyClipToClipboard(clip);

      setCopiedId(clip.id);

      window.setTimeout(() => {
        setCopiedId(null);
      }, 1200);
    } catch (error) {
      console.error(error);

      await message("Could not copy this clip back to the clipboard.", {
        title: "Copy failed",
        kind: "error",
      });
    }
  }

  async function handleDelete(id: number) {
    await deleteClip(id);
    await refreshData();
  }

  async function handleTogglePin(clip: Clip) {
    await togglePinClip(clip.id, clip.is_pinned);
    await refreshData();
  }

  async function handleToggleFavorite(clip: Clip) {
    const nextFavoriteValue = clip.is_favorite ? 0 : 1;

    setClips((currentClips) => {
      return currentClips
        .map((item) =>
          item.id === clip.id
            ? {
                ...item,
                is_favorite: nextFavoriteValue,
              }
            : item,
        )
        .filter((item) => {
          if (!favoritesOnly) return true;

          return item.is_favorite === 1;
        });
    });

    try {
      await updateClipFavorite(clip.id, Boolean(nextFavoriteValue));
    } catch (error) {
      console.error(error);

      // rollback if DB update fails
      setClips((currentClips) =>
        currentClips.map((item) =>
          item.id === clip.id
            ? {
                ...item,
                is_favorite: clip.is_favorite,
              }
            : item,
        ),
      );
    }
  }

  async function handleUpdateNote(clip: Clip, note: string | null) {
    const cleanNote = note?.trim() ? note.trim() : null;

    setClips((currentClips) =>
      currentClips.map((item) =>
        item.id === clip.id
          ? {
              ...item,
              note: cleanNote,
            }
          : item,
      ),
    );

    try {
      await updateClipNote(clip.id, cleanNote);
    } catch (error) {
      console.error(error);

      // rollback if DB update fails
      setClips((currentClips) =>
        currentClips.map((item) =>
          item.id === clip.id
            ? {
                ...item,
                note: clip.note,
              }
            : item,
        ),
      );
    }
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setViewMode("day");
  }

  async function handleSaveSettings(nextSettings: AppSettings) {
    const privateModeChanged =
      nextSettings.privateMode !== settings.privateMode;
    const pauseChanged = nextSettings.pauseUntil !== settings.pauseUntil;

    if (nextSettings.launchOnStartup !== settings.launchOnStartup) {
      await setLaunchOnStartup(nextSettings.launchOnStartup);
    }

    await updateAppSettings(nextSettings);
    setSettings(nextSettings);

    if (privateModeChanged) {
      if (nextSettings.privateMode) {
        showToast(
          "Private mode enabled",
          "ClipB will not save new clipboard items until private mode is turned off.",
          "private",
        );
      } else {
        showToast(
          "Private mode disabled",
          "ClipB can save clipboard items again.",
          "success",
        );
      }
    }

    if (!privateModeChanged && pauseChanged) {
      if (nextSettings.pauseUntil && nextSettings.pauseUntil > Date.now()) {
        showToast(
          "Clipboard paused",
          "ClipB will temporarily stop saving new clips.",
          "warning",
        );
      } else {
        showToast(
          "Clipboard resumed",
          "ClipB can save clipboard items again.",
          "success",
        );
      }
    }

    const deletedCount = await runRetentionCleanup(nextSettings);

    if (deletedCount > 0) {
      await refreshData();
    }
  }

  async function handleExport() {
    try {
      const result = await exportClipsToJsonFile();

      if (result.cancelled) return;

      await message(`Exported ${result.exported} clips successfully.`, {
        title: "ClipB export complete",
        kind: "info",
      });
    } catch (error) {
      console.error(error);

      await message("Could not export clips. Please try again.", {
        title: "Export failed",
        kind: "error",
      });
    }
  }

  async function handleImport() {
    try {
      const result = await importClipsFromJsonFile();

      if (result.cancelled) return;

      await refreshData();

      await message(
        `Imported ${result.imported} clips. Skipped ${result.skipped} duplicate or invalid clips.`,
        {
          title: "ClipB import complete",
          kind: "info",
        },
      );
    } catch (error) {
      console.error(error);

      await message(
        "Could not import this file. Make sure it is a valid ClipB JSON export.",
        {
          title: "Import failed",
          kind: "error",
        },
      );
    }
  }

  async function handleExportClipBArchive() {
    try {
      const result = await exportClipBArchive();

      if (result.cancelled) return;

      await message(
        `Exported ${result.exported} clips and ${result.assets} assets successfully.`,
        {
          title: "ClipB archive export complete",
          kind: "info",
        },
      );
    } catch (error) {
      console.error(error);

      await message("Could not export ClipB archive. Please try again.", {
        title: "Archive export failed",
        kind: "error",
      });
    }
  }

  async function handleImportClipBArchive() {
    try {
      const result = await importClipBArchive();

      if (result.cancelled) return;

      await refreshData();

      await message(
        `Imported ${result.imported} clips. Skipped ${result.skipped} duplicates. Restored ${result.tags} tags.`,
        {
          title: "ClipB archive import complete",
          kind: "info",
        },
      );
    } catch (error) {
      console.error(error);

      await message(
        "Could not import this .clipb file. Make sure it is a valid ClipB archive.",
        {
          title: "Archive import failed",
          kind: "error",
        },
      );
    }
  }

  async function handleClearAll() {
    const confirmed = await confirm(
      "This will permanently delete all saved clips from ClipB. This action cannot be undone.",
      {
        title: "Clear all clips?",
        kind: "warning",
      },
    );

    if (!confirmed) return;

    const deletedCount = await clearAllClips();

    await refreshData();

    await message(`Deleted ${deletedCount} clips.`, {
      title: "ClipB history cleared",
      kind: "info",
    });
  }

  const clipboardStatus = getClipboardStatus(settings, currentTime);

  return (
    <div className="app-shell">
      <Sidebar
        selectedDate={selectedDate}
        viewMode={viewMode}
        query={query}
        dailyCounts={dailyCounts}
        onSelectDate={handleSelectDate}
        onViewModeChange={setViewMode}
        onQueryChange={setQuery}
      />

      <main className="main">
        <header className="topbar">
          <div>
            <div
              className={[
                "status-line",
                clipboardStatus.variant === "paused"
                  ? "status-line--paused"
                  : "",
                clipboardStatus.variant === "private"
                  ? "status-line--private"
                  : "",
              ].join(" ")}
            >
              <span
                className={[
                  "status-dot",
                  clipboardStatus.active
                    ? "status-dot--active"
                    : "status-dot--paused",
                ].join(" ")}
                aria-hidden="true"
              />

              <span>{clipboardStatus.text}</span>
            </div>

            <h2>{formatViewTitle(selectedDate, viewMode)}</h2>

            {watcherError ? <p className="error-text">{watcherError}</p> : null}
          </div>

          <div className="topbar__actions">
            <button
              className="nav-button"
              onClick={() =>
                setSelectedDate(moveDate(selectedDate, viewMode, "prev"))
              }
              title={`Go to previous day`}
            >
              <ChevronLeft size={18} />
            </button>

            <button
              className="today-button"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </button>

            <button
              title={`Go to next day`}
              className="nav-button"
              onClick={() =>
                setSelectedDate(moveDate(selectedDate, viewMode, "next"))
              }
            >
              <ChevronRight size={18} />
            </button>

            <button
              className="nav-button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings size={18} />
            </button>

            <button
              className="nav-button"
              onClick={() => toggleQuickWindow()}
              title="Open quick copy"
              aria-label="Open quick copy"
            >
              <Clipboard size={18} />
            </button>
          </div>
        </header>

        <div className="clip-filters">
          <button
            className={[
              "filter-chip",
              contentFilter === "all" ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setContentFilter("all")}
            title="Show all clips"
            aria-label="Show all clips"
          >
            All
          </button>

          <button
            className={[
              "filter-chip",
              contentFilter === "text" ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setContentFilter("text")}
            title="Show text clips"
            aria-label="Show text clips"
          >
            Text
          </button>

          <button
            className={[
              "filter-chip",
              contentFilter === "url" ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setContentFilter("url")}
            title="Show URL clips"
            aria-label="Show URL clips"
          >
            URLs
          </button>

          <button
            className={[
              "filter-chip",
              contentFilter === "code" ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setContentFilter("code")}
            title="Show code clips"
            aria-label="Show code clips"
          >
            Code
          </button>

          <button
            className={[
              "filter-chip",
              contentFilter === "image" ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setContentFilter("image")}
            title="Show image clips"
            aria-label="Show image clips"
          >
            Images
          </button>

          <button
            className={[
              "filter-chip",
              contentFilter === "file" ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setContentFilter("file")}
            title="Show file clips"
            aria-label="Show file clips"
          >
            Files
          </button>

          <button
            className={[
              "filter-chip",
              pinnedOnly ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setPinnedOnly((value) => !value)}
            title="Show pinned clips only"
            aria-label="Show pinned clips only"
          >
            Pinned
          </button>

          <button
            className={[
              "filter-chip",
              favoritesOnly ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => setFavoritesOnly((value) => !value)}
            title="Show favorite clips only"
            aria-label="Show favorite clips only"
          >
            Favorites
          </button>

          <span className="tag-filter-compact">
            <select
              value={selectedTagId ?? "all"}
              title="Filter clips by tag"
              aria-label="Filter clips by tag"
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTagId(value === "all" ? null : Number(value));
              }}
            >
              <option value="all"># All</option>

              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
            </select>
          </span>
        </div>

        <section className="content">
          {loading ? <p className="muted-text">Loading clips...</p> : null}

          {!loading && clips.length === 0 ? <EmptyState /> : null}

          {!loading && groupedEntries.length > 0
            ? groupedEntries.map(([dayKey, dayClips]) => (
                <section key={dayKey} className="day-group">
                  <h3>{formatDayHeading(dayKey)}</h3>

                  <div className="clip-grid">
                    {dayClips.map((clip) => (
                      <ClipCard
                        key={clip.id}
                        clip={clip}
                        copied={copiedId === clip.id}
                        tags={clipTagsByClipId[clip.id] ?? []}
                        onCopy={handleCopy}
                        onDelete={handleDelete}
                        onTogglePin={handleTogglePin}
                        onToggleFavorite={handleToggleFavorite}
                        onUpdateNote={handleUpdateNote}
                        onAddTag={handleAddTag}
                        onRemoveTag={handleRemoveTag}
                        onSelectTag={handleSelectTag}
                      />
                    ))}
                  </div>
                </section>
              ))
            : null}
        </section>
      </main>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
        onExport={handleExport}
        onImport={handleImport}
        onExportArchive={handleExportClipBArchive}
        onImportArchive={handleImportClipBArchive}
        onClearAll={handleClearAll}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
