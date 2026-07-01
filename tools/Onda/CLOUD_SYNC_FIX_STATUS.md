# Onda Cloud Sync fix status

Baseline branch: `baseline/onda-general-working-2026-07-01`
Working branch: `fix/onda-cloud-sync-core-20260701`

## Included in this branch

- Removed the old layout-enhancement row-action injector. It created and rewrote controls after the main app rendered them, which was a source of duplicate or conflicting row controls.
- Kept the layout helper limited to the bottom layout toggle, fullscreen toggle, and transport-shell class.
- Rebuilt `js/cloud-sync.js` around the static Cloud Sync UI already present in `index.html`; it no longer injects a settings card or installs a document-wide click handler.
- Cloud Sync keeps device-profile choice in `ondaCloudSyncConfigV1` and mirrors it to the old Storage Health keys so both views agree.
- The selected device is restored on the next visit.
- Existing legacy secret storage remains available only as a transition fallback. Once Chrome password credential storage succeeds during Save Setup, the secret is removed from localStorage.
- Cloud requests now have a 15-second timeout and return visible errors for missing Netlify function deployment, invalid server responses, invalid secret, and Blob-store failures.
- The Netlify function now tests a real Blob-store read before reporting a successful connection and stops converting storage errors into an empty device list.

## Not yet altered in this branch

- The responsive stylesheet still contains legacy mobile pseudo-icon rules. The row-action injector removal removes one confirmed duplication source, but the remaining icon styling must be consolidated in the canonical responsive rules before release.
- `js/app-core.js` still needs a separate targeted pass for Select-mode state, speed-button text state, playlist-name escaping, and asynchronous track-load cancellation.
- No deployment, browser preview, or visual test was run from this environment.
