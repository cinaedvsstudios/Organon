from pathlib import Path

for path in (Path('tools/Onda/js/app-core.js'), Path('tools/Onda/js/00-app-core.js')):
    text = path.read_text(encoding='utf-8')
    old = "const btnNext = document.getElementById('btn-next');        const seekBar = document.getElementById('seek-bar');"
    if old not in text:
        raise RuntimeError(f'Expected transport declaration seam not found in {path}')
    text = text.replace(old, "const btnNext = document.getElementById('btn-next');\n        const seekBar = document.getElementById('seek-bar');", 1)

    old = 'if (speedReadout) speedReadout.innerText = val.toFixed(1) + "x";        });'
    if old not in text:
        raise RuntimeError(f'Expected speed-slider seam not found in {path}')
    text = text.replace(old, 'if (speedReadout) speedReadout.innerText = val.toFixed(1) + "x";\n        });', 1)
    path.write_text(text, encoding='utf-8')
