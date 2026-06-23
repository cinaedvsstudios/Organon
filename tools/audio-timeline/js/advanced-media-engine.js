/**
 * ORGANON STUDIO: ADVANCED MEDIA ENGINE
 * v0.15 — adds source offsets for real split clips, audio fade envelopes and lightweight beat/loudness analysis.
 * Video sound is linked to its video clip. It only becomes a movable audio track when explicitly extracted.
 */

const VISUAL_TYPES = new Set(['background', 'video', 'sticker']);
const AUDIO_TYPES = new Set(['video', 'audio']);
const SUPPORTED_BLEND_MODES = new Set(['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn']);

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function waitForEvent(target, eventName) {
    return new Promise((resolve, reject) => {
        const cleanup = () => { target.removeEventListener(eventName, onSuccess); target.removeEventListener('error', onError); };
        const onSuccess = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error(`Could not load media (${eventName}).`)); };
        target.addEventListener(eventName, onSuccess, { once:true });
        target.addEventListener('error', onError, { once:true });
    });
}
function drawContained(context, source, width, height) {
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 0;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 0;
    if (!sourceWidth || !sourceHeight) return;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}
function drawCovered(context, source, width, height) {
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 0;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 0;
    if (!sourceWidth || !sourceHeight) return;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}
function hexToRgb(hex) {
    const value = String(hex || '#00ff00').replace('#', '');
    return { r:parseInt(value.slice(0,2),16)||0, g:parseInt(value.slice(2,4),16)||0, b:parseInt(value.slice(4,6),16)||0 };
}

