/**
 * MotoriClip paused-frame seeking and project-frame stepping.
 * Works without media playback; call only on a metadata-ready HTMLVideoElement.
 */
export const PROJECT_FRAME_RATES = Object.freeze([24, 25, 30, 50, 60]);

export function normalizeProjectFps(value) {
    const fps = Number(value);
    return PROJECT_FRAME_RATES.includes(fps) ? fps : 30;
}

export function stepFrameTime(time, direction, fps, duration) {
    const rate = normalizeProjectFps(fps);
    const position = Math.max(0, Number(time) || 0);
    const safeDuration = Math.max(0, Number(duration) || 0);
    if (!Number.isFinite(direction) || direction === 0) return Math.min(position, safeDuration);
    // Advance to the next/previous *grid* frame, even from an in-between seek time.
    const index = direction > 0
        ? Math.floor(position * rate + 1e-7) + 1
        : Math.ceil(position * rate - 1e-7) - 1;
    return Math.max(0, Math.min(index / rate, safeDuration));
}

/**
 * Wait for a requested paused video position. Returns false if superseded.
 * First waits for seeked/HAVE_CURRENT_DATA, then prefers a compositor frame
 * callback if available. A bounded fallback handles paused browsers that don't
 * dispatch video-frame callbacks after seeking.
 */
export function waitForVideoSeek(video, requestedTime, {
    signal = null,
    timeoutMs = 2500,
    frameTimeoutMs = 180,
} = {}) {
    if (!video) return Promise.resolve(true);
    if (signal?.aborted) return Promise.resolve(false);
    const target = Math.max(0, Number(requestedTime) || 0);

    return new Promise((resolve, reject) => {
        let complete = false;
        let seekTimer = null;
        let frameTimer = null;
        let videoFrameId = null;
        let frameRequested = false;
        let finishing = false;

        const ready = () => !video.seeking && Number(video.readyState) >= 2;
        const atTarget = () => Math.abs((Number(video.currentTime) || 0) - target) <= 0.08;
        const cleanup = () => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            video.removeEventListener('error', onError);
            signal?.removeEventListener('abort', onAbort);
            if (seekTimer !== null) clearTimeout(seekTimer);
            if (frameTimer !== null) clearTimeout(frameTimer);
            if (videoFrameId !== null && typeof video.cancelVideoFrameCallback === 'function') {
                try { video.cancelVideoFrameCallback(videoFrameId); } catch (_) { /* unsupported */ }
            }
        };
        const settle = (value, error = null) => {
            if (complete) return;
            complete = true;
            cleanup();
            if (error) reject(error);
            else resolve(value);
        };
        const onAbort = () => settle(false);
        const onError = () => settle(false, new Error('Could not decode the requested video frame.'));
        const awaitCompositorFrame = () => {
            if (finishing || complete) return;
            finishing = true;
            if (typeof video.requestVideoFrameCallback !== 'function') {
                settle(true);
                return;
            }
            frameRequested = true;
            try {
                const requestFrame = () => {
                    videoFrameId = video.requestVideoFrameCallback((_now, metadata) => {
                        if (complete) return;
                        // Ignore a stale compositor frame after a rapid seek.
                        const frameTime = Number(metadata?.mediaTime);
                        if (Number.isFinite(frameTime) && Math.abs(frameTime - target) > 0.17) {
                            if (!signal?.aborted) requestFrame();
                            return;
                        }
                        settle(true);
                    });
                };
                requestFrame();
                frameTimer = setTimeout(() => {
                    // Some browsers don't send rVFC for a paused seek. 'seeked'
                    // plus HAVE_CURRENT_DATA is the supported fallback.
                    if (ready() && atTarget()) settle(true);
                    else settle(false, new Error('The requested frame is not ready.'));
                }, Math.max(25, Number(frameTimeoutMs) || 180));
            } catch (_) {
                if (ready() && atTarget()) settle(true);
                else settle(false, new Error('The requested video frame is unavailable.'));
            }
        };
        const onReady = () => {
            if (ready() && atTarget()) awaitCompositorFrame();
        };
        const onSeeked = () => onReady();

        signal?.addEventListener('abort', onAbort, { once:true });
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('loadeddata', onReady);
        video.addEventListener('canplay', onReady);
        video.addEventListener('error', onError);

        seekTimer = setTimeout(() => {
            if (ready() && atTarget()) {
                // The seek completed but the browser omitted seeked/loadeddata.
                awaitCompositorFrame();
            } else {
                settle(false, new Error('Timed out waiting for the selected video frame.'));
            }
        }, Math.max(200, Number(timeoutMs) || 2500));

        const previous = Number(video.currentTime) || 0;
        try {
            // Always keep the last seek request authoritative.
            if (video.seeking || Math.abs(previous - target) > 0.00001) {
                video.currentTime = target;
            }
            // Seeking to the existing position does not necessarily fire seeked.
            onReady();
        } catch (error) {
            settle(false, new Error('Could not seek the video: ' + (error?.message || error)));
        }
    });
}
