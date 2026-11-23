# Onda Android icon assets

Approved emblem: weathered bronze ring with four cardinal tabs, charcoal centre and cyan/green audio-wave arcs. The logo is circular with transparency outside the ring; there is no square tile.

- `onda-icon-192.png`: 192 x 192 transparent PNG downscaled from the approved logo, supplied to Chrome and home-screen shortcuts.
- `onda-icon.svg`: self-contained larger scalable-format wrapper containing that same PNG artwork, offered to SVG-capable browsers and PWA manifests.
- `../manifest.webmanifest`: declares icons and Onda's home-screen name and launch scope.

The SVG wrapper is **not a vector tracing** and will not add any extra background or visual design. The original full-resolution generated artwork is preserved in this conversation, not checked in as an additional large source file.

Note: Chrome may cache home-screen icons. Once the site is deployed, remove the old shortcut and re-add it if the icon does not update. Test actual Android Chrome; no service worker or media caching changes were introduced.
