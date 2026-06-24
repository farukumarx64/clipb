import { useEffect, useState } from "react";
import {
  Download,
  MonitorUp,
  Palette,
  ShieldCheck,
  TimerReset,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { AppSettings, RetentionDays, ThemeMode } from "../types";

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: () => Promise<void>;
  onExportArchive: () => void;
  onImportArchive: () => void;
  onClearAll: () => Promise<void>;
}

const retentionOptions: Array<{
  label: string;
  value: RetentionDays;
}> = [
  { label: "Never delete automatically", value: "never" },
  { label: "After 7 days", value: "7" },
  { label: "After 30 days", value: "30" },
  { label: "After 90 days", value: "90" },
  { label: "After 180 days", value: "180" },
  { label: "After 365 days", value: "365" },
];

const minClipLengthOptions = [1, 2, 3, 5, 10];

const maxClipLengthOptions = [
  { label: "1,000 characters", value: 1000 },
  { label: "5,000 characters", value: 5000 },
  { label: "10,000 characters", value: 10000 },
  { label: "50,000 characters", value: 50000 },
  { label: "100,000 characters", value: 100000 },
  { label: "Unlimited", value: 0 },
];

const pauseOptions = [
  { label: "5 min", milliseconds: 5 * 60 * 1000 },
  { label: "15 min", milliseconds: 15 * 60 * 1000 },
  { label: "30 min", milliseconds: 30 * 60 * 1000 },
  { label: "1 hour", milliseconds: 60 * 60 * 1000 },
];

const themeOptions: Array<{
  label: string;
  value: ThemeMode;
  description: string;
}> = [
  {
    label: "System",
    value: "system",
    description: "Follow your computer appearance.",
  },
  {
    label: "Light",
    value: "light",
    description: "Use ClipB in light mode.",
  },
  {
    label: "Dark",
    value: "dark",
    description: "Use ClipB in dark mode.",
  },
];

