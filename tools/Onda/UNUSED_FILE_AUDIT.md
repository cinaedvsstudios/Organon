# Onda unused-file audit

This report is generated from the runtime entry points: `index.html`, `netlify.toml`, `package.json`, and `netlify/functions/onda-sync.js`. A file is listed as a deletion candidate only when no runtime-reachable file references its path.

## Runtime-reachable files

- `css/base.css`
- `css/cloud-sync.css`
- `css/controls.css`
- `css/layout.css`
- `css/library.css`
- `css/modals-settings.css`
- `css/player.css`
- `css/playlists-now-playing.css`
- `css/responsive.css`
- `css/streaming.css`
- `css/tokens.css`
- `css/visualizer-tools.css`
- `index.html`
- `js/app-core.js`
- `js/cloud-sync.js`
- `js/layout-enhancements.js`
- `netlify.toml`
- `netlify/functions/onda-sync.js`
- `onda-midi.js`
- `package.json`

## Unreferenced deletion candidates

- `CHANGE_LIST.txt`
- `CLEAN_SOURCE_MAP.md`
- `CLEAN_VERIFY_REPORT.json`
- `CLOUD_SYNC_FIX_STATUS.md`
- `DESKTOP_FIX_PASS2_REPORT.json`
- `DESKTOP_FIX_REPORT.json`
- `MOBILE_FIX_PASS1_REPORT.json`
- `MOBILE_FIX_PASS3_REPORT.json`
- `MOBILE_FIX_PASS4_REPORT.json`
- `MOBILE_FIX_PASS5_REPORT.json`
- `MOBILE_FIX_PASS6_REPORT.json`
- `MODULAR_SOURCE_MAP.md`
- `README-ONDA-SYNC.txt`
- `STRICT_UI_CLEANUP_REPORT.json`
- `backup.zip`
- `css/00-tokens-base.css`
- `css/01-buttons-controls.css`
- `css/02-settings-modals.css`
- `css/03-visualizer-import.css`
- `css/04-history.css`
- `css/05-library-drawer.css`
- `css/06-playlists-now-playing.css`
- `css/07-responsive-mobile.css`
- `css/08-playlist-refinements.css`
- `css/09-ui-direct-edit-v3.css`
- `css/10-ui-direct-edit-v4.css`
- `css/11-v17-acceptance-fixes.css`
- `css/12-cloud-sync.css`
- `css/final-ui-fixes.css`
- `js/00-app-core.js`
- `js/10-cloud-sync-ui.js`
- `js/20-ui-layout-v3.js`
- `js/21-ui-layout-v4.js`
- `onda-mobile-library-patch.css`
- `onda-mobile-library-patch.js`
- `placeholder.jpg`

## Notes

- This is static reachability only. It intentionally does not delete anything by itself.
- Files referenced by dynamic strings are included when the string contains a local `css/`, `js/`, or `netlify/functions/` path.
