# ClipB

**ClipB** is a local-first desktop clipboard manager built with **Tauri**, **React**, **TypeScript**, and **SQLite**.

It automatically saves copied text from your system clipboard and organizes it into a clean timeline with day, week, month, and year views. Users can search previous clips, copy them back to the clipboard, pin important clips, delete unwanted clips, and export/import their clipboard history as JSON.

ClipB is designed to be private, lightweight, and fully local by default.

---

## Overview

Most clipboard managers show copied items as one long list. ClipB takes a more timeline-focused approach.

Copied text is organized by time, making it easier to answer questions like:

- What did I copy earlier today?
- What link did I copy last week?
- What notes or snippets did I copy during a project session?
- What did I copy on a specific day?

ClipB gives your clipboard memory without forcing cloud sync, accounts, or external storage.

---

## Current Features

- Local clipboard history
- Text clipboard tracking
- Calendar-style sidebar
- Day, week, month, and year views
- Search clipboard history
- Copy saved clips back to the clipboard
- Pin important clips
- Delete individual clips
- Clear all clips from settings
- Pause/resume clipboard watching
- Export clipboard history as JSON
- Import clipboard history from JSON
- Auto-delete old clips after a selected period
- Option to protect pinned clips from auto-delete
- Local SQLite database storage
- Responsive desktop UI

---

## Tech Stack

| Area | Technology |
| --- | --- |
| Desktop runtime | Tauri |
| Frontend | React |
| Language | TypeScript |
| Styling | CSS |
| Local database | SQLite |
| Clipboard access | Tauri clipboard plugin |
| File export/import | Tauri dialog + file system plugins |
| Icons | Lucide React |

---

## Why Tauri?

ClipB is a background-style desktop utility, so it should be lightweight, fast, and private.

Tauri is a strong fit because:

- It creates smaller desktop apps compared to Electron.
- It uses the system webview instead of bundling a full Chromium runtime.
- It gives access to native desktop APIs through plugins.
- It has a stronger default security model.
- It works well with React and TypeScript.

---

## Why SQLite Instead of JSON for Storage?

ClipB uses SQLite for internal storage because clipboard history grows over time.

SQLite is better for:

- Searching clips
- Filtering by date
- Sorting clips
- Deleting old clips
- Pinning clips
- Avoiding one huge JSON file
- Keeping the app fast as the history grows

JSON is used for **backup/export/import**, not as the main app database.

The storage strategy is:

```txt
SQLite = internal app storage
JSON = portable backup/import format
```

---

## Export and Import

ClipB currently supports exporting and importing text clips as JSON.

The JSON export format is designed to be simple and portable:

```json
{
  "app": "ClipB",
  "formatVersion": 1,
  "exportedAt": 1760000000000,
  "clips": [
    {
      "type": "text/plain",
      "content": "Example copied text",
      "createdAt": 1760000000000,
      "updatedAt": 1760000000000,
      "isPinned": false
    }
  ]
}
```

This makes it possible to:

- Back up your clipboard history
- Move your data to another machine
- Import your history after reinstalling ClipB
- Potentially migrate to another app in the future

---

## Future Support for Images and Files

ClipB currently focuses on text only.

In the future, image and file support should not be stored directly inside JSON. While images and files can technically be converted into Base64 and placed inside JSON, that makes exports large and inefficient.

The better future format is a `.clipb` backup archive.

Example:

```txt
clipb-backup.clipb
├── manifest.json
├── clips.json
└── assets/
    ├── image-001.png
    ├── image-002.png
    └── file-001.pdf
```

This keeps JSON useful for metadata while storing larger assets separately.

---

## Local-First Philosophy

ClipB is designed to be local-first.

That means:

- No account required
- No cloud sync by default
- No external server required
- Clipboard data stays on the user’s device
- Export/import is controlled by the user
- The app should work offline

This is important because clipboard history can contain sensitive information such as:

- Passwords
- API keys
- Private messages
- Personal notes
- Bank details
- Work documents
- Authentication tokens

Because of this, privacy and user control are core parts of the product.

---

## Project Structure

```txt
clipb/
├── src/
│   ├── components/
│   │   ├── ClipCard.tsx
│   │   ├── EmptyState.tsx
│   │   ├── SettingsModal.tsx
│   │   └── Sidebar.tsx
│   │
│   ├── hooks/
│   │   └── useClipboardWatcher.ts
│   │
│   ├── lib/
│   │   ├── backup.ts
│   │   ├── dates.ts
│   │   ├── db.ts
│   │   └── hash.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   └── index.css
│
├── src-tauri/
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── package.json
├── README.md
└── .gitignore
```

