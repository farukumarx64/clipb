import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Clipboard } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm, message } from "@tauri-apps/plugin-dialog";

import type { AppSettings, Clip, DailyCount, ViewMode } from "./types";
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
  getClips,
  getDailyCountsForMonth,
  runRetentionCleanup,
  togglePinClip,
  updateAppSettings,
} from "./lib/db";
import { useClipboardWatcher } from "./hooks/useClipboardWatcher";
import { exportClipsToJsonFile, importClipsFromJsonFile } from "./lib/backup";

import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import {
  getLaunchOnStartupEnabled,
  setLaunchOnStartup,
  toggleQuickWindow,
} from "./lib/desktop";

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
};

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

  useGlobalShortcuts();

  const loadClips = useCallback(async () => {
    setLoading(true);

    try {
      const range = getRangeForView(selectedDate, viewMode);

      const rows = await getClips({
        start: range.start,
        end: range.end,
        query,
      });

      setClips(rows);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode, query]);

  const loadDailyCounts = useCallback(async () => {
    const counts = await getDailyCountsForMonth(selectedDate);
    setDailyCounts(counts);
  }, [selectedDate]);

  const refreshData = useCallback(async () => {
    await loadClips();
    await loadDailyCounts();
  }, [loadClips, loadDailyCounts]);

  const { error: watcherError } = useClipboardWatcher({
    enabled: settings.watchClipboard,
    intervalMs: 1000,
    onSaved: () => {
      refreshData();
    },
  });

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode;
  }, [settings.themeMode]);

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

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setViewMode("day");
  }

  async function handleSaveSettings(nextSettings: AppSettings) {
    if (nextSettings.launchOnStartup !== settings.launchOnStartup) {
      await setLaunchOnStartup(nextSettings.launchOnStartup);
    }

    await updateAppSettings(nextSettings);
    setSettings(nextSettings);

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
                settings.watchClipboard ? "" : "status-line--paused",
              ].join(" ")}
            >
              <span
                className={[
                  "status-dot",
                  settings.watchClipboard
                    ? "status-dot--active"
                    : "status-dot--paused",
                ].join(" ")}
                aria-hidden="true"
              />

              <span>
                {settings.watchClipboard
                  ? "Watching clipboard"
                  : "Clipboard watching paused"}
              </span>
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
    </div>
  );
}
