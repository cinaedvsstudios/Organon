# Onda v3.17 — Mobile Library Touch and Search Toolbar QA

**Source update:** 2026-11-23  
**Status:** Changes committed in GitHub. **28 isolated/static checks passed. Android/desktop browser layout, Netlify deployment, and real media playback remain unverified.**  
**Previous release:** [v3.16 mobile Library](./RELEASE_V3_16.md)  
**Related issue:** ONDA-14 (mobile touch/accessibility) and ONDA-02 (Library drawer).

## Reason and scope

A v3.16 source review found the mobile Library search bar still declared *four* CSS grid columns while its central action menu was hidden, leaving only search and source filter visible. The extra empty columns could compress the search input on narrow phones. Other Library controls, including the clear-search button and top Select/Settings/Close buttons, retained 22–28px hit areas.

The Icon Guide is **already inside** the mobile drawer content region. No change was needed to its DOM placement; it remains scrollable in the existing mobile view.

## Changes

- In the canonical `css/responsive.css`, use exactly **two** mobile Library toolbar columns: flexible search, minimum-112px source filter. The desktop Library grid is unchanged.
- Provide a 44px touch area for the Library search input, clear-search button, source filter, header Select/Settings/Close controls, and bulk/settings action buttons.
- Reserve 50px inside the search input for its clear button so that text does not overlap the hit target.
- Give the mobile Select button a live `aria-pressed` value and a visual enabled state derived from `isLibrarySelectMode`; the original row click/selection behaviour is unchanged.
- Add explicit accessible labels to mobile Library Select, Settings, Close, Search, and Source Filter controls.
- Bump `ONDA_VERSION` to v3.17 and use `v=3.17` for changed JavaScript and responsive CSS.

No new navigation, playlist/media data migration, storage cleanup, audio engine changes, IndexedDB schema changes, new APIs, or original-file writes are introduced. Existing queue, custom icons and playback controls remain intact.

## Static and isolated QA performed

**28 checks passed**, including JavaScript parsing, source version and cache-bust references, five unique labelled controls, two-column grid, 44px control dimensions, search padding, unchanged playback-control layout, balanced CSS braces, preserved row-body selection and actual execution of the extracted `updateBulkActionUI()` function with both selection ON and OFF to confirm the `aria-pressed` and visual states change correctly.

Source and isolated checks **do not** prove how browser CSS is laid out at runtime and must not be marked as Android tests.

## Android / desktop acceptance tests still needed

1. Confirm `https://ondaplayer.netlify.app/` reports **v3.17** once published. Do not clear Android Chrome site data or the Onda cache.
2. At 320/360/390/420px widths, check the mobile Library toolbar shows a useful search input alongside the source filter, with no hidden empty columns or horizontal clipping. Repeat with large text, portrait/landscape and keyboard visible.
3. Search for an existing track and one nonexistent track, clear the latter using the 44px clear button, and confirm the right end of input text remains readable.
4. Tap top Select, Settings, Close and the mobile navigation controls using an actual finger. Select should toggle and have a visibly highlighted ON state; normal row-body selection remains intact.
5. Confirm the Icon Guide still scrolls, editable icon values survive reload, Recents and Playlists still open, and existing import/Storage shortcuts work.
6. Confirm the Current-screen queue, existing player symbols, pause/play, Next/Previous, Media Session lock-screen behaviour, reconnect, playlists and local audio caches are unchanged.
7. Repeat the Library search, selection and settings actions on **desktop Chrome**, including forced desktop mode on a small window, to detect cross-layout regressions.

## Next release gate

Android Chrome (tab and shortcut/PWA), Netlify deployment, desktop computed styles/interaction, file-handle permission persistence and actual playback must be verified before ONDA-14 can be marked complete. Do not implement the optional new-file Quick Play or automatic audio-cache cleanup based only on static checks.
