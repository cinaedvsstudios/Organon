# Onda Cloud Sync and core repair status

Baseline branch: `baseline/onda-general-working-2026-07-01`
Working branch: `fix/onda-cloud-sync-core-20260701`

## Included in this branch

- Removed the old layout-enhancement row-action injector that created or rewrote controls after the main app rendered them.
- Kept the layout helper limited to layout mode, fullscreen, and the transport-shell class. Library Select is again owned by `app-core.js`.
- Rebuilt `js/cloud-sync.js` around the static Cloud Sync UI already present in `index.html`; it no longer injects a settings card or installs a document-wide click handler.
- Cloud Sync stores and restores the selected device profile, and mirrors it to the existing Storage Health keys so both views agree.
- Existing localStorage secret data is a migration fallback only. After Chrome Password Credential storage succeeds during Save Setup, the persistent secret is removed from localStorage.
- Cloud requests now have a 15-second timeout and readable error states for an invalid secret, missing function deployment, invalid server response, and Blob-store failure.
- The Netlify function now performs a real Blob-store read before reporting connection success and no longer converts Blob-store failures into an empty device list.
- Removed the speed-cycle button and its obsolete JavaScript state/listener from the active player source. The Settings speed slider remains.
- Repaired Library Select mode so it genuinely toggles and clears selection when turned off.
- Added a request identifier to asynchronous track loading so a stale file or MIDI hydration result cannot overwrite a newer track selection.
- Removed the malformed nested playlist-edit row markup.
- Removed mobile CSS pseudo-icons that were layered over real playlist and row action icons, which caused doubled symbols on mobile.

## Still required before merge

- Deploy the branch to Netlify and perform real device-list, remembered-device, save, and load testing against the function and Blob store.
- No browser preview or visual testing was run from this environment.
