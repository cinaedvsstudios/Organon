(function () {
    'use strict';

    const fallbackBlocks = [
        {
            id: 'html-section-card',
            name: 'HTML section card',
            description: 'Simple semantic section card.',
            content: '<section class="card">\n    <h2>Section title</h2>\n    <p>Section text goes here.</p>\n</section>'
        },
        {
            id: 'button-row',
            name: 'Button row',
            description: 'Small row of linked buttons.',
            content: '<div class="button-row">\n    <a href="#" class="btn">Primary</a>\n    <a href="#" class="btn secondary">Secondary</a>\n</div>'
        },
        {
            id: 'image-block',
            name: 'Image block',
            description: 'Figure with image and caption.',
            content: '<figure>\n    <img src="images/example.jpg" alt="Describe image here">\n    <figcaption>Caption text</figcaption>\n</figure>'
        }
    ];

    const fallbackSample = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Organon Editor Page</title>
    <style>
        body {
            margin: 0;
            font-family: Inter, system-ui, sans-serif;
            background: #181919;
            color: #f5f0db;
        }
        header {
            padding: 32px;
            background: #292a24;
            border-bottom: 2px solid #896b49;
        }
        h1 {
            color: #e0a360;
            margin: 0 0 8px;
        }
        main {
            padding: 28px;
            display: grid;
            gap: 18px;
        }
        .card {
            border: 1px solid #896b49;
            border-radius: 18px;
            padding: 18px;
            background: #292a24;
        }
        .button-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .btn {
            display: inline-block;
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid #896b49;
            background: #26615c;
            color: #ffffff;
            text-decoration: none;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #896b49;
            padding: 8px;
        }
        hr {
            border: none;
            border-top: 1px solid #896b49;
        }
    </style>
</head>
<body>
    <!-- HEADER -->
    <header>
        <h1>Sample Page for Code Writer</h1>
        <p>Edit this text in Raw View or turn on Visual Edit in the Preview.</p>
    </header>

    <main>
        <!-- CARD GRID -->
        <section class="card">
            <h2>Testing Area</h2>
            <p>This page deliberately includes a title tag, cards, a table, an image tag, an hr tag, comments, CSS, and buttons so the first markers can be checked.</p>
            <div class="button-row">
                <a href="#one" class="btn">First Button</a>
                <a href="#two" class="btn">Second Button</a>
            </div>
        </section>

        <section class="card">
            <h2>Image Reference</h2>
            <img src="../../images/logoemoji.png" alt="Organon logo placeholder" width="160">
            <p>The image may only appear when that asset exists in your uploaded Organon folder.</p>
        </section>

        <section class="card">
            <h2>Table Reference</h2>
            <table>
                <thead>
                    <tr><th>Feature</th><th>Status</th></tr>
                </thead>
                <tbody>
                    <tr><td>Raw View</td><td>Editable</td></tr>
                    <tr><td>Preview</td><td>Live</td></tr>
                </tbody>
            </table>
        </section>

        <hr>

        <section class="card">
            <h2>Intentional Duplicate ID Test</h2>
            <p id="duplicate-test">First duplicate ID line.</p>
            <p id="duplicate-test">Second duplicate ID line for Check Code.</p>
        </section>
    </main>

    <script>
        console.log('Sample script marker. Scripts are not executed in the sandboxed preview.');
    </script>
</body>
</html>`;

    async function loadDefaultBuildingBlocks() {
        try {
            const response = await fetch('data/building-blocks.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blocks = await response.json();
            window.CodeWriterState.buildingBlocks = Array.isArray(blocks) ? blocks : fallbackBlocks;
        } catch (error) {
            console.warn('Default building-block JSON could not be loaded. Using fallback blocks.', error);
            window.CodeWriterState.buildingBlocks = fallbackBlocks;
        }
        window.CodeWriterUI.renderBuildingBlocks();
    }

    async function loadSample() {
        let html = fallbackSample;
        try {
            const response = await fetch('samples/sample-page.html', { cache: 'no-store' });
            if (response.ok) {
                html = await response.text();
            }
        } catch (error) {
            console.warn('Sample file fetch failed. Using embedded fallback sample.', error);
        }
        const tab = window.CodeWriterStore.addTab({
            filename: 'sample-page.html',
            nickname: 'Sample',
            content: html,
            originalContent: html
        });
        window.CodeWriterEditor.loadActiveTabIntoEditor({ preserveCursor: false });
        window.CodeWriterUI.updateEverything();
        window.CodeWriterUI.toast(`Loaded ${tab.filename}.`);
    }

    async function openLocalFile() {
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [
                        {
                            description: 'Code and text files',
                            accept: {
                                'text/html': ['.html', '.htm'],
                                'text/plain': ['.txt', '.css', '.js', '.json', '.csv']
                            }
                        }
                    ]
                });
                const file = await handle.getFile();
                const content = await file.text();
                const tab = window.CodeWriterStore.addTab({
                    filename: file.name,
                    content,
                    originalContent: content
                });
                tab.fileHandle = handle;
                tab.sourceWritable = true;
                window.CodeWriterEditor.loadActiveTabIntoEditor({ preserveCursor: false });
                window.CodeWriterUI.updateEverything();
                window.CodeWriterUI.toast(`Opened ${file.name}.`);
                return;
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                console.warn('File System Access open failed, falling back to file input:', error);
            }
        }

        const input = document.getElementById('file-input');
        if (input) input.click();
    }

    function handleClassicFileInput(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const content = String(reader.result || '');
            window.CodeWriterStore.addTab({
                filename: file.name,
                content,
                originalContent: content
            });
            window.CodeWriterEditor.loadActiveTabIntoEditor({ preserveCursor: false });
            window.CodeWriterUI.updateEverything();
            window.CodeWriterUI.toast(`Opened ${file.name}.`);
            event.target.value = '';
        };
        reader.onerror = () => {
            window.CodeWriterUI.toast('Could not read the selected file.');
        };
        reader.readAsText(file);
    }

    async function saveToSourceOrExport() {
        const tab = window.CodeWriterStore.getActiveTab();
        if (!tab) return;

        if (tab.fileHandle && 'createWritable' in tab.fileHandle) {
            try {
                const writable = await tab.fileHandle.createWritable();
                await writable.write(tab.content);
                await writable.close();
                tab.originalContent = tab.content;
                tab.lastSavedAt = Date.now();
                window.CodeWriterStore.saveLocalState();
                window.CodeWriterUI.updateEverything();
                window.CodeWriterUI.toast(`Saved over ${tab.filename}.`);
                return;
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                console.warn('Source File Save failed. Export fallback will run.', error);
                window.CodeWriterUI.toast('Source save unavailable. Exporting a download instead.');
            }
        }

        exportActiveHtml();
    }

    function exportActiveHtml() {
        const tab = window.CodeWriterStore.getActiveTab();
        if (!tab) return;
        const safeName = (tab.filename || 'code-writer-export.html').replace(/[\\/:*?"<>|]+/g, '-');
        const blob = new Blob([tab.content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeName || 'code-writer-export.html';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        tab.originalContent = tab.content;
        tab.lastSavedAt = Date.now();
        window.CodeWriterStore.saveLocalState();
        window.CodeWriterUI.updateEverything();
        window.CodeWriterUI.toast(`Exported ${safeName}.`);
    }

    async function copyActiveHtml() {
        const tab = window.CodeWriterStore.getActiveTab();
        if (!tab) return;
        try {
            await navigator.clipboard.writeText(tab.content);
            window.CodeWriterUI.toast('Current HTML copied to clipboard.');
        } catch (error) {
            const temp = document.createElement('textarea');
            temp.value = tab.content;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            temp.remove();
            window.CodeWriterUI.toast('Current HTML copied to clipboard.');
        }
    }

    window.CodeWriterFiles = {
        fallbackSample,
        loadDefaultBuildingBlocks,
        loadSample,
        openLocalFile,
        handleClassicFileInput,
        saveToSourceOrExport,
        exportActiveHtml,
        copyActiveHtml
    };
})();
