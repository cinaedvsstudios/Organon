/**
 * Local classic worker for the official single-thread ffmpeg.wasm core.
 */

let ffmpeg = null;

function postResult(id, data, transfer = []) {
    self.postMessage({ id, ok: true, data }, transfer);
}

function postError(id, error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
}

async function loadCore({ coreURL, wasmURL }) {
    const first = !ffmpeg;
    if (ffmpeg) return first;

    importScripts(coreURL);
    if (typeof self.createFFmpegCore !== 'function') {
        throw new Error('FFmpeg core factory did not load.');
    }

    const locationData = btoa(JSON.stringify({
        wasmURL,
        workerURL: coreURL.replace(/\.js(?:#.*)?$/, '.worker.js')
    }));

    ffmpeg = await self.createFFmpegCore({
        mainScriptUrlOrBlob: `${coreURL}#${locationData}`
    });

    ffmpeg.setLogger((data) => self.postMessage({ type: 'log', data }));
    ffmpeg.setProgress((data) => self.postMessage({ type: 'progress', data }));
    return first;
}

self.addEventListener('message', async (event) => {
    const { id, type, data } = event.data || {};

    try {
        if (type === 'load') {
            postResult(id, await loadCore(data));
            return;
        }

        if (!ffmpeg) throw new Error('FFmpeg core is not loaded.');

        if (type === 'exec') {
            ffmpeg.setTimeout(data.timeout ?? -1);
            ffmpeg.exec(...data.args);
            const code = ffmpeg.ret;
            ffmpeg.reset();
            postResult(id, code);
            return;
        }

        if (type === 'ffprobe') {
            ffmpeg.setTimeout(data.timeout ?? -1);
            ffmpeg.ffprobe(...data.args);
            const code = ffmpeg.ret;
            ffmpeg.reset();
            postResult(id, code);
            return;
        }

        if (type === 'writeFile') {
            ffmpeg.FS.writeFile(data.path, data.data);
            postResult(id, true);
            return;
        }

        if (type === 'readFile') {
            const result = ffmpeg.FS.readFile(data.path, { encoding: data.encoding || 'binary' });
            if (result instanceof Uint8Array) {
                postResult(id, result, [result.buffer]);
            } else {
                postResult(id, result);
            }
            return;
        }

        if (type === 'deleteFile') {
            ffmpeg.FS.unlink(data.path);
            postResult(id, true);
            return;
        }

        throw new Error(`Unknown FFmpeg worker message: ${type}`);
    } catch (error) {
        postError(id, error);
    }
});
