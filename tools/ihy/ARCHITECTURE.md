# Ihy v1.0.0 clean build plan

## Intentional runtime split

- `standalone.html` — one stable page shell and every existing control/modal.
- `css/app.css` — the current editor shell plus feedback, toast and resizer rules.
- `css/bass-generator.css` — one Bass Generator stylesheet that targets the markup actually used by the modal.
- `js/app.js` — editor, piano roll, tracks, MIDI import/export, transport, analysis, project persistence, feedback and panel resize behaviour.
- `js/bass-generator.js` — genre, emotion and custom bass generation; editable step grid; note-pattern parser; preview; timeline insertion; modal drag/resize.
- `icon.png` — existing app icon.

## Legacy consolidation record

| Old file group | v1 destination | Decision |
|---|---|---|
| `standalone.js` | `js/app.js` | Current editor/controller retained. |
| `clear-all.js` | `js/app.js` | Reset, toast and panel-resize support merged. |
| `standalone-v018.css`, `standalone-v035.css`, `feedback.css`, `standalone.css` | `css/app.css` | Current shell and feedback rules retained; obsolete layout snapshots are not loaded. |
| `bass-generator.js`, `bass-generator-v050.js`, `bass-generator-v053.js`, `bass-generator-v054.js` | `js/bass-generator.js` | v0.54 is the complete superset: profiles, emotions, custom mode, parser, effects, step editor, preview, insert and resize. |
| `bass-generator.css`, `bass-generator-v055.css`, `bass-generator-v056.css` | `css/bass-generator.css` | Their usable layout rules are reconciled against live v1 element IDs/classes. |
| `standalone-v022.js`, `standalone-v025.js`, `standalone-v030.js`, `standalone-v033.js`, `standalone-v035.js` | No separate runtime file | Earlier snapshots are superseded by the current editor controller; their stable UI/resizer/export concepts were audited before the v1 split. |

## Repair included in v1

The blank editor failure came from `standalone.js` treating every `.modal-layer` as a generic modal and calling `addEventListener` on a missing `.modal-header` inside the Bass Generator. The v1 core excludes the Bass modal from that generic binding. The Bass module owns its own drag/resize handling.

## Verification checklist

1. Initial editor renders a Piano track and piano roll.
2. Create, Save, Clear, Import, Export and Analyse controls bind without a console exception.
3. `+ Bass` opens the full modal.
4. Genre, Emotion and Custom mode buttons remain in one header row on desktop.
5. Phrase, Sustain, Echo and Chords buttons visibly select.
6. The step grid populates and can be edited.
7. Preview, Add to Timeline and Close respond.
8. Reload retains migrated prior project data under the v1 local-storage key.
