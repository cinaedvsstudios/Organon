(() => {
    'use strict';

    const picker = document.getElementById('video-picker');
    const addButton = document.getElementById('btn-convert-movie');
    if (!picker) return;

    picker.multiple = true;
    if (addButton) addButton.textContent = 'ADD VIDEO CLIPS';

    let replayingSingleFile = false;

    function setStatus(text) {
        try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    }

    function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    async function waitUntilImportFinishes(filename) {
        const timeoutAt = Date.now() + (10 * 60 * 1000);
        while (picker.files.length > 0 && Date.now() < timeoutAt) {
            await wait(150);
        }
        if (picker.files.length > 0) {
            picker.value = '';
            throw new Error(`Timed out while importing ${filename}.`);
        }
        await wait(100);
    }

    picker.addEventListener('change', async (event) => {
        if (replayingSingleFile) return;

        const files = [...picker.files];
        if (files.length <= 1) return;

        event.stopImmediatePropagation();
        picker.value = '';
        replayingSingleFile = true;
        setStatus(`Importing ${files.length} video clips in sequence...`);

        try {
            for (const file of files) {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                picker.files = transfer.files;
                picker.dispatchEvent(new Event('change', { bubbles: true }));
                await waitUntilImportFinishes(file.name);
            }
            setStatus(`${files.length} video clips imported. Use REORDER CLIPS to change playback order.`);
            window.setTimeout(() => {
                try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {}
            }, 4500);
        } catch (error) {
            setStatus(error.message);
        } finally {
            picker.value = '';
            replayingSingleFile = false;
        }
    }, true);
})();