export function SettingsModal({
  open,
  settings,
  onClose,
  onSaveSettings,
  onExport,
  onImport,
  onExportArchive,
  onImportArchive,
  onClearAll,
}: SettingsModalProps) {
  const [ignoredAppInput, setIgnoredAppInput] = useState("");

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function addIgnoredApp() {
    const appName = ignoredAppInput.trim();

    if (!appName) return;

    const alreadyExists = settings.ignoredApps.some(
      (item) => item.toLowerCase() === appName.toLowerCase(),
    );

    if (alreadyExists) {
      setIgnoredAppInput("");
      return;
    }

    updateSetting({
      ...settings,
      ignoredApps: [...settings.ignoredApps, appName],
    });

    setIgnoredAppInput("");
  }

  function removeIgnoredApp(appName: string) {
    updateSetting({
      ...settings,
      ignoredApps: settings.ignoredApps.filter((item) => item !== appName),
    });
  }

  function pauseFor(milliseconds: number) {
    updateSetting({
      ...settings,
      pauseUntil: Date.now() + milliseconds,
      privateMode: false,
    });
  }

  function clearTemporaryPause() {
    updateSetting({
      ...settings,
      pauseUntil: null,
    });
  }

  if (!open) return null;

  async function updateSetting(nextSettings: AppSettings) {
    await onSaveSettings(nextSettings);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="settings-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-modal__header">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p>Backup, privacy, appearance, and local history controls.</p>
          </div>

          <button
            title="Close settings"
            className="modal-close-button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="settings-modal__content">
          <section className="settings-section settings-section--featured">
            <div className="section-title-row">
              <div>
                <h3>Appearance</h3>
                <p>Choose how ClipB should look.</p>
              </div>

              <div className="section-icon">
                <Palette size={18} />
              </div>
            </div>

            <div className="theme-options">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  className={[
                    "theme-option",
                    settings.themeMode === option.value ? "active" : "",
                  ].join(" ")}
                  onClick={() =>
                    updateSetting({
                      ...settings,
                      themeMode: option.value,
                    })
                  }
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="section-title-row">
              <div>
                <h3>Desktop behavior</h3>
                <p>Control how ClipB behaves as a desktop utility.</p>
              </div>

              <div className="section-icon">
                <MonitorUp size={18} />
              </div>
            </div>

            <label className="setting-row">
              <div>
                <strong>Launch on startup</strong>
                <span>Start ClipB automatically when you log in.</span>
              </div>

              <input
                type="checkbox"
                checked={settings.launchOnStartup}
                title="Launch ClipB on startup"
                aria-label="Launch ClipB on startup"
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    launchOnStartup: event.target.checked,
                  })
                }
              />
            </label>

            <div className="settings-note">
              Closing or minimizing ClipB hides it to the tray. Use the tray
              menu to fully quit.
            </div>
          </section>

          <section className="settings-section">
            <h3>Clipboard watcher</h3>
            <p>Pause ClipB when you do not want new clipboard items saved.</p>

            <label className="setting-row">
              <div>
                <strong>Watch clipboard</strong>
                <span>Automatically save copied text.</span>
              </div>

              <input
                type="checkbox"
                checked={settings.watchClipboard}
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    watchClipboard: event.target.checked,
                  })
                }
              />
            </label>
          </section>

          <section className="settings-section settings-section--featured">
            <div className="section-title-row">
              <div>
                <h3>Privacy & Filtering</h3>
                <p>Control what ClipB is allowed to save.</p>
              </div>

              <div className="section-icon">
                <ShieldCheck size={18} />
              </div>
            </div>

            <div className="settings-stack">
              <label className="setting-row">
                <div>
                  <strong>Ignore likely API keys and tokens</strong>
                  <span>
                    Skips copied text that looks like keys, JWTs, private keys,
                    or credentials.
                  </span>
                </div>

                <input
                  type="checkbox"
                  checked={settings.ignoreLikelyApiKeys}
                  title="Ignore likely API keys and tokens"
                  aria-label="Ignore likely API keys and tokens"
                  onChange={(event) =>
                    updateSetting({
                      ...settings,
                      ignoreLikelyApiKeys: event.target.checked,
                    })
                  }
                />
              </label>

              <label className="setting-row">
                <div>
                  <strong>Ignore likely passwords</strong>
                  <span>
                    Skips short random-looking text that may be a password.
                  </span>
                </div>

                <input
                  type="checkbox"
                  checked={settings.ignoreLikelyPasswords}
                  title="Ignore likely passwords"
                  aria-label="Ignore likely passwords"
                  onChange={(event) =>
                    updateSetting({
                      ...settings,
                      ignoreLikelyPasswords: event.target.checked,
                    })
                  }
                />
              </label>

              <label className="setting-row">
                <div>
                  <strong>Ignore sensitive clips</strong>
                  <span>
                    Applies the sensitive-content scanner before saving new
                    clips.
                  </span>
                </div>

                <input
                  type="checkbox"
                  checked={settings.ignoreSensitiveClips}
                  title="Ignore sensitive clips"
                  aria-label="Ignore sensitive clips"
                  onChange={(event) =>
                    updateSetting({
                      ...settings,
                      ignoreSensitiveClips: event.target.checked,
                    })
                  }
                />
              </label>
            </div>

            <div className="settings-inline-grid">
              <label className="field-label">
                Minimum clip length
                <span className="select-control">
                  <select
                    value={settings.minClipLength}
                    title="Choose the minimum number of characters before a clip is saved"
                    aria-label="Minimum clip length"
                    onChange={(event) =>
                      updateSetting({
                        ...settings,
                        minClipLength: Number(event.target.value),
                      })
                    }
                  >
                    {minClipLengthOptions.map((value) => (
                      <option key={value} value={value}>
                        {value} character{value === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              <label className="field-label">
                Maximum clip length
                <span className="select-control">
                  <select
                    value={settings.maxClipLength}
                    title="Choose the maximum number of characters ClipB can save"
                    aria-label="Maximum clip length"
                    onChange={(event) =>
                      updateSetting({
                        ...settings,
                        maxClipLength: Number(event.target.value),
                      })
                    }
                  >
                    {maxClipLengthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>

            <div className="settings-note">
              Privacy filters run locally on your device before ClipB saves a
              copied item.
            </div>
          </section>

          <section className="settings-section">
            <div className="section-title-row">
              <div>
                <h3>Private Mode & Pause Timer</h3>
                <p>Temporarily stop ClipB from saving copied text.</p>
              </div>

              <div className="section-icon">
                <TimerReset size={18} />
              </div>
            </div>

            <label className="setting-row">
              <div>
                <strong>Private mode</strong>
                <span>
                  Do not save new clips until private mode is turned off.
                </span>
              </div>

              <input
                type="checkbox"
                checked={settings.privateMode}
                title="Enable private mode"
                aria-label="Enable private mode"
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    privateMode: event.target.checked,
                    pauseUntil: event.target.checked
                      ? null
                      : settings.pauseUntil,
                  })
                }
              />
            </label>

            <div className="pause-actions">
              {pauseOptions.map((option) => (
                <button
                  key={option.label}
                  className="pause-button"
                  onClick={() => pauseFor(option.milliseconds)}
                  title={`Pause clipboard watching for ${option.label}`}
                  aria-label={`Pause clipboard watching for ${option.label}`}
                >
                  {option.label}
                </button>
              ))}

              <button
                className="pause-button"
                onClick={clearTemporaryPause}
                title="Clear temporary pause"
                aria-label="Clear temporary pause"
              >
                Clear pause
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Ignored apps</h3>
            <p>
              Store app names you do not want ClipB to track later. This list is
              saved now, but active app blocking is not enabled yet.
            </p>

            <div className="ignored-app-form">
              <input
                value={ignoredAppInput}
                onChange={(event) => setIgnoredAppInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addIgnoredApp();
                  }
                }}
                placeholder="Example: 1Password, Bitwarden"
                title="Ignored app name"
                aria-label="Ignored app name"
              />

              <button
                className="settings-action-button"
                onClick={addIgnoredApp}
                title="Add ignored app"
                aria-label="Add ignored app"
              >
                Add
              </button>
            </div>

            {settings.ignoredApps.length > 0 ? (
              <div className="ignored-app-list">
                {settings.ignoredApps.map((appName) => (
                  <button
                    key={appName}
                    className="ignored-app-pill"
                    onClick={() => removeIgnoredApp(appName)}
                    title={`Remove ${appName} from ignored apps`}
                    aria-label={`Remove ${appName} from ignored apps`}
                  >
                    {appName}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="settings-note">
                Ignored apps are stored for now. ClipB still needs active-window
                detection before it can automatically block clips from these
                apps.
              </div>
            )}
          </section>

          <section className="settings-section">
            <h3>Backup</h3>
            <p>
              Export or import your ClipB history. JSON is text-only; .clipb
              includes rich clips, tags, images, and backed-up file assets.
            </p>

            <div className="settings-actions-grid">
              <button
                className="settings-action-button"
                onClick={onExportArchive}
                title="Export ClipB archive"
                aria-label="Export ClipB archive"
              >
                <Download size={17} aria-hidden="true" />
                Export .clipb
              </button>

              <button
                className="settings-action-button"
                onClick={onImportArchive}
                title="Import ClipB archive"
                aria-label="Import ClipB archive"
              >
                <Upload size={17} aria-hidden="true" />
                Import .clipb
              </button>

              <button
                className="settings-action-button"
                onClick={onExport}
                title="Export JSON backup"
                aria-label="Export JSON backup"
              >
                <Download size={17} aria-hidden="true" />
                Export JSON
              </button>

              <button
                className="settings-action-button"
                onClick={onImport}
                title="Import JSON backup"
                aria-label="Import JSON backup"
              >
                <Upload size={17} aria-hidden="true" />
                Import JSON
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>History retention</h3>
            <p>Choose how long ClipB keeps old clips.</p>

            <label className="field-label">
              Auto-delete clips
              <span className="select-control">
                <select
                  value={settings.historyRetentionDays}
                  title="Choose how long ClipB keeps old clips before auto-deleting them"
                  aria-label="Auto-delete clips retention period"
                  onChange={(event) =>
                    updateSetting({
                      ...settings,
                      historyRetentionDays: event.target.value as RetentionDays,
                    })
                  }
                >
                  {retentionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="setting-row">
              <div>
                <strong>Protect pinned clips</strong>
                <span>Pinned clips will not be auto-deleted.</span>
              </div>

              <input
                type="checkbox"
                checked={settings.protectPinnedClips}
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    protectPinnedClips: event.target.checked,
                  })
                }
              />
            </label>
          </section>

          <div className="settings-section">
            <div>
              <h3>Copied file backup</h3>
              <p>
                Save a private local copy of copied files inside ClipB. Folders
                are saved as paths only.
              </p>
            </div>

            <label className="setting-row">
              <div>
                <strong>Back up copied files</strong>
                <span>
                  When enabled, copied files are stored in ClipB assets instead
                  of only saving their original path.
                </span>
              </div>

              <input
                type="checkbox"
                checked={settings.backupCopiedFiles}
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    backupCopiedFiles: event.target.checked,
                  })
                }
              />
            </label>

            <label className="setting-row">
              <div>
                <strong>Maximum backup size</strong>
                <span>
                  Files larger than this are saved as path-only clips.
                </span>
              </div>

              <input
                className="number-input"
                type="number"
                min={1}
                max={500}
                value={settings.maxBackupFileSizeMb}
                disabled={!settings.backupCopiedFiles}
                title="Maximum backup file size in megabytes"
                aria-label="Maximum backup file size in megabytes"
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    maxBackupFileSizeMb: Math.max(
                      1,
                      Number(event.target.value) || 25,
                    ),
                  })
                }
              />
            </label>
          </div>

          <section className="settings-section danger-zone">
            <h3>Danger zone</h3>
            <p>This permanently deletes local clipboard history.</p>

            <button className="settings-danger-button" onClick={onClearAll}>
              <Trash2 size={17} />
              Clear all clips
            </button>
          </section>
        </div>
      </section>
    </div>
  );
}
