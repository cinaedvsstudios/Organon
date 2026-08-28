from pathlib import Path

APP = Path('tools/Onda/js/app-core.js')
CSS = Path('tools/Onda/css/responsive.css')
INDEX = Path('tools/Onda/index.html')

app = APP.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
index = INDEX.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


def function_bounds(text, name):
    marker = f'        function {name}('
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f'Function not found: {name}')
    brace = text.find('{', start)
    if brace < 0:
        raise SystemExit(f'Opening brace not found: {name}')

    depth = 0
    i = brace
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ''

        if line_comment:
            if ch == '\n':
                line_comment = False
            i += 1
            continue
        if block_comment:
            if ch == '*' and nxt == '/':
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch == '/' and nxt == '/':
            line_comment = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            block_comment = True
            i += 2
            continue
        if ch in ("'", '"', '`'):
            quote = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1

    raise SystemExit(f'Closing brace not found: {name}')


def replace_function(text, name, replacement):
    start, end = function_bounds(text, name)
    return text[:start] + replacement.rstrip() + text[end:]


# Version/cache bump for this coherent Phase 3 release.
app = replace_once(app, "        const ONDA_VERSION = 'v3.8';", "        const ONDA_VERSION = 'v3.9';", 'Onda version')
index = index.replace('?v=3.8', '?v=3.9')
if '?v=3.8' in index:
    raise SystemExit('Stale v3.8 cache reference remains in index.html')

# Add canonical marquee scope/state beside the existing responsive-mode constants.
app = replace_once(
    app,
    "        const mobileLayoutQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);",
    "        const mobileLayoutQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);\n        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');\n        const MOBILE_MARQUEE_GAP_PX = 32;\n        const MOBILE_MARQUEE_SELECTOR = [\n            '#history-list .library-track-title',\n            '#history-list .library-file-line',\n            '#history-card-grid .history-card-title',\n            '#history-card-grid .library-file-line',\n            '#db-library-results .library-track-title',\n            '#db-library-results .library-file-line',\n            '#db-recent-list .library-track-title',\n            '#db-recent-list .library-file-line',\n            '#playlist-detail-track-list .library-track-title',\n            '#playlist-detail-track-list .library-file-line',\n            '#playlist-edit-track-list .library-track-title',\n            '#playlist-edit-track-list .library-file-line',\n            '#now-playing-playlist-track-list .library-track-title',\n            '#now-playing-playlist-track-list .library-file-line'\n        ].join(', ');",
    'mobile marquee constants'
)

# Make filename metadata explicitly identifiable in every relevant rendered track context.
replacements = [
    (
        '<div class="history-card-meta">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>',
        '<div class="history-card-meta library-file-line">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>',
        'history card filename class'
    ),
    (
        '<div class="library-track-meta">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>',
        '<div class="library-track-meta library-file-line">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>',
        'history list filename class'
    ),
    (
        '<div class="library-track-meta">${escapeHtml(track?.fileName || \'Missing library record\')} · ${escapeHtml(track ? sourceStatus(track) : \'missing\')}</div>',
        '<div class="library-track-meta library-file-line">${escapeHtml(track?.fileName || \'Missing library record\')} · ${escapeHtml(track ? sourceStatus(track) : \'missing\')}</div>',
        'playlist detail filename class'
    ),
    (
        '<div class="library-track-meta">${escapeHtml(trackMeta.fileName || trackMeta.id)} · ${escapeHtml(sourceStatus(trackMeta))}</div>',
        '<div class="library-track-meta library-file-line">${escapeHtml(trackMeta.fileName || trackMeta.id)} · ${escapeHtml(sourceStatus(trackMeta))}</div>',
        'now playing queue filename class'
    ),
    (
        '<div class="library-track-meta">${escapeHtml(meta?.fileName || \'Missing library record\')} · ${escapeHtml(meta ? sourceStatus(meta) : \'missing\')}</div>',
        '<div class="library-track-meta library-file-line">${escapeHtml(meta?.fileName || \'Missing library record\')} · ${escapeHtml(meta ? sourceStatus(meta) : \'missing\')}</div>',
        'playlist editor filename class'
    )
]
for old, new, label in replacements:
    app = replace_once(app, old, new, label)

