UI Repository Rebuild v0.02
===========================

Open index.html in a browser.

What this tool does
-------------------
The UI Repository is a visual catalogue of UI components. You browse the component cards, use their live sandbox examples, copy prompt text, and add selected components into the UI Builder.

The UI Builder is an in-page floating/dockable workspace. It is not a separate browser window. It lets you collect components as compact pills, add notes, create visual groups and sections, drag pills into containers, and export the build plan as text for Gemini/GPT.

Important v0.02 changes
-----------------------
- The UI Builder is draggable when floating.
- The builder toolbar now follows the compact mockup style.
- Group creates an empty group card named GROUP 1, GROUP 2, etc.
- Group names and section names can be renamed by clicking the title pill.
- Section opens a downward menu with TOP / UPPER, MID / CENTER, LOWER / BOTTOM, MENU, BODY, SIDE PANEL, LOWER PANEL, MOBILE VERSION ONLY, DESKTOP VERSION ONLY, and CUSTOM SECTION.
- Template is parked for later and shows a Coming soon toast.
- Free text creates compact grey pills rather than large boxes.
- Component pills are black with white text.
- Selected pills turn blue.
- Pills inside groups/sections tint toward the container colour.
- Line numbers are on the left and represent visual rows.
- The red x deletes one pill.
- The ⛔ button deletes a whole group/section container with an in-app confirmation modal.
- Clear uses an in-app confirmation modal, not the browser system confirm.
- Dragging requires clicking/selecting a pill first.
- Drop targets show a glowing insertion/target indicator.

File guide
----------
index.html
  Main page shell.

css/base.css
  Global variables, palette, fonts, base body styles.

css/repository.css
  Header, component index, repository layout.

css/component-cards.css
  Component card layout, badges, sandbox panels, prompt boxes.

css/builder.css
  UI Builder toolbar, floating window, pills, groups, sections, drag/drop visuals, confirmation modal.

css/responsive.css
  Mobile/desktop layout adjustments.

js/component-data.js
  The component database. This is the source of truth for the 45 UI components.

js/repository-render.js
  Builds the component index and component cards from component-data.js.

js/sandbox-engine.js and js/sandbox-actions.js
  Live sandbox and demo behaviours.

js/builder-engine.js
  Builder state, open/close, group/section creation, free-text pill creation, selection, delete, dock, custom confirmation.

js/builder-render.js
  Visual UI Builder display: line rows, compact pills, groups, sections.

js/builder-dragdrop.js
  Pill dragging, drop targets, moving items into groups/sections.

js/builder-export.js
  Copy/download text export.

js/storage.js
  localStorage keys and helpers.

js/ui-utils.js
  Toasts, clipboard, download, escaping, IDs.

data/builder-default-template.js
  Parked for later template logic.

requirements-reconstruction.md
  Requirements and reconstruction notes preserved from the planning document.

Testing notes
-------------
If the builder looks stale after loading v0.02, clear localStorage for this page or use the Clear button. v0.02 uses new localStorage keys, so old v0.01 data should not normally interfere.

Known follow-up area
--------------------
The component descriptions have been expanded as a first pass, but a later content pass can still make each of the 45 entries more specific and polished.
