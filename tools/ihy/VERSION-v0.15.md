# Ihy v0.15 — Route and MIDI Repair Baseline

Permanent app page:

`tools/ihy/standalone.html`

## Audit findings fixed

- `standalone-v005.html` was a legacy iframe wrapper. It forced an obsolete `?v=0.04` child page, injected old layout rules, and overwrote the visible status/version as v0.05.
- `tools/ihy/index.html` still contained the older embedded application source.
- Both legacy entry paths now redirect directly to the permanent standalone page.
- The permanent page now loads a small compatibility script before the main app script. It supplies the actual Potion Song MIDI bytes to the existing built-in example loader.
- Existing `.mid`, `.midi`, and Ihy JSON import remains handled by the main application script.

## Current path policy

Use one route only:

`tools/ihy/standalone.html`

All previously used Ihy entry files route there so old wrapper code cannot be launched accidentally.

## Rollback

v0.14 remains available in Git history before the legacy entry files were redirected.