# Mobile Library is a fixed workspace now. Desktop persistence remains unchanged.
app = replace_function(app, 'syncMobileLibraryDrawerBounds', r'''        function syncMobileLibraryDrawerBounds() {
            if (!libraryDrawer) return;
            const savedHeight = getLibraryDrawerSavedHeight();

            if (!isMobileLayoutMode()) {
                document.documentElement.style.removeProperty('--mobile-library-drawer-top');
                document.documentElement.style.removeProperty('--mobile-library-drawer-bottom');
                const savedWidth = getLibraryDrawerSavedWidth();
                if (savedWidth) applyLibraryDrawerWidth(savedWidth, { persist: false });
                if (savedHeight) applyLibraryDrawerHeight(savedHeight, { persist: false });
                return;
            }

            libraryDrawer.classList.remove('drawer-custom-width');
            document.documentElement.style.removeProperty('--library-drawer-width');
            document.documentElement.style.setProperty('--mobile-library-drawer-top', '8px');
            document.documentElement.style.setProperty('--mobile-library-drawer-bottom', `${getLibraryDrawerBottomOffset()}px`);
        }''')

# Disable both mobile resize entry points at the actual source handlers.
start, end = function_bounds(app, 'startLibraryDrawerResize')
block = app[start:end]
block = replace_once(
    block,
    "        function startLibraryDrawerResize(e) {\n            if (!libraryDrawer || !libraryDrawer.classList.contains('drawer-open')) return;",
    "        function startLibraryDrawerResize(e) {\n            if (isMobileLayoutMode()) return;\n            if (!libraryDrawer || !libraryDrawer.classList.contains('drawer-open')) return;",
    'mobile vertical drawer resize guard'
)
app = app[:start] + block + app[end:]

start, end = function_bounds(app, 'startLibraryDrawerCornerResize')
block = app[start:end]
block = replace_once(
    block,
    "        function startLibraryDrawerCornerResize(e) {\n            if (!libraryDrawer || !libraryDrawer.classList.contains('drawer-open')) return;",
    "        function startLibraryDrawerCornerResize(e) {\n            if (isMobileLayoutMode()) return;\n            if (!libraryDrawer || !libraryDrawer.classList.contains('drawer-open')) return;",
    'mobile corner drawer resize guard'
)
app = app[:start] + block + app[end:]

# Do not reapply desktop saved height/width while opening the full-height mobile Library.
start, end = function_bounds(app, 'toggleLibraryDrawer')
block = app[start:end]
block = replace_once(
    block,
    "            if (shouldOpen) {\n                const savedHeight = getLibraryDrawerSavedHeight();\n                const savedWidth = getLibraryDrawerSavedWidth();\n                if (savedWidth) applyLibraryDrawerWidth(savedWidth, { persist: false });\n                if (savedHeight) applyLibraryDrawerHeight(savedHeight, { persist: false });",
    "            if (shouldOpen) {\n                if (!isMobileLayoutMode()) {\n                    const savedHeight = getLibraryDrawerSavedHeight();\n                    const savedWidth = getLibraryDrawerSavedWidth();\n                    if (savedWidth) applyLibraryDrawerWidth(savedWidth, { persist: false });\n                    if (savedHeight) applyLibraryDrawerHeight(savedHeight, { persist: false });\n                }",
    'mobile drawer open persistence guard'
)
app = app[:start] + block + app[end:]

