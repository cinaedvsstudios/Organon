from pathlib import Path

ROOT = Path('tools/Onda')

for core_path in (ROOT / 'js' / 'app-core.js', ROOT / 'js' / '00-app-core.js'):
    text = core_path.read_text(encoding='utf-8')
    old = '                speedCycleIndex: currentSpeedIdx || 0,\n'
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{core_path}: expected one obsolete speedCycleIndex export, found {count}')
    core_path.write_text(text.replace(old, '', 1), encoding='utf-8')

css_path = ROOT / 'css' / 'responsive.css'
css = css_path.read_text(encoding='utf-8')
marker = '/* Mobile repair 2026-07-02: canonical responsive player, playlist rows, and Library action buttons. */'
if marker in css:
    raise RuntimeError('Mobile UI repair block already exists')

css += '''\n\n/* Mobile repair 2026-07-02: canonical responsive player, playlist rows, and Library action buttons. */\n@media (max-width: 768px) {\n  /* layout-enhancements.js applies .onda-force-mobile-mode on natural phone widths. */\n  body.onda-force-mobile-mode .playlist-row {\n    align-items: center;\n    gap: 10px;\n    padding: 10px 12px;\n  }\n\n  body.onda-force-mobile-mode .playlist-row-content {\n    flex: 1 1 auto;\n    min-width: 0;\n  }\n\n  body.onda-force-mobile-mode .playlist-row-content > div:last-child {\n    flex: 1 1 auto;\n    min-width: 0;\n  }\n\n  body.onda-force-mobile-mode .playlist-row-title {\n    overflow-wrap: normal;\n    white-space: normal;\n    word-break: normal;\n  }\n\n  body.onda-force-mobile-mode .playlist-row-count {\n    white-space: nowrap;\n  }\n\n  /* Library result buttons use their real single icon content, at a usable touch size. */\n  body.onda-force-mobile-mode #db-library-results .library-row-buttons {\n    gap: 10px;\n  }\n\n  body.onda-force-mobile-mode #db-library-results .library-row-buttons .btn-pill {\n    align-items: center;\n    color: var(--water-spray);\n    display: inline-flex;\n    flex: 0 0 44px;\n    font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif;\n    font-size: 1.3rem;\n    font-variant-emoji: emoji;\n    height: 44px;\n    justify-content: center;\n    line-height: 1;\n    min-height: 44px;\n    min-width: 44px;\n    padding: 0;\n    text-indent: 0;\n    width: 44px;\n  }\n\n  body.onda-force-mobile-mode #db-library-results .library-row-buttons .btn-pill::before,\n  body.onda-force-mobile-mode #db-library-results .library-row-buttons .btn-pill::after {\n    content: none;\n    display: none;\n  }\n\n  /* Playlist header controls also use their real, single icon content. */\n  body.onda-force-mobile-mode .playlist-detail-header .playlist-row-tools .btn-pill {\n    color: var(--water-spray);\n    font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif;\n    font-size: 1.18rem;\n    font-variant-emoji: emoji;\n  }\n\n  body.onda-force-mobile-mode .playlist-detail-header .playlist-row-tools .btn-pill::before,\n  body.onda-force-mobile-mode .playlist-detail-header .playlist-row-tools .btn-pill::after {\n    content: none;\n    display: none;\n  }\n}\n'''
css_path.write_text(css, encoding='utf-8')
