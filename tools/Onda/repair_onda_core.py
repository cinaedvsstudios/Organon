from pathlib import Path
import re

ROOT = Path('tools/Onda')


def remove_once(text, pattern, label, flags=0):
    updated, count = re.subn(pattern, '', text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return updated


def function_bounds(text, signature):
    start = text.find(signature)
    if start < 0:
        raise RuntimeError(f'Missing {signature}')
    brace = text.find('{', start)
    depth = 0
    in_single = in_double = in_template = False
    escaped = False
    for index in range(brace, len(text)):
        char = text[index]
        if escaped:
            escaped = False
        elif char == '\\':
            escaped = True
        elif in_single:
            if char == "'":
                in_single = False
        elif in_double:
            if char == '"':
                in_double = False
        elif in_template:
            if char == '`':
                in_template = False
        else:
            if char == "'":
                in_single = True
            elif char == '"':
                in_double = True
            elif char == '`':
                in_template = True
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return start, index + 1
    raise RuntimeError(f'Unclosed function {signature}')


def replace_function(text, signature, replacement):
    start, end = function_bounds(text, signature)
    return text[:start] + replacement + text[end:]


def remove_css_rule_containing(text, token):
    match = re.search(r'\n[^{}]*' + re.escape(token) + r'[^{}]*\{[^{}]*\}\n', text, flags=re.S)
    if not match:
        raise RuntimeError(f'CSS rule containing {token} was not found')
    return text[:match.start()] + '\n' + text[match.end():]


index_path = ROOT / 'index.html'
index = index_path.read_text(encoding='utf-8')
index = remove_once(
    index,
    r'\n\s*<button class="utility-btn speed-glyph" data-tooltip="Cycle Speed" id="btn-speed-cycle">🚀</button>',
    'speed button markup',
)
index_path.write_text(index, encoding='utf-8')

for core_path in (ROOT / 'js' / 'app-core.js', ROOT / 'js' / '00-app-core.js'):
    text = core_path.read_text(encoding='utf-8')

    text = remove_once(
        text,
        r'\n\s*// Custom Play Speed cycles[^\n]*\n\s*const speedCycles = \[[^\]]*\];\n\s*let currentSpeedIdx = 0;\n',
        f'{core_path.name} speed-cycle state',
    )
    text = remove_once(
        text,
        r'\n\s*const btnSpeedCycle = document\.getElementById\(\'btn-speed-cycle\'\);\n',
        f'{core_path.name} speed button reference',
    )
    text = remove_once(
        text,
        r'\n\s*btnSpeedCycle\.addEventListener\(\'click\', \(\) => \{.*?\n\s*\}\);\n',
        f'{core_path.name} speed listener',
        flags=re.S,
    )
    text = remove_once(
        text,
        r'\n\s*if \(btnSpeedCycle\) btnSpeedCycle\.innerText = `🚀\$\{val\.toFixed\(1\)\.replace\(\'\.0\', \'\'\)\}`;\n',
        f'{core_path.name} speed-slider rewrite',
    )

    select_function = '''function toggleLibrarySelectMode(force = null) {
            const next = typeof force === 'boolean' ? force : !isLibrarySelectMode;
            isLibrarySelectMode = next;
            if (!next) selectedLibraryIds.clear();
            setLibraryActionPanel('select');
            updateBulkActionUI();
            renderLibraryManager();
        }'''
    text = replace_function(text, 'function toggleLibrarySelectMode(force = null)', select_function)

    text = text.replace(
        '        let currentFile = null;\n',
        '        let currentFile = null;\n        let trackLoadRequestId = 0;\n',
        1,
    )

    load_start, load_end = function_bounds(text, 'async function loadTrack(file)')
    load_body = text[load_start:load_end]
    load_body, count = re.subn(
        r'(async function loadTrack\(file\)\s*\{\n)(\s*)currentFile = file;',
        r"\1\2const requestId = ++trackLoadRequestId;\n\2currentFile = file;\n\2if (localAudio.src && localAudio.src.startsWith('blob:')) URL.revokeObjectURL(localAudio.src);\n\2localAudio.removeAttribute('src');",
        load_body,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f'{core_path.name} loadTrack initialisation not found')

    guarded = []
    for line in load_body.splitlines(True):
        guarded.append(line)
        if 'await ' in line and 'requestId !== trackLoadRequestId' not in line:
            indent = re.match(r'\s*', line).group(0)
            guarded.append(f'{indent}if (requestId !== trackLoadRequestId) return;\n')
    text = text[:load_start] + ''.join(guarded) + text[load_end:]

    old_edit_markup = '''<div class="library-row-main">
                        <div class="library-row-main playlist-edit-row-main">'''
    if old_edit_markup in text:
        text = text.replace(old_edit_markup, '<div class="library-row-main playlist-edit-row-main">', 1)
        text = text.replace('''                        </div>
                        <div class="library-row-buttons">''', '''                        <div class="library-row-buttons">''', 1)
        text = text.replace('''                        </div>
                    </div>`;''', '''                        </div>`;''', 1)

    text, inline_count = re.subn(
        r'\s+onclick="openPlaylistEditModal\([^\"]*\)"',
        ' data-onda-edit-playlist="active"',
        text,
    )
    if inline_count:
        insert_at = text.find('        // --- 8. DIRECT INLINE DISPLAY NAME TYPE-OVER')
        if insert_at < 0:
            raise RuntimeError(f'{core_path.name} inline playlist listener insertion point missing')
        listener = '''        document.addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-onda-edit-playlist="active"]');
            if (!editButton) return;
            event.preventDefault();
            if (activePlaylistView) openPlaylistEditModal(activePlaylistView);
        });

'''
        text = text[:insert_at] + listener + text[insert_at:]

    core_path.write_text(text, encoding='utf-8')

css_path = ROOT / 'css' / 'responsive.css'
css = css_path.read_text(encoding='utf-8')
for selector in (
    'btn-play-playlist::after',
    'btn-shuffle-playlist::after',
    'btn-edit-playlist::after',
    'btn-onda-row-play::before',
    'btn-history-info::before',
    'btn-onda-add-playlist::before',
):
    css = remove_css_rule_containing(css, selector)
css = css.replace('font-size: 0;\n    height: 42px;', 'font-size: 1.08rem;\n    height: 42px;', 1)
css = css.replace('font-size: 0;\n  height: 34px;', 'font-size: 1.05rem;\n  height: 34px;', 1)
css_path.write_text(css, encoding='utf-8')

controls_path = ROOT / 'css' / 'controls.css'
controls = controls_path.read_text(encoding='utf-8')
controls = re.sub(
    r'\n/\* Playback-speed cycling is intentionally removed from the UI\. The normal speed slider remains in Settings\. \*/\n#btn-speed-cycle \{\n  display: none;\n\}\n',
    '\n',
    controls,
    count=1,
)
controls_path.write_text(controls, encoding='utf-8')

layout_path = ROOT / 'js' / 'layout-enhancements.js'
layout = layout_path.read_text(encoding='utf-8')
layout = layout.replace("        // The speed feature remains available through the Settings speed slider only.\n        document.getElementById('btn-speed-cycle')?.remove();\n\n", '')
layout_path.write_text(layout, encoding='utf-8')