# Replace the old current-track-only bounce marquee with one canonical mobile marquee system.
app = replace_function(app, 'prepareCurrentTrackMarqueeTitle', r'''        function prepareMobileMarqueeText(element) {
            if (!element) return;

            let track = element.querySelector(':scope > .onda-marquee-track');
            let sourceText = element.dataset.ondaMarqueeText || '';
            if (!track) {
                const liveText = (element.textContent || '').trim();
                if (liveText) sourceText = liveText;
            }
            if (!sourceText) return;

            element.dataset.ondaMarqueeText = sourceText;
            element.classList.remove('is-marquee-overflowing');
            element.style.removeProperty('--onda-marquee-distance');
            element.style.removeProperty('--onda-marquee-duration');
            element.style.setProperty('--onda-marquee-gap', `${MOBILE_MARQUEE_GAP_PX}px`);

            if (!isMobileLayoutMode() || reducedMotionQuery.matches || element.clientWidth <= 0) {
                if (track) element.textContent = sourceText;
                element.classList.toggle('onda-mobile-marquee', isMobileLayoutMode());
                return;
            }

            element.classList.add('onda-mobile-marquee');
            if (!track) {
                track = document.createElement('span');
                track.className = 'onda-marquee-track';
                const firstSegment = document.createElement('span');
                firstSegment.className = 'onda-marquee-segment';
                firstSegment.textContent = sourceText;
                track.appendChild(firstSegment);
                element.replaceChildren(track);
            }

            let firstSegment = track.querySelector(':scope > .onda-marquee-segment:not([data-marquee-copy])');
            if (!firstSegment) {
                firstSegment = document.createElement('span');
                firstSegment.className = 'onda-marquee-segment';
                track.prepend(firstSegment);
            }
            if (firstSegment.textContent !== sourceText) firstSegment.textContent = sourceText;

            const contentWidth = Math.ceil(firstSegment.getBoundingClientRect().width || firstSegment.scrollWidth || 0);
            const availableWidth = Math.floor(element.clientWidth);
            let gap = track.querySelector(':scope > .onda-marquee-gap');
            let copy = track.querySelector(':scope > .onda-marquee-segment[data-marquee-copy]');

            if (contentWidth <= availableWidth + 2) {
                if (gap) gap.remove();
                if (copy) copy.remove();
                return;
            }

            if (!gap) {
                gap = document.createElement('span');
                gap.className = 'onda-marquee-gap';
                gap.setAttribute('aria-hidden', 'true');
                track.appendChild(gap);
            }
            if (!copy) {
                copy = document.createElement('span');
                copy.className = 'onda-marquee-segment';
                copy.dataset.marqueeCopy = 'true';
                copy.setAttribute('aria-hidden', 'true');
                track.appendChild(copy);
            }
            if (copy.textContent !== sourceText) copy.textContent = sourceText;

            const characterCount = Math.max(1, Array.from(sourceText).length);
            const durationSeconds = Math.max(4, (characterCount + 6) / 3);
            element.style.setProperty('--onda-marquee-distance', `${contentWidth + MOBILE_MARQUEE_GAP_PX}px`);
            element.style.setProperty('--onda-marquee-duration', `${durationSeconds.toFixed(2)}s`);
            element.classList.add('is-marquee-overflowing');
        }''')

app = replace_function(app, 'refreshCurrentTrackMarquees', r'''        function refreshMobileMarquees() {
            document.querySelectorAll(MOBILE_MARQUEE_SELECTOR).forEach(prepareMobileMarqueeText);
        }''')

app = replace_function(app, 'scheduleCurrentTrackMarqueeRefresh', r'''        function scheduleMobileMarqueeRefresh() {
            if (marqueeFrame) cancelAnimationFrame(marqueeFrame);
            marqueeFrame = requestAnimationFrame(() => {
                marqueeFrame = 0;
                refreshMobileMarquees();
            });
        }''')

app = replace_function(app, 'installCurrentTrackMarqueeObserver', r'''        function installMobileMarqueeObserver() {
            const observer = new MutationObserver(scheduleMobileMarqueeRefresh);
            observer.observe(document.body, { childList: true, subtree: true });

            window.addEventListener('resize', () => {
                window.clearTimeout(marqueeResizeTimer);
                marqueeResizeTimer = window.setTimeout(scheduleMobileMarqueeRefresh, 120);
            });
            window.addEventListener('orientationchange', () => {
                window.setTimeout(scheduleMobileMarqueeRefresh, 180);
            });
            if (typeof reducedMotionQuery.addEventListener === 'function') {
                reducedMotionQuery.addEventListener('change', scheduleMobileMarqueeRefresh);
            }
            if (document.fonts?.ready) document.fonts.ready.then(scheduleMobileMarqueeRefresh).catch(() => {});
            scheduleMobileMarqueeRefresh();
        }''')

