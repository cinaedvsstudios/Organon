"use strict";

(async () => {
    const response = await fetch("./index.html?source=alpha-preservation-drive-save-20260727", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load Bulk Convert source (${response.status}).`);

    let html = await response.text();

    const replacements = [
        {
            label: "format change handler",
            oldText: `        // Toggle Quality Slider based on format
        outputFormatSel.addEventListener('change', (e) => {
            if (e.target.value === 'image/png') {
                qualityContainer.style.visibility = 'hidden';
            } else {
                qualityContainer.style.visibility = 'visible';
            }
        });`,
            newText: `        function syncBackgroundControlsForFormat() {
            const jpegOutput = outputFormatSel.value === 'image/jpeg';
            filesData.forEach((fileItem) => {
                const transparencyCapable = /\\.(png|gif|webp|svg)$/i.test(fileItem.originalName);
                if (jpegOutput && transparencyCapable) {
                    fileItem.bgFillColor = fileItem.bgFillColor || '#FFFFFF';
                } else if (!jpegOutput) {
                    fileItem.bgFillColor = null;
                }
            });
            renderFileList();
        }

        // Toggle Quality Slider and JPEG background controls based on format
        outputFormatSel.addEventListener('change', (e) => {
            if (e.target.value === 'image/png') {
                qualityContainer.style.visibility = 'hidden';
            } else {
                qualityContainer.style.visibility = 'visible';
            }
            syncBackgroundControlsForFormat();
        });`
        },
        {
            label: "transparent input default",
            oldText: "bgFillColor: isTransparent ? '#FFFFFF' : null,",
            newText: "bgFillColor: isTransparent && outputFormatSel.value === 'image/jpeg' ? '#FFFFFF' : null,"
        },
        {
            label: "canvas alpha handling",
            oldText: `                        canvas.width = img.width;
                        canvas.height = img.height;
                        
                        if (fileData.bgFillColor) {
                            ctx.fillStyle = fileData.bgFillColor;
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        } else if (format === 'image/jpeg') {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        
                        ctx.drawImage(img, 0, 0);`,
            newText: `                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        
                        if (format === 'image/jpeg') {
                            ctx.fillStyle = fileData.bgFillColor || '#FFFFFF';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        
                        ctx.drawImage(img, 0, 0);`
        },
        {
            label: "download menu drive option",
            oldText: `                    <div class="download-option" id="opt-dl-all">All (ZIP)</div>
                    <div class="download-option" id="opt-dl-one">One</div>`,
            newText: `                    <div class="download-option" id="opt-dl-all">All (ZIP)</div>
                    <div class="download-option" id="opt-dl-one">One</div>
                    <div class="download-option" id="opt-save-drive">Save to Drive</div>`
        },
        {
            label: "drive option reference",
            oldText: `        const optDlAll = document.getElementById('opt-dl-all');
        const optDlOne = document.getElementById('opt-dl-one');`,
            newText: `        const optDlAll = document.getElementById('opt-dl-all');
        const optDlOne = document.getElementById('opt-dl-one');
        const optSaveDrive = document.getElementById('opt-save-drive');`
        },
        {
            label: "drive save handler",
            oldText: `        function triggerSingleDownload(blob, filename) {`,
            newText: `        // Action: Save converted files directly to a selected folder.
        // Existing files with matching names are overwritten by createWritable().
        optSaveDrive.addEventListener('click', async (e) => {
            e.stopPropagation();
            downloadDropdown.classList.remove('show');

            const successfulFiles = filesData.filter(f => f.status === 'success' && f.blob);
            if (successfulFiles.length === 0) {
                showToast("No successfully processed files to save.");
                return;
            }

            if (!('showDirectoryPicker' in window)) {
                showToast("Save to Drive requires a browser with folder-write support, such as Chrome or Edge.");
                return;
            }

            let directoryHandle;
            try {
                directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            } catch (err) {
                if (err && err.name === 'AbortError') return;
                console.error(err);
                showToast("Could not open the folder picker.");
                return;
            }

            let saved = 0;
            let failed = 0;

            for (let i = 0; i < successfulFiles.length; i++) {
                const fileItem = successfulFiles[i];
                showToast('Saving ' + (i + 1) + ' of ' + successfulFiles.length + ': ' + fileItem.newName);

                try {
                    const fileHandle = await directoryHandle.getFileHandle(fileItem.newName, { create: true });
                    const writable = await fileHandle.createWritable();
                    try {
                        await writable.write(fileItem.blob);
                        await writable.close();
                    } catch (writeError) {
                        try { await writable.abort(); } catch (_) { /* optional cleanup */ }
                        throw writeError;
                    }
                    saved++;
                } catch (err) {
                    failed++;
                    console.error('Could not save ' + fileItem.newName, err);
                }
            }

            if (failed > 0) {
                showToast(saved + ' saved; ' + failed + ' failed.');
            } else {
                showToast(saved + ' file' + (saved === 1 ? '' : 's') + ' saved to drive. Existing matching names were overwritten.');
            }
        });

        function triggerSingleDownload(blob, filename) {`
        }
    ];

    for (const replacement of replacements) {
        if (!html.includes(replacement.oldText)) {
            throw new Error(`Bulk Convert patch point missing: ${replacement.label}.`);
        }
        html = html.replace(replacement.oldText, replacement.newText);
    }

    document.open();
    document.write(html);
    document.close();
})().catch((error) => {
    console.error(error);
    document.body.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;background:#181919;color:#f2ece0;font-family:system-ui;padding:24px;box-sizing:border-box">
            <section style="max-width:520px;border:1px solid #896b49;border-radius:20px;background:#292a24;padding:22px">
                <h1 style="margin-top:0;color:#e5a862;font-family:Georgia,serif">Bulk Convert could not start</h1>
                <p>${String(error.message || error)}</p>
                <button type="button" onclick="location.reload()" style="border:1px solid #896b49;border-radius:999px;background:#181919;color:#79b4e3;padding:10px 18px;cursor:pointer">Reload</button>
            </section>
        </main>`;
});