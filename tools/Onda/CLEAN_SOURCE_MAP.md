# Onda strict clean source map

## HTML

- `index.html` is the app shell and modal markup. It has no static inline `style=` attributes.

## CSS

- `css/tokens.css` — variables/design constants.
- `css/base.css` — body/forms/base helpers.
- `css/layout.css` — app shell, workspace layout, settings popup base, and structure utilities.
- `css/player.css` — player, visualizer surface, transport and seek UI.
- `css/controls.css` — shared buttons, tabs, pills and control widgets.
- `css/library.css` — library drawer/database/import/export/storage UI.
- `css/playlists-now-playing.css` — playlist and now-playing views.
- `css/modals-settings.css` — settings, modals, overlays, tags bar, JSON and toast UI.
- `css/visualizer-tools.css` — visualizer composer and preset controls.
- `css/streaming.css` — URL/YouTube/SoundCloud/Spotify/Apple UI.
- `css/responsive.css` — all mobile/desktop/layout-mode overrides, including Cloud Sync responsive overrides.
- `css/cloud-sync.css` — Netlify Cloud Sync base UI only.

## JavaScript

- `js/app-core.js` — main app logic, kept as a classic script to preserve working global behaviour. Normal UI show/hide state is now class-based; dynamic sizing/position/colour uses CSS variables.
- `js/cloud-sync.js` — frontend cloud sync/setup wizard. No direct DOM style mutations.
- `js/layout-enhancements.js` — bottom bar, forced layout mode, fullscreen and row-action enhancements.

## Netlify

The function remains at:

```text
netlify/functions/onda-sync.js
```

The frontend endpoint remains:

```text
/.netlify/functions/onda-sync
```

The function file is byte-for-byte identical to the uploaded `onda-sync.js`.