---

## Development Setup

Install dependencies:

```bash
pnpm install
```

Run the app in development mode:

```bash
pnpm tauri dev
```

Build the desktop app:

```bash
pnpm tauri build
```

---

## Recommended `.gitignore`

Make sure these files are ignored:

```gitignore
# Dependencies
node_modules

# Frontend build output
dist
build
.vite

# Tauri build output
src-tauri/target

# Local environment files
.env
.env.local

# Local database files
*.db
*.db-shm
*.db-wal

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/*
!.vscode/extensions.json
.idea
```

---

## Milestones

### v0.1 — Initial MVP

- [x] Create Tauri desktop app
- [x] Set up React + TypeScript frontend
- [x] Add SQLite database
- [x] Save copied text locally
- [x] Prevent immediate duplicate clipboard saves
- [x] Display clipboard history as cards
- [x] Add calendar sidebar
- [x] Add day view
- [x] Add week view
- [x] Add month view
- [x] Add year view
- [x] Add search
- [x] Add copy-back button
- [x] Add delete clip button
- [x] Add pin/unpin feature
- [x] Make layout responsive
- [x] Fix small-window calendar spacing

### v0.2 — Backup and Safety

- [x] Add settings modal
- [x] Add pause/resume clipboard watching
- [x] Add JSON export
- [x] Add JSON import
- [x] Add clear all clips
- [x] Add clear-history warning
- [x] Add auto-delete retention setting
- [x] Add protect pinned clips setting

### v0.3 — Desktop Utility Upgrade

- [x] Add system tray icon
- [x] Keep app running in background
- [x] Add global shortcut to open ClipB
- [x] Add launch on startup option
- [x] Add minimize to tray
- [x] Add quick-copy popup window
- [x] Add keyboard navigation

### v0.4 — Privacy and Filtering

- [x] Add sensitive text detection
- [x] Ignore likely passwords
- [x] Ignore likely API keys/tokens
- [x] Add ignored apps list
- [x] Add active app detection for ignored apps
- [x] Block clips copied from ignored apps
- [x] Add minimum clip length setting
- [x] Add maximum clip length setting
- [x] Add private mode
- [x] Add temporary pause timer

### v0.5 — Better Organization

- [x] Add tags
- [x] Add favorite clips
- [x] Add clip categories
- [x] Add manual notes
- [x] Add URL detection
- [x] Add code snippet detection
- [x] Add filter by pinned clips
- [x] Add filter by content type

### v0.6 — Rich Clipboard Support

- [x] Add image clipboard support
- [x] Add copied image file support on macOS Finder copy
- [x] Add copied file path support
- [ ] Add copied non-image file path support
- [ ] Add optional copied file backup
- [ ] Add `.clipb` archive export
- [ ] Add `.clipb` archive import
- [x] Add asset preview cards

### v1.0 — Public Release

- [ ] Add app icon
- [ ] Add installer builds
- [ ] Add Windows build
- [ ] Add macOS build
- [ ] Add Linux build
- [ ] Add release notes
- [ ] Add privacy policy
- [ ] Add landing page
- [ ] Add screenshots/GIF demo
- [ ] Add GitHub releases
- [ ] Add signed builds if needed

---

## Product Principles

ClipB should stay:

- Fast
- Local-first
- Private
- Simple
- Useful without an account
- Easy to export from
- Safe for sensitive clipboard content

---

## Future Ideas

Possible future features:

- Cloud sync as an optional feature
- End-to-end encrypted sync
- Mobile companion app
- Browser extension
- OCR for copied images
- AI-powered clipboard search
- Smart summaries of copied research
- Workspaces/projects
- Temporary clipboard sessions
- Clipboard analytics

Cloud sync should not be added until the local-first app is stable and privacy controls are strong.

---

## Commit Naming

Recommended commit names:

```bash
git commit -m "Initial ClipB MVP"
git commit -m "Add JSON backup and history settings"
git commit -m "Add tray and global shortcut"
git commit -m "Add privacy filters"
git commit -m "Add image clipboard support"
```

---

## License

No license has been selected yet.

Before public release, choose a license such as:

- MIT
- Apache-2.0
- GPL-3.0
- Proprietary

For an open-source utility app, MIT is a simple starting point.

---

## Status

ClipB is currently in early MVP development.

The current focus is building a stable, private, local-first clipboard manager before adding advanced sync, image support, or file support.
