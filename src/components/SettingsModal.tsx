import { Download, Palette, Trash2, Upload, X } from "lucide-react";
import type { AppSettings, RetentionDays, ThemeMode } from "../types";

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: () => Promise<void>;
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
  onClearAll,
}: SettingsModalProps) {
  if (!open) return null;

  async function updateSetting(nextSettings: AppSettings) {
    await onSaveSettings(nextSettings);
  }

  return (
    <div className="modal-backdrop">
      <section className="settings-modal">
        <header className="settings-modal__header">
          <div>
            <h2>Settings</h2>
            <p>Backup, privacy, appearance, and local history controls.</p>
          </div>

          <button title="Close settings" className="modal-close-button" onClick={onClose}>
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

          <section className="settings-section">
            <h3>Backup</h3>
            <p>Export or import your text clipboard history as JSON.</p>

            <div className="settings-actions-grid">
              <button className="settings-action-button" onClick={onExport}>
                <Download size={17} />
                Export JSON
              </button>

              <button className="settings-action-button" onClick={onImport}>
                <Upload size={17} />
                Import JSON
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>History retention</h3>
            <p>Choose how long ClipB keeps old clips.</p>

            <label className="field-label">
              Auto-delete clips
              <select
                value={settings.historyRetentionDays}
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