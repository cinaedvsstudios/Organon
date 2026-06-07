/**
 * ORGANON STUDIO: VIDEO RENDERER
 * Handles hidden video decoding, Canvas drawing, scaling (Fit/Fill), and frame stepping.
 */

// --- STATE & SETTINGS ---
const masterCanvas = document.getElementById('master-canvas');
const ctx = masterCanvas.getContext('2d', { willReadFrequently: true });

// We create an invisible video element to do the actual decoding
const hiddenVideoPlayer = document.createElement('video');
hiddenVideoPlayer.muted = true; // We handle audio separately via audio-mixer.js
hiddenVideoPlayer.playsInline = true;

let isPlaying = false;
let animationFrameId = null;
let currentFps = 30;
let currentVideoUrl = null;

// Scale Mode: 'fit' (letterbox) or 'fill' (crop)
export let scaleMode = 'fit';

function revokeCurrentVideoUrl() {
    if (currentVideoUrl) {
        URL.revokeObjectURL(currentVideoUrl);
        currentVideoUrl = null;
    }
}

function stopPlaybackLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function seekTo(timeInSeconds) {
    return new Promise((resolve, reject) => {
        const duration = Number.isFinite(hiddenVideoPlayer.duration) ? hiddenVideoPlayer.duration : 0;
        const safeTime = Math.max(0, Math.min(timeInSeconds, duration || timeInSeconds));

        const cleanup = () => {
            hiddenVideoPlayer.removeEventListener('seeked', handleSeeked);
            hiddenVideoPlayer.removeEventListener('error', handleError);
        };

        const handleSeeked = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Video seek failed.'));
        };

        hiddenVideoPlayer.addEventListener('seeked', handleSeeked, { once: true });
        hiddenVideoPlayer.addEventListener('error', handleError, { once: true });
        hiddenVideoPlayer.currentTime = safeTime;
    });
}

/**
 * Loads a video file into the hidden player and prepares it for Canvas rendering.
 */
export function loadVideoFile(file) {
    stopPlaybackLoop();
    isPlaying = false;

    revokeCurrentVideoUrl();
    currentVideoUrl = URL.createObjectURL(file);
    hiddenVideoPlayer.src = currentVideoUrl;
    hiddenVideoPlayer.load();

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            hiddenVideoPlayer.removeEventListener('loadedmetadata', handleMetadata);
            hiddenVideoPlayer.removeEventListener('error', handleError);
        };

        const handleMetadata = async () => {
            cleanup();
            console.log(`Video Loaded: ${hiddenVideoPlayer.videoWidth}x${hiddenVideoPlayer.videoHeight}`);

            try {
                await seekTo(0);
                renderCurrentFrame();
                resolve();
            } catch (error) {
                reject(error);
            }
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Video load failed.'));
        };

        hiddenVideoPlayer.addEventListener('loadedmetadata', handleMetadata, { once: true });
        hiddenVideoPlayer.addEventListener('error', handleError, { once: true });
    });
}

/**
 * The core drawing engine. Calculates aspect ratios and draws the video onto the master canvas.
 */
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

/**
 * Playback Loop using requestAnimationFrame for smooth drawing.
 */
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
        hiddenVideoPlayer.play();
        isPlaying = true;
        playbackLoop();
    }

    return isPlaying;
}

/**
 * Frame-by-Frame Granularity controls.
 * Moves the hidden video approximately 1 frame forward or backward based on FPS.
 */
export async function stepFrame(direction = 1) {
    if (isPlaying) togglePlayback();

    const frameTime = 1 / currentFps;
    const targetTime = hiddenVideoPlayer.currentTime + (frameTime * direction);

    try {
        await seekTo(targetTime);
        renderCurrentFrame();
    } catch (error) {
        console.warn('Frame step failed:', error);
    }
}

/**
 * Snapshots the current Canvas state and triggers an instant PNG download.
 */
export function downloadCurrentFramePNG() {
    masterCanvas.toBlob((blob) => {
        if (!blob) {
            console.warn('Canvas snapshot failed.');
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

/**
 * Explicit cleanup hook for future project reset/unload actions.
 */
export function destroyVideoRenderer() {
    hiddenVideoPlayer.pause();
    hiddenVideoPlayer.removeAttribute('src');
    hiddenVideoPlayer.load();
    isPlaying = false;
    stopPlaybackLoop();
    revokeCurrentVideoUrl();
}
