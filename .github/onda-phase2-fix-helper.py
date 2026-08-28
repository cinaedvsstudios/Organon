from pathlib import Path

path = Path('.github/onda-phase2-migrate.py')
text = path.read_text(encoding='utf-8')
old_target = '    "        window.addEventListener(\'resize\', () => {\\n",\n'
new_target = '    "        window.addEventListener(\'resize\', () => {\\n            saveLocalUiStateCheckpoint(\'screen-resize\');\\n",\n'
old_replacement_tail = '        window.addEventListener(\'resize\', () => {\\n",\n    \'layout event listeners and API\'\n)'
new_replacement_tail = '        window.addEventListener(\'resize\', () => {\\n            saveLocalUiStateCheckpoint(\'screen-resize\');\\n",\n    \'layout event listeners and API\'\n)'
if text.count(old_target) != 1:
    raise SystemExit(f'Expected one resize target literal, found {text.count(old_target)}')
if text.count(old_replacement_tail) != 1:
    raise SystemExit(f'Expected one resize replacement tail, found {text.count(old_replacement_tail)}')
text = text.replace(old_target, new_target, 1)
text = text.replace(old_replacement_tail, new_replacement_tail, 1)
path.write_text(text, encoding='utf-8')
print('Migration helper resize match corrected.')
