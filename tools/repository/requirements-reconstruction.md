# UI Repository & UI Builder Requirements Reconstruction

## Purpose

The UI Repository is the component glossary, live sandbox library, prompt helper, and planning workspace for Organon UI building. It works like an online shopping system for UI features and behaviours: the user browses UI components, tests them, collects them in a Builder Basket, organises them inside the UI Builder, then exports a structured prompt/spec for AI HTML generation.

The UI Builder is not a simple favourites list. It is a structured interface-planning document builder. The exported output is intended to be pasted into Gemini/GPT to generate full HTML, which is then edited in the HTML Editor.

## Locked workflow

1. Browse the repository.
2. Read component terminology, descriptions, use cases, examples, modifications, and Code Risk.
3. Test the component in the live sandbox.
4. Activate Builder Basket.
5. Click numbered component badges to add selected components to the UI Builder.
6. Keep the UI Builder open for targeted insertion, or use quick basket mode to collect many components quickly.
7. Arrange, type notes, add sections, group items, and export.
8. Paste the exported UI Builder spec into AI to generate HTML.
9. Use the HTML Editor to work on the generated file.

## Locked terminology

- **Component**: one UI feature from the repository.
- **Builder Basket**: collection mode for selected components.
- **UI Builder**: the floating in-page builder/editor panel.
- **Group**: a major layout area or feature cluster.
- **Subsection**: TOP/UPPER, MIDDLE/CENTER, LOWER/BOTTOM.
- **Pill**: compact rounded builder item representing a component, note, section, group, behaviour, etc.
- **Code Risk**: the chance that a component/behaviour complicates or destabilises the codebase.

## Base file decision

Use `repository v2.4.html` as the reconstruction base because it contains the strongest surviving system: database-driven component rendering, UI Builder, basket mode, dock/copy/download/clear controls, click-anywhere text creation, editable pills, eye expand/collapse, line highlighting, premium components, and component IDs up to 45.

Do not use v2.4 blindly. It had missing components, shallow export syntax, inconsistent colour drift, and some terminology problems.

## Missing IDs restored/evaluated

The v2.4 file was missing these IDs, which should not be treated as intentionally removed:

`06, 07, 08, 10, 18, 19, 20, 22, 23`

Restored components:

- 06 Floating Action Button with Notification Badge.
- 07 Range Slider & Custom Select Dropdown.
- 08 Persistent Bottom Sheet / Sheet Footer Bar.
- 10 Text Button with Leading Icon.
- 18 Drag-and-Drop Raw Textarea Loader.
- 19 Interactive Column Width Resizer.
- 20 Composite Multi-Key Sequence Selector.
- 22 Layered Priority Sort Configuration.
- 23 Global Search-and-Replace Sanitizer.

## Component card requirements

Every component card should include:

- Component ID.
- Component title.
- Terminology.
- Common/slang names where known.
- What it does.
- Possible applications.
- Live examples in the wild.
- Modifications.
- Code Risk.
- Live sandbox.
- Prompt customizer/prompt generator.
- Copy prompt button.
- Shopping basket badge.

The repository is a training tool, not just a short component list. Do not delete verbose component detail to save space.

## Group Structure System

Groups always use:

`======== GROUP X: NAME ========`

Subsections use dotted separators:

`.......... TOP / UPPER ..........`

Every group should support:

- Notes.
- This feature should appear on: [Mobile] [Desktop].
- Code Risk.
- TOP / UPPER.
- MIDDLE / CENTER.
- LOWER / BOTTOM.

Every subsection should support:

- Align.
- Colors.
- Components.
- Behavior.
- Interactions.
- Dynamic Content.
- Links.

## UI Builder decisions

- UI Builder is an in-page popup/floating panel, not a separate browser window.
- It can dock into the repository sidebar.
- It should remain visible while the user browses and clicks repository components.
- It opens empty if there is no content.
- The default group template inserts only when the Template button is clicked.
- Clear asks for confirmation and returns to empty.
- Free text is created by clicking in the black builder workspace.
- Free-text pills commit on blur/click-away/Enter.
- Line numbers appear on the left side.
- Duplicate components are allowed because the same UI component may be used more than once.
- Badges show whether at least one copy of that component exists in the builder.

## Colour rules

Use later user feedback as the deciding source when recovered files conflict.

Locked colours:

- Main background: black/dark.
- Metadata card borders: blue.
- Sandbox/preview card borders: yellow/gold.
- Default component badge: yellow/gold.
- Added component badge: blue glow/pulse.
- Active Builder Basket: green glow/pulse.
- Active UI Builder button: red glow/pulse.
- Red means warning/attention.
- Green means active/on, not general positive everywhere.
- Groups: `#4b84bf`.
- TOP/UPPER: `#449e92`.
- MIDDLE/CENTER: `#d27d6c`.
- LOWER/BOTTOM: `#9a2f4f`.

## File split decision

The final app should not remain one giant HTML file. This package splits the app into:

- `index.html`: page shell only.
- `css/`: base, repository, component-card, builder, and responsive styles.
- `js/component-data.js`: component database/source of truth.
- `js/repository-render.js`: sidebar/card rendering.
- `js/sandbox-engine.js`: shared sandbox/prompt capture logic.
- `js/sandbox-actions.js`: demo behaviours.
- `js/builder-engine.js`: core builder behaviour.
- `js/builder-render.js`: builder visual output.
- `js/builder-export.js`: copy/download/export.
- `js/builder-dragdrop.js`: reordering/move controls.
- `js/storage.js`: versioned localStorage.
- `js/ui-utils.js`: helpers.
- `data/builder-default-template.js`: default group template.

## Implementation safeguards

- Component data is the source of truth. Sidebar and cards are generated from the same component database.
- Export should use builder state, not scrape the DOM.
- localStorage uses versioned keys to avoid corrupting the rebuild with old broken states.
- Text in component cards should stay selectable.
- Drag/drop has mobile move-button fallback.
- Copy has download/fallback support.
- The UI Repository should run standalone because the HTML Editor opens it in a new full browser window/tab.

## Current build note

This ZIP is version `0.01` reconstruction. It restores the split architecture, missing components, UI Builder workflow, colour decisions, and export improvements. It should be tested before being treated as final production code.
