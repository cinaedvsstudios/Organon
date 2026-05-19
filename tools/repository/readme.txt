UI Repository Reconstruction v0.01
=================================

Open index.html in a browser.

Purpose
-------
This package rebuilds the UI Repository and UI Builder from the recovered repository v2.4 file. It splits the app into smaller files, restores missing components, keeps the UI Builder as an in-page floating/dockable panel, and includes the reconstructed requirements document.

File map
--------
index.html
  Main page shell. Loads Tailwind CDN, CSS files, HTML containers, and JavaScript files.

css/base.css
  Global variables, colours, scrollbars, base styles.

css/repository.css
  Header, sidebar, category index, repository layout.

css/component-cards.css
  Component cards, metadata/sandbox panels, badges, prompt boxes.

css/builder.css
  UI Builder floating/docked panel, pills, groups, sections, line numbers.

css/responsive.css
  Mobile/desktop layout differences.

js/component-data.js
  Source of truth for all component records. Restore/edit/add components here.

js/repository-render.js
  Builds the sidebar index and component cards from component-data.js.

js/sandbox-engine.js
  Shared prompt/sandbox support.

js/sandbox-actions.js
  Live demo helper functions used by component sandboxes.

js/builder-engine.js
  Main UI Builder actions: open/close, basket mode, add items, template, grouping, clear, docking.

js/builder-render.js
  Draws the UI Builder pills, groups, section cards, and left-side line numbers.

js/builder-export.js
  Generates the UI Builder text output, Copy All, and Download TXT.

js/builder-dragdrop.js
  Drag/drop reordering and mobile move button fallback.

js/storage.js
  Versioned localStorage helpers.

js/ui-utils.js
  Toasts, clipboard, download, escape helpers, stars, scrolling.

data/builder-default-template.js
  Default group template inserted by the Template button.

requirements-reconstruction.md
  Reconstructed requirements document from the recovery process.

How to add a new component
--------------------------
1. Open js/component-data.js.
2. Add a new object with id, title, term, desc, apps, wild, mods, risk, riskText, html, and prompt.
3. The sidebar and component card will generate automatically from that data.

Known notes
-----------
- Tailwind is loaded from CDN because the recovered files used Tailwind heavily. For a fully offline version, replace Tailwind utility usage with compiled/local CSS later.
- The UI Builder opens empty. Use the Template button to insert the default group structure.
- Line numbers are on the left side.
- The UI Builder is an in-page popup, not a separate browser window.
- The repository itself is intended to open as a standalone/full browser tab from the future HTML Editor.
