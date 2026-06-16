# Onda modular source map

Load order is deliberate. The CSS files are ordered to preserve the original cascade from `index.html`. The JavaScript files are classic scripts, not ES modules, so the existing global script behaviour remains closest to the last working version.

## Main files

- `index.html` — HTML shell and modal markup only.
- `css/00-tokens-base.css` — tokens, body, top/bottom panels, typography.
- `css/01-buttons-controls.css` — pills, deck buttons, tooltips, top visualizer, player controls.
- `css/02-settings-modals.css` — settings popup, mode bar, tags, overlays.
- `css/03-visualizer-import.css` — visualizer composer and library import/export UI.
- `css/04-history.css` — history workspace.
- `css/05-library-drawer.css` — database/library drawer.
- `css/06-playlists-now-playing.css` — playlist, now playing, artwork, multi-select.
- `css/07-responsive-mobile.css` — responsive and mobile rules.
- `css/08-playlist-refinements.css` — playlist/detail refinement rules.
- `css/09-ui-direct-edit-v3.css` — existing V3 layout compatibility CSS.
- `css/10-ui-direct-edit-v4.css` — existing V4 layout compatibility CSS.
- `css/11-v17-acceptance-fixes.css` — latest accepted source fixes from the backup.
- `css/12-cloud-sync.css` — Netlify Cloud Sync setup UI.
- `js/00-app-core.js` — original core app logic.
- `js/10-cloud-sync-ui.js` — Netlify Cloud Sync frontend/setup logic.
- `js/20-ui-layout-v3.js` — existing V3 layout compatibility logic.
- `js/21-ui-layout-v4.js` — existing V4 layout compatibility logic.
- `netlify/functions/onda-sync.js` — Netlify Blob sync function.

## Netlify

The function folder is kept as `netlify/functions`, matching `netlify.toml`:

```toml
[build]
  publish = "."
  functions = "netlify/functions"
```

The frontend endpoint remains:

```text
/.netlify/functions/onda-sync
```
