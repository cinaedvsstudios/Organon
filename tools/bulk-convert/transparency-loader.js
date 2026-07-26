"use strict";

(async () => {
    const response = await fetch("./index.html?source=alpha-preservation-20260726", { cache: "no-store" });
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
