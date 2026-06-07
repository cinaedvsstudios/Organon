/**
 * ORGANON STUDIO: VIDEO RENDERER
 * Handles hidden video decoding, Canvas drawing, scaling, playback, and frame stepping.
 */

const masterCanvas = document.getElementById('master-canvas');
const ctx = masterCanvas.getContext('2d', { willReadFrequently: true });

const hiddenVideoPlayer = document.createElement('video');
hiddenVideoPlayer.muted = true;
hiddenVideoPlayer.playsInline = true;
hiddenVideoPlayer.preload = 'metadata';

let isPlaying = false;
let animationFrameId = null;
let currentFps = 30;
let currentVideoUrl = null;

export let scaleMode = 'fit';

function stopPlaybackLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function revokeCurrentVideoUrl() {
    if (currentVideoUrl) {
        URL.revokeObjectURL(currentVideoUrl);
        currentVideoUrl = null;
    }
}

function waitForEvent(target, eventName) {
    return new Promise((resolve, reject) => {
        const onSuccess = () => cleanup(resolve);
        const onError = () => cleanup(() => reject(new Error(`Video ${eventName} failed.`)));

        const cleanup = (callback) => {
            target.removeEventListener(eventName, onSuccess);
            target.removeEventListener('error', onError);
            callback();
        };

        target.addEventListener(eventName, onSuccess, { once: true });
        target.addEventListener('error', onError, { once: true });
    });
}

async function seekTo(timeInSeconds) {
    const safeDuration = Number.isFinite(hiddenVideoPlayer.duration) ? hiddenVideoPlayer.duration : 0;
    const safeTime = Math.max(0, Math.min(timeInSeconds, safeDuration));

    if (Math.abs(hiddenVideoPlayer.currentTime - safeTime) < 0.0005) {
        renderCurrentFrame();
        return;
    }

    const seekPromise = waitForEvent(hiddenVideoPlayer, 'seeked');
    hiddenVideoPlayer.currentTime = safeTime;
    await seekPromise;
    renderCurrentFrame();
}

export async function loadVideoFile(file) {
    if (isPlaying) {
        togglePlayback();
    }

    stopPlaybackLoop();
    revokeCurrentVideoUrl();

    currentVideoUrl = URL.createObjectURL(file);
    hiddenVideoPlayer.removeAttribute('src');
    hiddenVideoPlayer.load();

    hiddenVideoPlayer.src = currentVideoUrl;
    hiddenVideoPlayer.load();

    await waitForEvent(hiddenVideoPlayer, 'loadedmetadata');
    console.log(`Video Loaded: ${hiddenVideoPlayer.videoWidth}x${hiddenVideoPlayer.videoHeight}`);

    await seekTo(0);
}

export function renderCurrentFrame() {
    const vWidth = hiddenVideoPlayer.videoWidth;
    const vHeight = hiddenVideoPlayer.videoHeight;
    const cWidth = masterCanvas.width;
    const cHeight = masterCanvas.height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cWidth, cHeight);

    if (vWidth === 0 || vHeight === 0) return;

    let drawWidth;
    let drawHeight;
    let offsetX;
    let offsetY;

    if (scaleMode === 'fit') {
        const scale = Math.min(cWidth / vWidth, cHeight / vHeight);
        drawWidth = vWidth * scale;
        drawHeight = vHeight * scale;
        offsetX = (cWidth - drawWidth) / 2;
        offsetY = (cHeight - drawHeight) / 2;
    } else {
        const scale = Math.max(cWidth / vWidth, cHeight / vHeight);
        drawWidth = vWidth * scale;
        drawHeight = vHeight * scale;
        offsetX = (cWidth - drawWidth) / 2;
        offsetY = (cHeight - drawHeight) / 2;
    }

    ctx.drawImage(hiddenVideoPlayer, offsetX, offsetY, drawWidth, drawHeight);
}

function playbackLoop() {
    if (!isPlaying) return;
    renderCurrentFrame();
    animationFrameId = requestAnimationFrame(playbackLoop);
}

export function togglePlayback() {
    if (isPlaying) {
        hiddenVideoPlayer.pause();
        isPlaying = false;
        stopPlaybackLoop();
    } else {
        hiddenVideoPlayer.play().catch((error) => {
            console.error('Video playback failed:', error);
            isPlaying = false;
            stopPlaybackLoop();
        });

        isPlaying = true;
        playbackLoop();
    }

    return isPlaying;
}

export async function stepFrame(direction = 1) {
    if (isPlaying) {
        togglePlayback();
    }

    const frameTime = 1 / currentFps;
    await seekTo(hiddenVideoPlayer.currentTime + frameTime * direction);
}

export function downloadCurrentFramePNG() {
    masterCanvas.toBlob((blob) => {
        if (!blob) {
            console.warn('Could not create PNG snapshot.');
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `organon-frame-${Math.floor(hiddenVideoPlayer.currentTime * 1000)}ms.png`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }, 'image/png');
}

window.addEventListener('beforeunload', () => {
    stopPlaybackLoop();
    revokeCurrentVideoUrl();
});
