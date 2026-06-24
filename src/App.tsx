import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Clipboard } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm, message } from "@tauri-apps/plugin-dialog";

import type { AppSettings, Clip, DailyCount, ViewMode } from "./types";
import type { ClipContentFilter, ClipFilters } from "./types";
import { ClipCard } from "./components/ClipCard";
import { EmptyState } from "./components/EmptyState";
import { Sidebar } from "./components/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import {
  formatDayHeading,
  formatViewTitle,
  getRangeForView,
  moveDate,
  toDayKey,
} from "./lib/dates";
import {
  clearAllClips,
  deleteClip,
  getAppSettings,
  getClipsByRangeWithFilters,
  getDailyCountsForMonth,
  runRetentionCleanup,
  togglePinClip,
  updateAppSettings,
  updateClipFavorite,
  updateClipNote,
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

  const toastTimerRef = useRef<number | null>(null);

  const clipFilters: ClipFilters = {
    query,
    contentFilter,
    pinnedOnly,
    favoritesOnly,
  };

  const loadClips = useCallback(async () => {
    setLoading(true);

    try {
      const range = getRangeForView(selectedDate, viewMode);

      const rows = await getClipsByRangeWithFilters({
        start: range.start,
        end: range.end,
        filters: clipFilters,
      });

      setClips(rows);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode, query, contentFilter, pinnedOnly, favoritesOnly]);

  const loadDailyCounts = useCallback(async () => {
    const counts = await getDailyCountsForMonth(selectedDate);
    setDailyCounts(counts);
  }, [selectedDate]);

  const refreshData = useCallback(async () => {
    await loadClips();
    await loadDailyCounts();
  }, [loadClips, loadDailyCounts]);

  const { error: watcherError } = useClipboardWatcher({
    settings,
    intervalMs: 1000,
    onSaved: () => {
      refreshData();
    },
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

  async function handleCopy(clip: Clip) {
    await writeText(clip.content);

    setCopiedId(clip.id);

    window.setTimeout(() => {
      setCopiedId(null);
    }, 1200);
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
    await updateClipFavorite(clip.id, !clip.is_favorite);
    await refreshData();
  }

  async function handleUpdateNote(clip: Clip, note: string | null) {
    await updateClipNote(clip.id, note);
    await refreshData();
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
                        onCopy={handleCopy}
                        onDelete={handleDelete}
                        onTogglePin={handleTogglePin}
                        onToggleFavorite={handleToggleFavorite}
                        onUpdateNote={handleUpdateNote}
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
        onClearAll={handleClearAll}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