# Update references to the renamed canonical marquee functions.
for old, new in [
    ('prepareCurrentTrackMarqueeTitle', 'prepareMobileMarqueeText'),
    ('refreshCurrentTrackMarquees', 'refreshMobileMarquees'),
    ('scheduleCurrentTrackMarqueeRefresh', 'scheduleMobileMarqueeRefresh'),
    ('installCurrentTrackMarqueeObserver', 'installMobileMarqueeObserver')
]:
    app = app.replace(old, new)

# -------- Canonical responsive.css edits --------
css = replace_once(
    css,
    "  #library-manager-drawer {\n    bottom: 62px;\n    height: auto;\n    left: 15px;\n    max-height: none;\n    right: 15px;\n    top: var(--mobile-library-drawer-top, 178px);\n  }",
    "  body.onda-force-mobile-mode #library-manager-drawer {\n    bottom: var(--mobile-library-drawer-bottom, 62px);\n    height: auto;\n    left: 8px;\n    max-height: none;\n    right: 8px;\n    top: max(var(--mobile-library-drawer-top, 8px), env(safe-area-inset-top, 0px));\n  }",
    'mobile full-height drawer rule'
)
css = replace_once(css, "    padding: 10px 12px 8px;", "    padding: 7px 9px 6px;", 'mobile Library header padding')
css = replace_once(
    css,
    "  .library-manager-toolbar {\n    gap: 7px;\n    grid-template-columns: minmax(0,1fr) auto auto minmax(112px,.58fr);\n    padding: 10px 12px;\n  }",
    "  .library-manager-toolbar {\n    gap: 5px;\n    grid-template-columns: minmax(0,1fr) auto auto minmax(112px,.58fr);\n    padding: 7px 9px;\n  }",
    'mobile Library toolbar spacing'
)
css = replace_once(
    css,
    "  .library-drawer-resize-handle {\n    height: 22px;\n    top: 7px;\n    width: 30px;\n  }",
    "  body.onda-force-mobile-mode .library-drawer-resize-handle {\n    display: none;\n  }",
    'hide mobile Library resize handles'
)
css = replace_once(
    css,
    "  .library-playlist-strip-grid {\n    grid-template-columns: 1fr;\n  }",
    "  body.onda-force-mobile-mode .library-playlist-strip-grid {\n    -webkit-overflow-scrolling: touch;\n    display: flex;\n    flex-wrap: nowrap;\n    gap: 7px;\n    overflow-x: auto;\n    overflow-y: hidden;\n    scroll-snap-type: x proximity;\n    scrollbar-width: none;\n  }\n\n  body.onda-force-mobile-mode .library-playlist-strip-grid::-webkit-scrollbar {\n    display: none;\n  }\n\n  body.onda-force-mobile-mode .library-playlist-shortcut {\n    flex: 0 0 77%;\n    min-width: 0;\n    padding: 7px;\n    scroll-snap-align: start;\n  }",
    'horizontal mobile playlist strip'
)
css = replace_once(css, "  min-height: 72px;\n  overflow: hidden;\n  padding: 9px 8px;", "  min-height: 64px;\n  overflow: hidden;\n  padding: 6px 8px;", 'tighter mobile History rows')

css = replace_once(
    css,
    "  body.onda-force-mobile-mode #library-manager-drawer .library-manager-content {\n    display: flex;\n    flex-direction: column;\n    gap: 0;\n  }",
    "  body.onda-force-mobile-mode #library-manager-drawer .library-manager-content {\n    display: flex;\n    flex-direction: column;\n    gap: 0;\n    padding: 7px 8px 9px;\n  }",
    'mobile Library content padding'
)
css = replace_once(css, "    padding: 0 12px 8px;", "    padding: 0 7px 5px;", 'mobile Library action panel spacing')
css = replace_once(css, "    gap: 8px;\n    overflow-x: auto;\n    overflow-y: hidden;\n    padding: 3px 0 9px;", "    gap: 6px;\n    overflow-x: auto;\n    overflow-y: hidden;\n    padding: 2px 0 5px;", 'mobile Library action strip spacing')
css = replace_once(
    css,
    "  body.onda-force-mobile-mode #library-manager-drawer .library-results-panel {\n    order: 1;\n  }",
    "  body.onda-force-mobile-mode #library-manager-drawer .library-results-panel {\n    order: 1;\n    padding: 6px 7px;\n  }\n\n  body.onda-force-mobile-mode #library-manager-drawer .library-playlist-strip {\n    margin-bottom: 7px;\n    padding: 6px;\n  }\n\n  body.onda-force-mobile-mode #library-manager-drawer .library-playlist-strip-title,\n  body.onda-force-mobile-mode #library-manager-drawer .library-section-label {\n    margin-bottom: 4px;\n  }\n\n  body.onda-force-mobile-mode #library-manager-drawer #db-library-results .library-result-row,\n  body.onda-force-mobile-mode #library-manager-drawer #db-recent-list .library-mini-row {\n    margin-bottom: 6px;\n    padding: 6px 8px;\n  }\n\n  body.onda-force-mobile-mode .playlist-detail-track-row,\n  body.onda-force-mobile-mode .now-playing-queue-row {\n    margin-bottom: 6px;\n    padding: 6px 8px;\n  }",
    'mobile Library/results spacing'
)

