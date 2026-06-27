# ClipB Privacy Policy

Effective date: To be added before public release

ClipB is a local-first desktop clipboard manager. It is designed to store clipboard history on your own device, without requiring an account, cloud sync, or an external server.

This Privacy Policy explains what ClipB stores, what it does not collect, and how users control their data.

---

## Summary

ClipB is designed around these privacy principles:

* Clipboard data is stored locally on your device.
* ClipB does not require an account.
* ClipB does not upload clipboard history to a server.
* ClipB does not sell user data.
* ClipB does not include cloud sync by default.
* ClipB does not include analytics or telemetry by default.
* Users can delete clips, clear history, and export their own data.

---

## What ClipB Stores Locally

ClipB may store the following data locally on your device:

* Copied text
* Copied links
* Copied code snippets
* Copied image data and screenshots
* Copied file paths
* Optional local backups of copied files
* Clip metadata, such as creation time and update time
* Pinned status
* Favorite status
* Notes added by the user
* Tags added by the user
* Clip category information
* App settings
* Ignored app names
* Privacy and filtering preferences

ClipB stores this data in a local SQLite database and, for images or backed-up files, in a local assets folder inside the app data directory.

---

## What ClipB Does Not Collect

ClipB does not collect or transmit:

* Account information
* Cloud account data
* Payment information
* Location data
* Advertising identifiers
* Browsing history
* Usage analytics
* Crash reports
* Telemetry
* Clipboard history on a remote server

ClipB does not sell, rent, or share clipboard data with advertisers or data brokers.

---

## Clipboard History

ClipB watches the system clipboard when clipboard watching is enabled.

When you copy supported content, ClipB may save it locally so you can access it later. Supported content may include text, links, code snippets, images, screenshots, copied image files, copied file paths, and optionally backed-up files.

You can pause clipboard watching, enable private mode, delete individual clips, clear all clips, and configure automatic retention settings.

---

## Images and Files

ClipB supports rich clipboard content.

Images and screenshots may be stored as local asset files. Copied file paths may be stored as path-only clips. If copied file backup is enabled, ClipB may copy supported files into its local assets folder.

Path-only file clips do not include a copy of the original file. If the original file is moved or deleted, the path-only clip may no longer point to an existing file.

Backed-up file clips store a local copy of the file inside ClipB’s app data folder.

Folders are saved as paths only.

---

## Export and Import

ClipB supports user-controlled export and import.

ClipB may export data as:

* JSON backup files for simple text history
* `.clipb` archive files for rich clipboard history, including metadata, tags, image assets, and backed-up file assets

Exported files are created only when the user chooses to export them. Once exported, the user is responsible for where those files are stored or shared.

Imported `.clipb` archives are processed locally.

---

## Privacy Filters

ClipB includes local privacy filters that can help avoid saving sensitive clipboard content.

These may include:

* Ignoring likely passwords
* Ignoring likely API keys and tokens
* Ignoring sensitive-looking clips
* Blocking clips copied from ignored apps
* Minimum clip length settings
* Maximum clip length settings
* Private mode
* Temporary pause timer

These filters run locally on the user’s device before supported clipboard content is saved.

---

## Ignored Apps

ClipB can store a user-defined list of ignored apps.

When active app detection is available, ClipB can avoid saving clips copied from apps in the ignored apps list. This feature is intended to help users avoid saving sensitive data from password managers, private work tools, or other apps they choose.

Ignored app names are stored locally.

---

## How Data Is Used

ClipB uses locally stored data only to provide clipboard manager features, such as:

* Showing clipboard history
* Searching clips
* Filtering clips
* Restoring copied content to the clipboard
* Displaying image and file previews
* Managing tags, notes, favorites, and pinned clips
* Exporting and importing user-controlled backups
* Applying local privacy settings

ClipB does not use clipboard data for advertising, profiling, or third-party analytics.

---

## Data Sharing

ClipB does not send clipboard data to the developer or to third-party services.

ClipB does not share clipboard history with advertisers, analytics providers, or data brokers.

If a user manually exports a JSON or `.clipb` backup and shares that file elsewhere, that action is controlled by the user.

---

## Data Deletion

Users can delete data in several ways:

* Delete individual clips
* Clear all clips from settings
* Configure automatic deletion after a selected period
* Protect pinned clips from automatic deletion
* Delete exported backup files manually from their device

When clips with local asset files are deleted, ClipB attempts to remove the associated local asset files as well.

---

## Security

ClipB stores clipboard history locally on the user’s device.

Users should be aware that clipboard history can contain sensitive information. ClipB provides privacy controls to reduce accidental saving of sensitive content, but users should still be careful when copying passwords, private keys, bank details, confidential files, or other sensitive information.

Device-level security, such as disk encryption, account passwords, and operating system permissions, remains important.

---

## Cloud Sync

ClipB does not currently include cloud sync.

If cloud sync, accounts, payments, or hosted backup features are added in the future, this Privacy Policy should be updated before those features are released.

---

## Third-Party Services

The desktop app does not use third-party analytics, advertising networks, or cloud storage by default.

If users access ClipB through GitHub, app stores, package managers, or a future landing page, those third-party platforms may process data under their own privacy policies.

---

## Children’s Privacy

ClipB is a general-purpose desktop utility. It is not specifically directed to children.

---

## Open Source

ClipB is open-source software. Users can inspect the source code to understand how clipboard data is handled.

---

## Changes to This Policy

This Privacy Policy may be updated as ClipB changes. Important privacy-related changes should be documented clearly in release notes or project documentation.

---

## Contact

For questions about ClipB privacy, open an issue on the project repository or contact the project maintainer.

Contact details should be added before public release.
