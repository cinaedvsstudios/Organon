/**
 * MotoriClip media lifecycle helpers. Do not assume a filename extension proves
 * that its container or internal codecs are supported by the current browser.
 */
const MEDIA_EXTENSIONS = Object.freeze({
    mp4:'video/mp4', m4v:'video/mp4', webm:'video/webm',
    mov:'video/quicktime', avi:'video/x-msvideo', mkv:'video/x-matroska',
    mp3:'audio/mpeg', wav:'audio/wav', m4a:'audio/mp4', aac:'audio/aac',
    ogg:'audio/ogg', opus:'audio/ogg', flac:'audio/flac'
});
export function sourceMime(file) {
    const type = String(file?.type || '').toLowerCase().split(';')[0].trim();
    if (type && type !== 'application/octet-stream') return type;
    const extension = String(file?.name || '').toLowerCase().split('.').pop();
    return MEDIA_EXTENSIONS[extension] || '';
}
export function checkBrowserMediaSupport(player, file, { audioFromVideo = false } = {}) {
    const mime = sourceMime(file);
    if (!mime || !player || typeof player.canPlayType !== 'function') return;
    // Extract Audio deliberately opens a video container in an audio element.
    // A browser's video MIME verdict on an audio-only player may be negative
    // even if the contained audio track is decodable. Let its decoder decide.
    if (audioFromVideo && mime.startsWith('video/')) return;
    // A negative result is conclusive for this container type, whereas 'maybe'
    // and 'probably' still require an actual decoder load to verify codecs.
    if (player.canPlayType(mime) === '') {
        throw new Error(`Your browser cannot play ${mime} files (${file?.name || 'this media'}). Convert the file to MP4 (H.264/AAC), WebM, or a supported audio format, then import it again.`);
    }
}
export function mediaFailureMessage(element, label = 'Media') {
    const code = Number(element?.error?.code);
    if (code === 2) return `${label}: the media could not be read. Check the file and try importing it again.`;
    if (code === 3) return `${label}: the browser could not decode this video/audio codec. Try H.264/AAC in MP4 or a browser-supported format.`;
    if (code === 4) return `${label}: this container or codec is not supported by your browser. Try H.264/AAC in MP4 or WebM.`;
    if (code === 1) return `${label}: loading was stopped before it finished.`;
    return `${label}: could not be loaded. Check that the file is complete and supported by the browser.`;
}
export function waitForMediaReady(element, eventName, {
    signal = null, timeoutMs = 30000, label = 'Media',
} = {}) {
    return new Promise((resolve, reject) => {
        let done = false;
        let timer = null;
        const clean = () => {
            element.removeEventListener(eventName, onReady);
            element.removeEventListener('error', onError);
            signal?.removeEventListener('abort', onAbort);
            if (timer !== null) clearTimeout(timer);
        };
        const finish = (error) => {
            if (done) return;
            done = true; clean();
            if (error) reject(error); else resolve();
        };
        const isReady = () => {
            if (eventName === 'load') {
                return element.complete === true && Number(element.naturalWidth) > 0;
            }
            const state = Number(element.readyState);
            return state >= (eventName === 'loadeddata' ? 2 : 1);
        };
        const onReady = () => finish(null);
        const onError = () => finish(new Error(mediaFailureMessage(element, label)));
        const onAbort = () => finish(new Error('Media loading was cancelled.'));
        if (signal?.aborted) { finish(new Error('Media loading was cancelled.')); return; }
        element.addEventListener(eventName, onReady);
        element.addEventListener('error', onError);
        signal?.addEventListener('abort', onAbort, {once:true});
        timer = setTimeout(() => finish(new Error(`${label}: loading timed out. This file may be corrupt, too large, or use a codec the browser cannot decode.`)), Math.max(100, Number(timeoutMs) || 30000));
        // Avoid a wait forever if the event fired before this listener was added.
        if (isReady()) finish(null);
        else if (element.error) onError();
    });
}
