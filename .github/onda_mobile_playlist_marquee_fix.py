from pathlib import Path

app = Path('tools/Onda/js/app-core.js')
css = Path('tools/Onda/css/responsive.css')
index = Path('tools/Onda/index.html')

app_text = app.read_text()
css_text = css.read_text()
index_text = index.read_text()

if "const ONDA_VERSION = 'v3.9';" not in app_text:
    raise SystemExit('Expected Onda v3.9 marker not found')
app_text = app_text.replace("const ONDA_VERSION = 'v3.9';", "const ONDA_VERSION = 'v3.10';", 1)

start = app_text.find('        function prepareMobileMarqueeText(element) {')
end = app_text.find('        function announceOndaVersion() {', start)
if start == -1 or end == -1:
    raise SystemExit('Marquee function block not found')

new_block = r'''        function clearMobileMarqueeState(element, { keepMobileClass = false } = {}) {
            if (!element) return;
            const track = element.querySelector(':scope > .onda-marquee-track');
            const sourceText = element.dataset.ondaMarqueeText || (track?.querySelector(':scope > .onda-marquee-segment:not([data-marquee-copy])')?.textContent || element.textContent || '').trim();
            if (track && sourceText) element.textContent = sourceText;
            element.classList.remove('is-marquee-overflowing');
            if (!keepMobileClass) element.classList.remove('onda-mobile-marquee');
            element.style.removeProperty('--onda-marquee-distance');
            element.style.removeProperty('--onda-marquee-duration');
            element.style.removeProperty('--onda-marquee-gap');
            delete element.dataset.ondaMarqueeSignature;
        }

        function prepareMobileMarqueeText(element) {
            if (!element) return;

            let track = element.querySelector(':scope > .onda-marquee-track');
            let sourceText = element.dataset.ondaMarqueeText || '';
            if (!sourceText) {
                sourceText = (track?.querySelector(':scope > .onda-marquee-segment:not([data-marquee-copy])')?.textContent || element.textContent || '').trim();
            }
            if (!sourceText) return;

            element.dataset.ondaMarqueeText = sourceText;
            const mobileMode = isMobileLayoutMode();
            element.classList.toggle('onda-mobile-marquee', mobileMode);

            if (!mobileMode) {
                clearMobileMarqueeState(element);
                return;
            }

            if (reducedMotionQuery.matches || element.clientWidth <= 0) {
                clearMobileMarqueeState(element, { keepMobileClass: true });
                element.classList.add('onda-mobile-marquee');
                element.dataset.ondaMarqueeText = sourceText;
                return;
            }

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
                element.classList.remove('is-marquee-overflowing');
                element.style.removeProperty('--onda-marquee-distance');
                element.style.removeProperty('--onda-marquee-duration');
                element.style.setProperty('--onda-marquee-gap', `${MOBILE_MARQUEE_GAP_PX}px`);
                element.dataset.ondaMarqueeSignature = `static:${sourceText}:${availableWidth}:${contentWidth}`;
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
            const marqueeDistance = contentWidth + MOBILE_MARQUEE_GAP_PX;
            const signature = `scroll:${sourceText}:${availableWidth}:${contentWidth}:${marqueeDistance}:${durationSeconds.toFixed(2)}`;

            if (element.dataset.ondaMarqueeSignature === signature && element.classList.contains('is-marquee-overflowing')) {
                return;
            }

            element.style.setProperty('--onda-marquee-gap', `${MOBILE_MARQUEE_GAP_PX}px`);
            element.style.setProperty('--onda-marquee-distance', `${marqueeDistance}px`);
            element.style.setProperty('--onda-marquee-duration', `${durationSeconds.toFixed(2)}s`);
            element.dataset.ondaMarqueeSignature = signature;
            element.classList.add('is-marquee-overflowing');
        }

        function refreshMobileMarquees() {
            document.querySelectorAll(MOBILE_MARQUEE_SELECTOR).forEach(prepareMobileMarqueeText);
        }

        function scheduleMobileMarqueeRefresh() {
            if (marqueeFrame) cancelAnimationFrame(marqueeFrame);
            marqueeFrame = requestAnimationFrame(() => {
                marqueeFrame = 0;
                refreshMobileMarquees();
            });
        }

        function installMobileMarqueeObserver() {
            const marqueeRoots = [
                '#history-list',
                '#history-card-grid',
                '#db-library-results',
                '#db-recent-list',
                '#playlist-detail-panel',
                '#playlist-edit-track-list',
                '#now-playing-playlist-panel'
            ].map(selector => document.querySelector(selector)).filter(Boolean);

            const observer = new MutationObserver((mutations) => {
                const hasRelevantMutation = mutations.some((mutation) => {
                    const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
                    return target && !target.closest('.onda-mobile-marquee');
                });
                if (hasRelevantMutation) scheduleMobileMarqueeRefresh();
            });

            marqueeRoots.forEach(root => observer.observe(root, { childList: true, subtree: true }));

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
        }

'''
app_text = app_text[:start] + new_block + app_text[end:]

anchor = '/* Automatic mobile scrolling for overflowing track titles and file names. */'
if anchor not in css_text:
    raise SystemExit('Responsive marquee anchor not found')

playlist_css = r'''/* Mobile Playlist Management uses the same horizontal-card pattern as the Library playlist strip. */
@media (max-width: 768px) {
  body.onda-force-mobile-mode #tab-playlists > .help-text {
    display: none;
  }

  body.onda-force-mobile-mode #playlists-explorer-group {
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 10px;
    margin-top: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0 6px;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }

  body.onda-force-mobile-mode #playlists-explorer-group::-webkit-scrollbar {
    display: none;
  }

  body.onda-force-mobile-mode #playlists-explorer-group > .playlist-row {
    flex: 0 0 70%;
    margin-bottom: 0;
    min-width: 0;
    scroll-snap-align: start;
  }
}

'''
css_text = css_text.replace(anchor, playlist_css + anchor, 1)

if '?v=3.9' not in index_text:
    raise SystemExit('Expected v3.9 cache markers not found in index.html')
index_text = index_text.replace('?v=3.9', '?v=3.10')

app.write_text(app_text)
css.write_text(css_text)
index.write_text(index_text)