export class AdvancedMediaEngine {
    constructor({ canvas, mediaBin, onTimeChange, onDurationChange, onPlaybackChange, onRenderError }) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d', { willReadFrequently:true });
        this.mediaBin = mediaBin;
        this.onTimeChange = onTimeChange;
        this.onDurationChange = onDurationChange;
        this.onPlaybackChange = onPlaybackChange;
        this.onRenderError = onRenderError;
        this.tracks = [];
        this.currentTime = 0;
        this.isPlaying = false;
        this.playStartTimeline = 0;
        this.playStartClock = 0;
        this.frameRequest = null;
        this.previewVolume = 1;
        this.previewMuted = false;
        this.audioContext = null;
        this.previewGain = null;
        this.outputWidth = Math.max(64, Math.round(Number(canvas.width) || 1280));
        this.outputHeight = Math.max(64, Math.round(Number(canvas.height) || 720));
        this.stickerWorkCanvas = document.createElement('canvas');
        this.stickerWorkContext = this.stickerWorkCanvas.getContext('2d', { willReadFrequently:true });
        this.analysisContext = null;
    }

    async ensureAudioGraph() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.previewGain = this.audioContext.createGain();
        this.previewGain.connect(this.audioContext.destination);
        this.applyPreviewGain();
    }

    setCanvasResolution(width, height) {
        this.outputWidth = clamp(Math.round(Number(width) || 1280), 64, 7680);
        this.outputHeight = clamp(Math.round(Number(height) || 720), 64, 7680);
        if (this.canvas.width !== this.outputWidth || this.canvas.height !== this.outputHeight) {
            this.canvas.width = this.outputWidth;
            this.canvas.height = this.outputHeight;
        }
        this.renderFrame();
        return { width:this.outputWidth, height:this.outputHeight };
    }

    setTracks(tracks) {
        this.tracks = Array.isArray(tracks) ? tracks : [];
        this.syncAudioSettings(this.currentTime);
        this.emitDuration();
        this.renderFrame();
    }

    getTimelineDuration() {
        const endTimes = this.tracks.filter((track) => track.sourceName).map((track) => (Number(track.start) || 0) + (Number(track.clipDuration) || 0));
        return Math.max(0, ...endTimes);
    }

    getTrack(trackId) { return this.tracks.find((track) => track.id === trackId) || null; }

    async loadTrack(track, file) {
        if (!track || !file) throw new Error('A track and a source file are required.');
        this.detachTrack(track, false);
        track.file = file;
        track.sourceOffset = Math.max(0, Number(track.sourceOffset) || 0);
        track.objectUrl = URL.createObjectURL(file);
        track.sourceName = file.name;
        track.fileType = file.type;
        try {
            if (track.type === 'sticker' || track.type === 'background') {
                const image = new Image();
                image.decoding = 'async';
                image.src = track.objectUrl;
                await waitForEvent(image, 'load');
                track.media = image;
                track.sourceDuration = 300;
                if (!Number(track.clipDuration)) track.clipDuration = 3;
            } else if (track.type === 'video') {
                const visual = document.createElement('video');
                visual.preload = 'auto'; visual.playsInline = true; visual.muted = true; visual.playbackRate = 1; visual.src = track.objectUrl;
                this.mediaBin.appendChild(visual);
                await waitForEvent(visual, 'loadedmetadata');
                const sound = document.createElement('audio');
                sound.preload = 'auto'; sound.playbackRate = 1; sound.src = track.objectUrl;
                this.mediaBin.appendChild(sound);
                await waitForEvent(sound, 'loadedmetadata');
                track.media = visual;
                track.soundMedia = sound;
                track.sourceDuration = Number.isFinite(visual.duration) ? visual.duration : 0;
                if (!Number(track.clipDuration)) track.clipDuration = track.sourceDuration || 1;
                await this.connectAudioTrack(track, sound);
            } else if (track.type === 'audio') {
                const audio = document.createElement('audio');
                audio.preload = 'auto'; audio.playbackRate = 1; audio.src = track.objectUrl;
                this.mediaBin.appendChild(audio);
                await waitForEvent(audio, 'loadedmetadata');
                track.media = audio;
                track.sourceDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
                if (!Number(track.clipDuration)) track.clipDuration = track.sourceDuration || 1;
                await this.connectAudioTrack(track, audio);
            }
        } catch (error) {
            this.detachTrack(track, false);
            throw error;
        }
        this.syncAudioSettings();
        this.emitDuration();
        this.renderFrame();
        return track;
    }

    async analyzeTrackAudio(track, file) {
        if (!track || !file || (track.type !== 'audio' && track.type !== 'video')) return null;
        try {
            if (!this.analysisContext) this.analysisContext = new (window.AudioContext || window.webkitAudioContext)();
            const raw = await file.arrayBuffer();
            const buffer = await this.analysisContext.decodeAudioData(raw.slice(0));
            const source = buffer.getChannelData(0);
            const bucketCount = clamp(Math.round(Math.max(36, Math.min(180, buffer.duration * 14))), 36, 180);
            const windowSize = Math.max(1, Math.floor(source.length / bucketCount));
            const energies = [];
            for (let bucket = 0; bucket < bucketCount; bucket += 1) {
                const start = bucket * windowSize;
                const end = Math.min(source.length, start + windowSize);
                let sum = 0;
                for (let index = start; index < end; index += 1) sum += source[index] * source[index];
                energies.push(Math.sqrt(sum / Math.max(1, end - start)));
            }
            const ordered = [...energies].sort((a, b) => a - b);
            const floor = ordered[Math.floor(ordered.length * .12)] || 0;
            const ceiling = Math.max(floor + .00001, ordered[Math.floor(ordered.length * .92)] || 1);
            const levels = energies.map((value, index) => {
                let normalised = clamp((value - floor) / (ceiling - floor), 0, 1);
                const previous = energies[index - 1] ?? value;
                const next = energies[index + 1] ?? value;
                const isPeak = value >= previous && value >= next && normalised > .58;
                if (isPeak) normalised = clamp(normalised * 1.2, 0, 1);
                return Number(normalised.toFixed(3));
            });
            track.analysis = { levels, sampleCount: bucketCount, analysed: true };
            return track.analysis;
        } catch (error) {
            console.warn(`Could not analyse ${file.name || 'audio'}:`, error);
            track.analysis = null;
            return null;
        }
    }

    async connectAudioTrack(track, mediaElement) {
        await this.ensureAudioGraph();
        track.audioNode = this.audioContext.createMediaElementSource(mediaElement);
        track.gainNode = this.audioContext.createGain();
        track.audioNode.connect(track.gainNode);
        track.gainNode.connect(this.previewGain);
    }

    detachTrack(track, emit = true) {
        if (!track) return;
        try { track.media?.pause?.(); } catch (_) { /* no-op */ }
        try { track.soundMedia?.pause?.(); } catch (_) { /* no-op */ }
        try { track.audioNode?.disconnect(); } catch (_) { /* no-op */ }
        try { track.gainNode?.disconnect(); } catch (_) { /* no-op */ }
        for (const element of [track.media, track.soundMedia]) if (element?.parentNode === this.mediaBin) element.remove();
        if (track.objectUrl) URL.revokeObjectURL(track.objectUrl);
        track.media = null; track.soundMedia = null; track.audioNode = null; track.gainNode = null; track.objectUrl = null;
        track.sourceName = ''; track.sourceDuration = 0; track.clipDuration = 0; track.file = null;
        if (emit) { this.emitDuration(); this.renderFrame(); }
    }

    removeTrack(track) { this.detachTrack(track, false); this.tracks = this.tracks.filter((item) => item.id !== track.id); this.emitDuration(); this.renderFrame(); }

    clearAll() { this.pause(); this.tracks.forEach((track) => this.detachTrack(track, false)); this.tracks = []; this.currentTime = 0; this.emitDuration(); this.emitTime(); this.renderFrame(); }

    getAudioFadeGain(track, time = this.currentTime) {
        if (!AUDIO_TYPES.has(track.type)) return 0;
        const duration = Math.max(0, Number(track.clipDuration) || 0);
        const localTime = clamp((Number(time) || 0) - (Number(track.start) || 0), 0, duration);
        const fadeIn = clamp(Number(track.audio?.fadeIn) || 0, 0, duration);
        const fadeOut = clamp(Number(track.audio?.fadeOut) || 0, 0, duration);
        let envelope = 1;
        if (fadeIn > 0) envelope = Math.min(envelope, clamp(localTime / fadeIn, 0, 1));
        if (fadeOut > 0) envelope = Math.min(envelope, clamp((duration - localTime) / fadeOut, 0, 1));
        return envelope;
    }

    syncAudioSettings(time = this.currentTime) {
        for (const track of this.tracks) {
            if (!AUDIO_TYPES.has(track.type) || !track.gainNode) continue;
            const muted = Boolean(track.audio?.muted);
            const volume = clamp(Number(track.audio?.volume ?? 1), 0, 1);
            const envelope = this.isTrackActive(track, time) ? this.getAudioFadeGain(track, time) : 0;
            track.gainNode.gain.value = muted ? 0 : volume * envelope;
        }
    }

    updateAudioFades(time = this.currentTime) {
        this.syncAudioSettings(time);
    }

    setPreviewVolume(value) { this.previewVolume = clamp(Number(value), 0, 1); if (this.previewVolume > 0) this.previewMuted = false; this.applyPreviewGain(); }
    togglePreviewMute() { this.previewMuted = !this.previewMuted; this.applyPreviewGain(); return this.previewMuted; }
    applyPreviewGain() { if (this.previewGain) this.previewGain.gain.value = this.previewMuted ? 0 : this.previewVolume; }

    getCurrentTime() { return !this.isPlaying || !this.audioContext ? this.currentTime : Math.max(0, this.playStartTimeline + (this.audioContext.currentTime - this.playStartClock)); }
    isTrackActive(track, time = this.currentTime) {
        const start = Number(track.start) || 0;
        const duration = Number(track.clipDuration) || 0;
        return Boolean(track.sourceName) && time >= start && time <= start + duration;
    }
    setTrackMediaTime(track, time) {
        const localTime = clamp((Number(track.sourceOffset) || 0) + time - (Number(track.start) || 0), 0, Math.max(0, Number(track.sourceDuration) || 0));
        if (track.type === 'video') {
            try { track.media.currentTime = localTime; } catch (_) { /* no-op */ }
            try { track.soundMedia.currentTime = localTime; } catch (_) { /* no-op */ }
        } else if (track.type === 'audio') {
            try { track.media.currentTime = localTime; } catch (_) { /* no-op */ }
        }
    }

    async play() {
        const playable = this.tracks.filter((track) => AUDIO_TYPES.has(track.type) && this.isTrackActive(track));
        if (!playable.length) throw new Error('Place a video or audio clip on the timeline before pressing Play.');
        await this.ensureAudioGraph();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        const time = this.currentTime;
        for (const track of playable) {
            this.setTrackMediaTime(track, time);
            try {
                if (track.type === 'video') { await track.media.play(); await track.soundMedia.play(); }
                else { await track.media.play(); }
            } catch (error) { console.warn(`Could not play ${track.sourceName}:`, error); }
        }
        this.updateAudioFades(time);
        this.playStartTimeline = time;
        this.playStartClock = this.audioContext.currentTime;
        this.isPlaying = true;
        this.onPlaybackChange?.(true);
        this.startRenderLoop();
    }

    pause() {
        if (this.isPlaying) this.currentTime = this.getCurrentTime();
        this.isPlaying = false;
        this.tracks.forEach((track) => { try { track.media?.pause?.(); track.soundMedia?.pause?.(); } catch (_) { /* no-op */ } });
        this.stopRenderLoop(); this.emitTime(); this.renderFrame(); this.onPlaybackChange?.(false);
    }
    async togglePlay() { if (this.isPlaying) { this.pause(); return false; } await this.play(); return true; }

    async seek(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();
        this.currentTime = clamp(Number(time) || 0, 0, Math.max(0, this.getTimelineDuration()));
        for (const track of this.tracks) if (AUDIO_TYPES.has(track.type) && track.sourceName) this.setTrackMediaTime(track, this.currentTime);
        this.emitTime(); this.renderFrame();
        if (wasPlaying) await this.play();
    }
    async stepFrame(direction = 1) { await this.seek(this.currentTime + direction / 30); }

    startRenderLoop() {
        this.stopRenderLoop();
        const render = () => {
            if (!this.isPlaying) return;
            const duration = this.getTimelineDuration();
            this.currentTime = this.getCurrentTime();
            if (duration > 0 && this.currentTime >= duration) { this.currentTime = duration; this.pause(); return; }
            this.updateAudioFades(this.currentTime); this.emitTime(); this.renderFrame(); this.frameRequest = requestAnimationFrame(render);
        };
        this.frameRequest = requestAnimationFrame(render);
    }
    stopRenderLoop() { if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest); this.frameRequest = null; }

    getVisualTracksTopToBottom() {
        // The returned order describes the visual stack from highest to lowest.
        // renderFrame reverses this to paint the background first, then videos,
        // then Sticker 2 and finally Sticker 1 on top.
        const stickers = this.tracks.filter((track) => track.type === 'sticker').sort((a,b) => a.order - b.order);
        const videos = this.tracks.filter((track) => track.type === 'video').sort((a,b) => a.order - b.order);
        const backgrounds = this.tracks.filter((track) => track.type === 'background').sort((a,b) => a.order - b.order);
        return [...stickers, ...videos, ...backgrounds];
    }
    ensureCanvasSize() {
        if (this.canvas.width !== this.outputWidth || this.canvas.height !== this.outputHeight) {
            this.canvas.width = this.outputWidth;
            this.canvas.height = this.outputHeight;
        }
    }

    renderFrame() {
        try {
            this.ensureCanvasSize();
            const { width, height } = this.canvas;
            this.context.save(); this.context.globalCompositeOperation = 'source-over'; this.context.clearRect(0,0,width,height); this.context.fillStyle='#000'; this.context.fillRect(0,0,width,height);
            const visualTracks = this.getVisualTracksTopToBottom();
            for (const track of [...visualTracks].reverse()) {
                if (!track.media || !this.isTrackActive(track) || track.visible === false) continue;
                this.context.save();
                this.context.globalCompositeOperation = SUPPORTED_BLEND_MODES.has(track.blendMode) ? track.blendMode : 'source-over';
                this.context.globalAlpha = clamp(Number(track.opacity ?? 1), 0, 1);
                if (track.type === 'background') drawCovered(this.context, track.media, width, height);
                if (track.type === 'video' && track.media.readyState >= 2) drawContained(this.context, track.media, width, height);
                if (track.type === 'sticker') this.drawSticker(track, width, height);
                this.context.restore();
            }
            this.context.restore();
        } catch (error) { console.error('Advanced render error:', error); this.onRenderError?.(error); }
    }

    drawSticker(track, width, height) {
        const settings = track.transparency || { mode:'native', keyColour:'#00ff00', tolerance:30, feather:8 };
        if (settings.mode === 'native') { drawContained(this.context, track.media, width, height); return; }
        const sourceWidth = track.media.naturalWidth || track.media.width || 0;
        const sourceHeight = track.media.naturalHeight || track.media.height || 0;
        if (!sourceWidth || !sourceHeight) return;
        const limit=1600, scale=Math.min(1,limit/Math.max(sourceWidth,sourceHeight)), processWidth=Math.max(1,Math.round(sourceWidth*scale)), processHeight=Math.max(1,Math.round(sourceHeight*scale));
        if (this.stickerWorkCanvas.width!==processWidth || this.stickerWorkCanvas.height!==processHeight) { this.stickerWorkCanvas.width=processWidth; this.stickerWorkCanvas.height=processHeight; }
        this.stickerWorkContext.clearRect(0,0,processWidth,processHeight); this.stickerWorkContext.drawImage(track.media,0,0,processWidth,processHeight);
        const imageData=this.stickerWorkContext.getImageData(0,0,processWidth,processHeight), pixels=imageData.data, key=hexToRgb(settings.keyColour), tolerance=clamp(Number(settings.tolerance)||0,0,100)*2.55, feather=Math.max(1,clamp(Number(settings.feather)||0,0,100)*2.55);
        for(let index=0; index<pixels.length; index+=4) {
            const r=pixels[index],g=pixels[index+1],b=pixels[index+2],alpha=pixels[index+3]; let multiplier=1;
            if(settings.mode==='chroma') { const distance=Math.hypot(r-key.r,g-key.g,b-key.b); multiplier=clamp((distance-tolerance)/feather,0,1); }
            else { const luminance=.2126*r+.7152*g+.0722*b; if(settings.mode==='light') multiplier=clamp(((255-tolerance)-luminance)/feather,0,1); if(settings.mode==='dark') multiplier=clamp((luminance-tolerance)/feather,0,1); }
            pixels[index+3]=Math.round(alpha*multiplier);
        }
        this.stickerWorkContext.putImageData(imageData,0,0); drawContained(this.context,this.stickerWorkCanvas,width,height);
    }

    async snapshot() {
        this.renderFrame();
        const blob = await new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG snapshot could not be created.');
        const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download='organon-advanced-composite.png'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    }
    emitTime() { this.onTimeChange?.({ currentTime:this.currentTime, duration:this.getTimelineDuration() }); }
    emitDuration() { this.onDurationChange?.(this.getTimelineDuration()); }
    destroy() { this.clearAll(); try { this.previewGain?.disconnect(); } catch (_) {} this.audioContext?.close?.(); this.analysisContext?.close?.(); }
}
