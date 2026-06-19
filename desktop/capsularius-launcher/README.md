# Capsularius Desktop Launcher

This is a local Electron development launcher for Capsularius. It opens the existing `tools/capsularius/index.html` from the same local Organon checkout, rather than loading the GitHub Pages site.

## First use on Windows

1. Keep this folder inside the local Organon repository at `desktop/capsularius-launcher`.
2. Install Node.js once if it is not already installed.
3. Double-click `Start Capsularius Desktop.cmd`.
4. The first launch runs `npm install`; later launches open directly.

The start command attempts a safe `git pull --ff-only` before launch when Git is available. If the local checkout has changes that cannot fast-forward safely, it leaves those files alone and starts with the local version.

## Development behaviour

- `Ctrl+R` reloads the same local HTML, CSS, and JavaScript files immediately.
- Restarting the launcher pulls committed GitHub changes when possible, then opens the local checkout.
- Chrome/Pages continue to use the existing browser version independently.

## Native bridge foundation

The launcher keeps Node and filesystem APIs out of the Capsularius page. It exposes a small isolated `window.capsulariusDesktop` bridge with a native folder picker and approved-folder directory listing. The current Capsularius browser mount layer is not yet connected to this bridge.

The next desktop pass is to make Capsularius detect the bridge and use its native folder picker and native directory adapter in Desktop mode, while retaining the current browser picker in Chrome.
