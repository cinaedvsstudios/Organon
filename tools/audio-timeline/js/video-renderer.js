/**
 * ORGANON STUDIO: VIDEO RENDERER
 * Handles hidden video decoding, Canvas drawing, scaling (Fit/Fill), and frame stepping.
 */

// --- STATE & SETTINGS ---
const masterCanvas = document.getElementById('master-canvas');
const ctx = masterCanvas.getContext('2d', { willReadFrequently: true }); // Optimized for pixel manipulation

// We create an invisible video element to do the actual decoding
const hiddenVideoPlayer = document.createElement('video');
hiddenVideoPlayer.muted = true; // We handle audio separately via audio-mixer.js
hiddenVideoPlayer.playsInline = true;

let isPlaying = false;
let animationFrameId = null;
let currentFps = 30; // Default targeting 30fps for standard AI outputs

// Scale Mode: 'fit' (letterbox) or 'fill' (crop)
export let scaleMode = 'fit'; 

/**
 * Loads a video file into the hidden player and prepares it for Canvas rendering.
 */
export function loadVideoFile(file) {
    const fileURL = URL.createObjectURL(file);
    hiddenVideoPlayer.src = fileURL;
    hiddenVideoPlayer.load();

    return new Promise((resolve) => {
        hiddenVideoPlayer.onloadedmetadata = () => {
            console.log(`Video Loaded: ${hiddenVideoPlayer.videoWidth}x${hiddenVideoPlayer.videoHeight}`);
            
            // Draw the very first frame so the canvas isn't blank
            hiddenVideoPlayer.currentTime = 0;
            hiddenVideoPlayer.onseeked = () => {
                renderCurrentFrame();
                resolve();
            };
        };
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

    // Clear background to pure Organon black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cWidth, cHeight);

    if (vWidth === 0 || vHeight === 0) return;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (scaleMode === 'fit') {
        // LETTERBOXING (Keep whole video visible)
        const scale = Math.min(cWidth / vWidth, cHeight / vHeight);
        drawWidth = vWidth * scale;
        drawHeight = vHeight * scale;
        offsetX = (cWidth - drawWidth) / 2;
        offsetY = (cHeight - drawHeight) / 2;
    } else {
        // FILL / CROP (Stretch to fill edges, crop the rest)
        const scale = Math.max(cWidth / vWidth, cHeight / vHeight);
        drawWidth = vWidth * scale;
        drawHeight = vHeight * scale;
        offsetX = (cWidth - drawWidth) / 2;
        offsetY = (cHeight - drawHeight) / 2;
    }

    // Draw the current video frame onto the canvas
    ctx.drawImage(hiddenVideoPlayer, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Playback Loop using requestAnimationFrame for smooth drawing
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
        cancelAnimationFrame(animationFrameId);
    } else {
        hiddenVideoPlayer.play();
        isPlaying = true;
        playbackLoop();
    }
    return isPlaying;
}

/**
 * Frame-by-Frame Granularity controls.
 * Moves the hidden video exactly 1 frame forward or backward based on FPS.
 */
export function stepFrame(direction = 1) {
    if (isPlaying) togglePlayback(); // Pause if currently playing

    const frameTime = 1 / currentFps;
    hiddenVideoPlayer.currentTime += (frameTime * direction);
    
    // We must wait for the hidden video to actually "seek" before drawing
    hiddenVideoPlayer.onseeked = () => {
        renderCurrentFrame();
        hiddenVideoPlayer.onseeked = null; // clean up listener
    };
}

/**
 * Snapshots the current Canvas state and triggers an instant PNG download.
 */
export function downloadCurrentFramePNG() {
    masterCanvas.toBlob((blob) => {
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