# Replace the old bounce/current-track CSS with the canonical continuous mobile marquee.
old_marquee_start = css.find('/* Current-track marquee is a canonical responsive behavior.')
if old_marquee_start < 0:
    raise SystemExit('Old marquee CSS section not found')
css = css[:old_marquee_start].rstrip() + r'''

/* Automatic mobile scrolling for overflowing track titles and file names. */
@keyframes onda-mobile-marquee-loop {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(calc(-1 * var(--onda-marquee-distance)), 0, 0);
  }
}

body.onda-force-mobile-mode .onda-mobile-marquee {
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: normal;
  text-overflow: clip;
  white-space: nowrap;
}

body.onda-force-mobile-mode .onda-mobile-marquee .onda-marquee-track {
  align-items: baseline;
  display: inline-flex;
  min-width: max-content;
  transform: translate3d(0, 0, 0);
  white-space: nowrap;
  will-change: transform;
}

body.onda-force-mobile-mode .onda-mobile-marquee .onda-marquee-segment {
  flex: 0 0 auto;
  white-space: nowrap;
}

body.onda-force-mobile-mode .onda-mobile-marquee .onda-marquee-gap {
  display: inline-block;
  flex: 0 0 var(--onda-marquee-gap, 32px);
  width: var(--onda-marquee-gap, 32px);
}

body.onda-force-mobile-mode .onda-mobile-marquee.is-marquee-overflowing .onda-marquee-track {
  animation: onda-mobile-marquee-loop var(--onda-marquee-duration, 10s) linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  body.onda-force-mobile-mode .onda-mobile-marquee {
    text-overflow: ellipsis;
  }

  body.onda-force-mobile-mode .onda-mobile-marquee .onda-marquee-track {
    animation: none;
    transform: none;
  }
}
'''

# Guardrail: Phase 3 must not modify the player-control sizing/layout rules.
for forbidden in [
    'onda-v3-5',
    'final-ui-fixes',
    'layout-enhancements.js',
    'stopImmediatePropagation()'
]:
    if forbidden in app or forbidden in index:
        raise SystemExit(f'Forbidden correction-layer reference remains: {forbidden}')

# Required Phase Implementation Verification List anchors.
required_app = [
    'function handleTrackEnded',
    'function setRepeatMode',
    'function setShuffleEnabled',
    'function scrollCurrentTrackRowsIntoView',
    'function triggerMetaEdit',
    'function setSettingsTab',
    'function toggleDesktopMode',
    'function toggleFullscreenMode',
    'function prepareMobileMarqueeText',
    'function syncMobileLibraryDrawerBounds',
    'MOBILE_MARQUEE_SELECTOR'
]
for token in required_app:
    if token not in app:
        raise SystemExit(f'Phase Implementation Verification anchor missing: {token}')

required_css = [
    'onda-mobile-marquee-loop',
    'flex: 0 0 77%',
    'min-height: 64px',
    'body.onda-force-mobile-mode #library-manager-drawer',
    'display: none;\n  }\n\n  .library-drawer-resize-handle.left'
]
for token in required_css:
    if token not in css:
        raise SystemExit(f'Phase 3 CSS verification anchor missing: {token}')

APP.write_text(app, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
INDEX.write_text(index, encoding='utf-8')
print('Phase 3 canonical source migration complete.')
