/**
 * ORGANON STUDIO: ADVANCED MEDIA ENGINE
 * v0.07 — independent canvas compositor + Web Audio audition graph.
 * This intentionally does not import or modify Basic Mode modules.
 */

const VISUAL_TYPES = new Set(['sticker', 'video']);
const AUDIO_TYPES = new Set(['video', 'external-audio']);
const SUPPORTED_BLEND_MODES = new Set([
    'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
    'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue',
    'saturation', 'color', 'luminosity'
]);

function waitForEvent(target, eventName) {
    return new Promise((resolve, reject) => {
        const onSuccess = () => cleanup(resolve);
        const onError = () => cleanup(() => reject(new Error(`${eventName} failed.`)));
        const cleanup = (callback) => {
            target.removeEventListener(eventName, onSuccess);
            target.removeEventListener('error', onError);
            callback();
        };
        target.addEventListener(eventName, onSuccess, { once: true });
        target.addEventListener('error', onError, { once: true });
    });
}

function hexToRgb(hex) {
    const normalised = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#00ff00';
    return {
        r: parseInt(normalised.slice(1, 3), 16),
        g: parseInt(normalised.slice(3, 5), 16),
        b: parseInt(normalised.slice(5, 7), 16)
    };
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function drawContained(context, source, targetWidth, targetHeight) {
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 0;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 0;
    if (!sourceWidth || !sourceHeight) return;

    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = (targetWidth - width) / 2;
    const y = (targetHeight - height) / 2;
    context.drawImage(source, x, y, width, height);
}

export class AdvancedMediaEngine {
    constructor({ canvas, mediaBin, onTimeChange, onDurationChange, onPlaybackChange, onRenderError }) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d', { willReadFrequently: true });
        this.mediaBin = mediaBin;
        this.onTimeChange = onTimeChange;
        this.onDurationChange = onDurationChange;
        this.onPlaybackChange = onPlaybackChange;
        this.onRenderError = onRenderError;
        this.tracks = [];
        this.currentTime = 0;
        this.isPlaying = false;
        this.frameRequest = null;
        this.playStartClock = 0;
        this.playStartTimeline = 0;
        this.previewMuted = false;
        this.previewVolume = 1;
        this.audioContext = null;
        this.previewGain = null;
        this.renderMixer = null;
        this.stickerWorkCanvas = document.createElement('canvas');
        this.stickerWorkContext = this.stickerWorkCanvas.getContext('2d', { willReadFrequently: true });
    }

    setTracks(tracks) {
        this.tracks = tracks;
        this.syncAudioSettings();
        this.emitDuration();
        this.renderFrame();
    }

    getTrack(trackId) {
        return this.tracks.find((track) => track.id === trackId) || null;
    }

    getTimelineDuration() {
        return this.tracks.reduce((longest, track) => {
            if (!track.sourceName || track.type === 'sticker') return longest;
            return Math.max(longest, (Number(track.start) || 0) + (Number(track.duration) || 0));
        }, 0);
    }

    async ensureAudioGraph() {
        if (this.audioContext) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio is not available in this browser.');

        this.audioContext = new AudioContextClass();
        this.renderMixer = this.audioContext.createGain();
        this.previewGain = this.audioContext.createGain();
        this.renderMixer.connect(this.previewGain);
        this.previewGain.connect(this.audioContext.destination);
        this.applyPreviewGain();
    }

    async attachFile(track, file) {
        if (!track || !file) throw new Error('A timeline track and file are required.');
        if (!VISUAL_TYPES.has(track.type) && track.type !== 'external-audio') {
            throw new Error('Choose a Video, Sticker or External Audio layer before assigning a file.');
        }

        this.detachTrack(track, false);
        const url = URL.createObjectURL(file);
        track.objectUrl = url;
        track.sourceName = file.name;
        track.fileType = file.type;
        track.start = Number(track.start) || 0;

        try {
            if (track.type === 'sticker') {
                const image = new Image();
                image.decoding = 'async';
                image.src = url;
                await waitForEvent(image, 'load');
                track.media = image;
                track.duration = 0;
                track.visible = track.visible !== false;
                track.blendMode = track.blendMode || 'source-over';
                track.transparency = track.transparency || { mode: 'native', keyColour: '#00ff00', tolerance: 30, feather: 8 };
            } else {
                const element = document.createElement(track.type === 'video' ? 'video' : 'audio');
                element.preload = 'auto';
                element.playsInline = true;
                element.crossOrigin = 'anonymous';
                element.src = url;
                this.mediaBin.appendChild(element);
                await waitForEvent(element, 'loadedmetadata');
                track.media = element;
                track.duration = Number.isFinite(element.duration) ? element.duration : 0;
                track.visible = track.visible !== false;
                track.blendMode = track.blendMode || 'source-over';
                await this.ensureAudioGraph();
                track.audioNode = this.audioContext.createMediaElementSource(element);
                track.gainNode = this.audioContext.createGain();
                track.audioNode.connect(track.gainNode);
                track.gainNode.connect(this.renderMixer);
            }
        } catch (error) {
            if (track.objectUrl) URL.revokeObjectURL(track.objectUrl);
            track.objectUrl = null;
            track.sourceName = '';
            track.media = null;
            throw error;
        }

        this.syncAudioSettings();
        this.emitDuration();
        this.renderFrame();
        return track;
    }

    detachTrack(track, emit = true) {
        if (!track) return;
        try { track.media?.pause?.(); } catch (_) { /* no-op */ }
        try { track.audioNode?.disconnect(); } catch (_) { /* no-op */ }
        try { track.gainNode?.disconnect(); } catch (_) { /* no-op */ }
        if (track.media?.parentNode === this.mediaBin) track.media.remove();
        if (track.objectUrl) URL.revokeObjectURL(track.objectUrl);
        track.media = null;
        track.audioNode = null;
        track.gainNode = null;
        track.objectUrl = null;
        track.sourceName = '';
        track.duration = 0;
        if (emit) {
            this.emitDuration();
            this.renderFrame();
        }
    }

    clearAll() {
        this.pause();
        this.tracks.forEach((track) => this.detachTrack(track, false));
        this.currentTime = 0;
        this.emitDuration();
        this.emitTime();
        this.renderFrame();
    }

    resolveAudioControl(track) {
        if (track.type === 'video' && track.audioControlId) return this.getTrack(track.audioControlId);
        if (track.type === 'external-audio') return track;
        return null;
    }

    syncAudioSettings() {
        for (const track of this.tracks) {
            if (!AUDIO_TYPES.has(track.type) || !track.gainNode) continue;
            const control = this.resolveAudioControl(track);
            const volume = control?.audio?.volume ?? 1;
            const muted = Boolean(control?.audio?.muted);
            track.gainNode.gain.value = muted ? 0 : clamp(Number(volume) || 0, 0, 1);
        }
    }

    setPreviewVolume(value) {
        this.previewVolume = clamp(Number(value), 0, 1);
        if (this.previewVolume > 0) this.previewMuted = false;
        this.applyPreviewGain();
    }

    togglePreviewMute() {
        this.previewMuted = !this.previewMuted;
        this.applyPreviewGain();
        return this.previewMuted;
    }

    applyPreviewGain() {
        if (this.previewGain) this.previewGain.gain.value = this.previewMuted ? 0 : this.previewVolume;
    }

    getCurrentTime() {
        if (!this.isPlaying || !this.audioContext) return this.currentTime;
        return Math.max(0, this.playStartTimeline + (this.audioContext.currentTime - this.playStartClock));
    }

    async play() {
        const playable = this.tracks.filter((track) => AUDIO_TYPES.has(track.type) && track.media && track.sourceName);
        if (!playable.length) throw new Error('Load a video or audio file before pressing Play.');
        await this.ensureAudioGraph();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        const time = this.currentTime;
        for (const track of playable) {
            const trackTime = time - (Number(track.start) || 0);
            if (trackTime < 0 || (track.duration && trackTime > track.duration)) continue;
            try {
                track.media.currentTime = Math.max(0, trackTime);
                await track.media.play();
            } catch (error) {
                console.warn(`Could not start ${track.sourceName}:`, error);
            }
        }

        this.playStartTimeline = time;
        this.playStartClock = this.audioContext.currentTime;
        this.isPlaying = true;
        this.onPlaybackChange?.(true);
        this.startRenderLoop();
    }

    pause() {
        if (this.isPlaying) this.currentTime = this.getCurrentTime();
        this.isPlaying = false;
        this.tracks.forEach((track) => {
            if (AUDIO_TYPES.has(track.type) && track.media) track.media.pause();
        });
        this.stopRenderLoop();
        this.emitTime();
        this.renderFrame();
        this.onPlaybackChange?.(false);
    }

    async togglePlay() {
        if (this.isPlaying) {
            this.pause();
            return false;
        }
        await this.play();
        return true;
    }

    async seek(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();
        this.currentTime = clamp(Number(time) || 0, 0, Math.max(this.getTimelineDuration(), 0));

        for (const track of this.tracks) {
            if (!AUDIO_TYPES.has(track.type) || !track.media) continue;
            const trackTime = clamp(this.currentTime - (Number(track.start) || 0), 0, Math.max(0, track.duration || 0));
            try { track.media.currentTime = trackTime; } catch (_) { /* no-op */ }
        }
        this.emitTime();
        this.renderFrame();
        if (wasPlaying) await this.play();
    }

    async stepFrame(direction = 1) {
        await this.seek(this.currentTime + (direction / 30));
    }

    startRenderLoop() {
        this.stopRenderLoop();
        const render = () => {
            if (!this.isPlaying) return;
            const duration = this.getTimelineDuration();
            this.currentTime = this.getCurrentTime();
            if (duration > 0 && this.currentTime >= duration) {
                this.currentTime = duration;
                this.pause();
                return;
            }
            this.emitTime();
            this.renderFrame();
            this.frameRequest = requestAnimationFrame(render);
        };
        this.frameRequest = requestAnimationFrame(render);
    }

    stopRenderLoop() {
        if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
        this.frameRequest = null;
    }

    getVisualTracksTopToBottom() {
        const stickers = this.tracks.filter((track) => track.type === 'sticker');
        const videos = this.tracks.filter((track) => track.type === 'video');
        return [...stickers.sort((a, b) => a.order - b.order), ...videos.sort((a, b) => a.order - b.order)];
    }

    ensureCanvasSize() {
        const firstVideo = this.tracks.find((track) => track.type === 'video' && track.media?.videoWidth && track.media?.videoHeight);
        const width = firstVideo?.media?.videoWidth || 1280;
        const height = firstVideo?.media?.videoHeight || 720;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    renderFrame() {
        try {
            this.ensureCanvasSize();
            const { width, height } = this.canvas;
            this.context.save();
            this.context.globalCompositeOperation = 'source-over';
            this.context.clearRect(0, 0, width, height);
            this.context.fillStyle = '#000000';
            this.context.fillRect(0, 0, width, height);

            const visualTracks = this.getVisualTracksTopToBottom();
            // Render bottom-to-top. Timeline line 1 is topmost, so it is drawn last.
            for (const track of [...visualTracks].reverse()) {
                if (!track.media || !track.sourceName || track.visible === false) continue;
                const localTime = this.currentTime - (Number(track.start) || 0);
                if (localTime < 0) continue;
                if (track.type === 'video' && track.duration && localTime > track.duration) continue;

                this.context.save();
                this.context.globalCompositeOperation = SUPPORTED_BLEND_MODES.has(track.blendMode) ? track.blendMode : 'source-over';
                if (track.type === 'video') {
                    if (track.media.readyState >= 2) drawContained(this.context, track.media, width, height);
                } else if (track.type === 'sticker') {
                    this.drawSticker(track, width, height);
                }
                this.context.restore();
            }
            this.context.restore();
        } catch (error) {
            console.error('Advanced canvas render failed:', error);
            this.onRenderError?.(error);
        }
    }

    drawSticker(track, width, height) {
        const settings = track.transparency || { mode: 'native', keyColour: '#00ff00', tolerance: 30, feather: 8 };
        if (settings.mode === 'native') {
            drawContained(this.context, track.media, width, height);
            return;
        }

        const sourceWidth = track.media.naturalWidth || track.media.width || 0;
        const sourceHeight = track.media.naturalHeight || track.media.height || 0;
        if (!sourceWidth || !sourceHeight) return;

        const maximumDimension = 1600;
        const sourceScale = Math.min(1, maximumDimension / Math.max(sourceWidth, sourceHeight));
        const processWidth = Math.max(1, Math.round(sourceWidth * sourceScale));
        const processHeight = Math.max(1, Math.round(sourceHeight * sourceScale));
        if (this.stickerWorkCanvas.width !== processWidth || this.stickerWorkCanvas.height !== processHeight) {
            this.stickerWorkCanvas.width = processWidth;
            this.stickerWorkCanvas.height = processHeight;
        }

        this.stickerWorkContext.clearRect(0, 0, processWidth, processHeight);
        this.stickerWorkContext.drawImage(track.media, 0, 0, processWidth, processHeight);
        const imageData = this.stickerWorkContext.getImageData(0, 0, processWidth, processHeight);
        const pixels = imageData.data;
        const key = hexToRgb(settings.keyColour);
        const tolerance = clamp(Number(settings.tolerance) || 0, 0, 100) * 2.55;
        const feather = Math.max(1, clamp(Number(settings.feather) || 0, 0, 100) * 2.55);

        for (let index = 0; index < pixels.length; index += 4) {
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];
            const existingAlpha = pixels[index + 3];
            let alphaMultiplier = 1;

            if (settings.mode === 'chroma') {
                const distance = Math.hypot(r - key.r, g - key.g, b - key.b);
                alphaMultiplier = clamp((distance - tolerance) / feather, 0, 1);
            } else {
                const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
                if (settings.mode === 'light') {
                    const threshold = 255 - tolerance;
                    alphaMultiplier = clamp((threshold - luminance) / feather, 0, 1);
                } else if (settings.mode === 'dark') {
                    alphaMultiplier = clamp((luminance - tolerance) / feather, 0, 1);
                }
            }
            pixels[index + 3] = Math.round(existingAlpha * alphaMultiplier);
        }

        this.stickerWorkContext.putImageData(imageData, 0, 0);
        drawContained(this.context, this.stickerWorkCanvas, width, height);
    }

    async snapshot() {
        this.renderFrame();
        const blob = await new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG snapshot could not be created.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'organon-advanced-composite.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    emitTime() {
        this.onTimeChange?.({ currentTime: this.currentTime, duration: this.getTimelineDuration() });
    }

    emitDuration() {
        this.onDurationChange?.(this.getTimelineDuration());
    }

    destroy() {
        this.clearAll();
        try { this.renderMixer?.disconnect(); } catch (_) { /* no-op */ }
        try { this.previewGain?.disconnect(); } catch (_) { /* no-op */ }
        this.audioContext?.close?.();
    }
}
