from pathlib import Path

path = Path('.github/onda-phase2-migrate.py')
text = path.read_text(encoding='utf-8')
needle = '"        window.addEventListener(\'resize\', () => {\\n"'
replacement = '"        window.addEventListener(\'resize\', () => {\\n            saveLocalUiStateCheckpoint(\'screen-resize\');\\n"'
count = text.count(needle)
if count != 2:
    raise SystemExit(f'Expected 2 resize selector literals in migration helper, found {count}')
path.write_text(text.replace(needle, replacement), encoding='utf-8')
print('Migration helper match scope corrected.')
