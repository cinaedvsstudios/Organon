/**
 * ORGANON STUDIO: ADVANCED MEDIA ENGINE
 * v0.15 — adds source offsets for real split clips, audio fade envelopes and lightweight beat/loudness analysis.
 * Video sound is linked to its video clip. It only becomes a movable audio track when explicitly extracted.
 */

import { PlaybackBoundaryTracker, getTrackSourceTime } from './playback-scheduler.mjs';
import { normalizeProjectFps, stepFrameTime, waitForVideoSeek } from './frame-seek.mjs';
import { checkBrowserMediaSupport, waitForMediaReady, mediaFailureMessage } from './media-support.mjs';
import { isPairedFadeActive } from './clip-pair-transitions.mjs';
import { paintPairedEffect, pairedEffectProgress } from './paired-visual-effects.mjs';
import { normalizeTransitionEffectId,normalizeTransitionParameters } from './transition-catalog.mjs';
import { visualFadeOpacity } from './visual-transitions.mjs';
import { applyVisualContext, drawVisualVignette } from './visual-clip-adjustments.mjs';
import { connectOrgavoxAudioChain, ensureOrgavoxLofiWorklet } from './orgavox-audio-chain.mjs';
import { paintTimelineText } from './text-template-renderer.mjs';
import { paintTimelineEffect } from './timeline-effects.mjs';

const VISUAL_TYPES = new Set(['background', 'video', 'sticker']);
const AUDIO_TYPES = new Set(['video', 'audio']);
const SUPPORTED_BLEND_MODES = new Set(['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn']);

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
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
        this.visualStackCache = null;
        this.visualStackCacheKey = '';
        this.stickerEffectCache = new Map();
        this.stickerEffectCacheLimit = 3;
        this.playbackBoundaries = new PlaybackBoundaryTracker();
        this.loadingTracks = new Set();
        this.projectFps = 30;
        this.seekGeneration = 0;
        this.seekController = null;
        this.pendingSeekPromise = null;
        this.resumeAfterSeek = false;
    }

    async ensureAudioGraph() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.previewGain = this.audioContext.createGain();
        this.previewGain.connect(this.audioContext.destination);
        this.applyPreviewGain();
    }

    setProjectFrameRate(fps) {
        this.projectFps = normalizeProjectFps(fps);
        return this.projectFps;
    }

    cancelPendingSeek() {
        this.seekGeneration += 1;
        if (this.seekController) {
            this.seekController.abort();
            this.seekController = null;
        }
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
        this.cancelPendingSeek();
        this.resumeAfterSeek = false;
        const next = Array.isArray(tracks) ? tracks : [];
        // Canonical IDs at the engine boundary also migrate restored legacy Spin clips.
        for (const clip of next) {
            if(!clip || !clip.transitionEffectId)continue;
            clip.transitionEffectId=normalizeTransitionEffectId(clip.transitionEffectId);
            if(clip.transitionParameters)
                clip.transitionParameters=normalizeTransitionParameters(clip.transitionParameters);
        }
        const retained = new Set(next);
        // The controller may replace the array rather than call removeTrack().
        // Dispose every removed clip even when the old array was simply filtered.
        for (const previous of this.tracks) {
            if (!retained.has(previous)) this.detachTrack(previous, false);
        }
        for (const pending of [...this.loadingTracks]) {
            if (!retained.has(pending)) this.detachTrack(pending, false);
        }
        this.tracks = next;
        // A reorder changes the paint stack, even when clip objects are reused.
        this.visualStackCacheKey = '';
        this.visualStackCache = null;
        for (const track of this.stickerEffectCache.keys()) {
            if (!retained.has(track)) this.stickerEffectCache.delete(track);
        }
        if (this.isPlaying && this.getTimelineDuration() <= 0) this.pause();
        else if (this.isPlaying) this.syncPlaybackAtTime(this.currentTime);
        else this.syncAudioSettings(this.currentTime);
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
        const loadController = new AbortController();
        track.loadController = loadController;
        this.loadingTracks.add(track);
        track.file = file;
        track.sourceOffset = Math.max(0, Number(track.sourceOffset) || 0);
        try {
            track.objectUrl = URL.createObjectURL(file);
            track.sourceName = file.name;
            track.fileType = file.type;
            if (track.type === 'sticker' || track.type === 'background') {
                const image = new Image();
                image.decoding = 'async';
                image.src = track.objectUrl;
                track.media = image;
                await waitForMediaReady(image, 'load', { signal:loadController.signal, timeoutMs:15000, label:file.name });
                track.sourceDuration = 300;
                if (!Number(track.clipDuration)) track.clipDuration = 3;
            } else if (track.type === 'video') {
                const visual = document.createElement('video');
                checkBrowserMediaSupport(visual, file);
                // Picture and sound share one media clock; Web Audio retains
                // per-clip volume, mute and fade controls.
                visual.preload = 'auto'; visual.playsInline = true;
                visual.muted = false; visual.volume = 1;
                visual.playbackRate = Math.min(4,Math.max(.25,Number(track.speed)||1)); visual.src = track.objectUrl;
                this.mediaBin.appendChild(visual);
                track.media = visual;
                await waitForMediaReady(visual, 'loadedmetadata', { signal:loadController.signal, label:file.name });
                await waitForMediaReady(visual, 'loadeddata', { signal:loadController.signal, label:file.name });
                track.sourceDuration = Number.isFinite(visual.duration) ? visual.duration : 0;
                if (!Number(track.clipDuration)) track.clipDuration = track.sourceDuration || 1;
                await this.connectAudioTrack(track, visual);
            } else if (track.type === 'audio') {
                const audio = document.createElement('audio');
                checkBrowserMediaSupport(audio, file, { audioFromVideo:track.type === 'audio' });
                audio.preload = 'auto'; audio.playbackRate = Math.min(4,Math.max(.25,Number(track.speed)||1)); audio.src = track.objectUrl;
                this.mediaBin.appendChild(audio);
                track.media = audio;
                await waitForMediaReady(audio, 'loadedmetadata', { signal:loadController.signal, label:file.name });
                track.sourceDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
                if (!Number(track.clipDuration)) track.clipDuration = track.sourceDuration || 1;
                await this.connectAudioTrack(track, audio);
            }
            if (loadController.signal.aborted) throw new Error('Media loading was cancelled.');
            if (track.type === 'video' || track.type === 'audio') {
                const playingMedia = track.media;
                track.mediaErrorHandler = () => {
                    if (track.media !== playingMedia) return;
                    this.stopTrackMedia(track);
                    this.onRenderError?.(new Error(mediaFailureMessage(playingMedia, track.sourceName)));
                };
                playingMedia.addEventListener('error', track.mediaErrorHandler);
            }
        } catch (error) {
            // An older cancelled load must never destroy a newer load of the
            // same timeline object.
            if (track.loadController === loadController) this.detachTrack(track, false);
            throw error;
        } finally {
            if (track.loadController === loadController) {
                track.loadController = null;
                this.loadingTracks.delete(track);
            }
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
            if (track.file !== file || !this.tracks.includes(track)) return null;
            track.analysis = { levels, sampleCount: bucketCount, analysed: true };
            return track.analysis;
        } catch (error) {
            console.warn(`Could not analyse ${file.name || 'audio'}:`, error);
            if (track.file === file && this.tracks.includes(track)) track.analysis = null;
            return null;
        }
    }

    async connectAudioTrack(track, mediaElement) {
        await this.ensureAudioGraph();
        track.audioNode = this.audioContext.createMediaElementSource(mediaElement);
        track.gainNode = this.audioContext.createGain();
        track.gainNode.connect(this.previewGain);
        await this.refreshOrgavoxAudioEffects(track);
    }

    async refreshOrgavoxAudioEffects(track) {
        if (!track?.audioNode || !track.gainNode || !this.audioContext) return;
        const signature=JSON.stringify(track.audio?.fx || {});
        if (track.orgavoxFxSignature===signature && track.orgavoxFxNodes?.length) return;
        // Loading a worklet is asynchronous. The selected preset may have
        // changed while loading, so don't install stale processing nodes.
        await ensureOrgavoxLofiWorklet(this.audioContext,track.audio?.fx);
        if(!track.audioNode || !track.gainNode || signature!==JSON.stringify(track.audio?.fx || {}))return;
        try { track.audioNode.disconnect(); } catch (_) {}
        for (const node of track.orgavoxFxNodes || []) {
            try { node.disconnect(); } catch (_) {}
        }
        const chain=connectOrgavoxAudioChain(this.audioContext,track.gainNode,track.audio?.fx,track.audioNode);
        track.orgavoxFxNodes=chain.nodes;
        track.orgavoxFxSignature=signature;
    }

    detachTrack(track, emit = true) {
        if (!track) return;
        if (track.loadController) {
            track.loadController.abort();
            track.loadController = null;
        }
        this.loadingTracks.delete(track);
        this.stickerEffectCache.delete(track);
        this.stopTrackMedia(track);
        if (track.mediaErrorHandler && track.media?.removeEventListener) {
            track.media.removeEventListener('error', track.mediaErrorHandler);
        }
        track.mediaErrorHandler = null;
        for (const node of [track.audioNode,...(track.orgavoxFxNodes || []),track.gainNode]) {
            try { node?.disconnect?.(); } catch (_) { /* already disconnected */ }
        }
        track.orgavoxFxNodes=[];
        for (const element of [track.media, track.soundMedia]) {
            if (!element) continue;
            try {
                if (typeof element.removeAttribute === 'function') element.removeAttribute('src');
                if (typeof element.load === 'function') element.load();
                if (element.parentNode === this.mediaBin) element.remove();
            } catch (error) {
                console.warn('Could not release MotoriClip media element:', error);
            }
        }
        if (track.objectUrl) {
            try { URL.revokeObjectURL(track.objectUrl); } catch (_) { /* already revoked */ }
        }
        track.media = null; track.soundMedia = null; track.audioNode = null; track.gainNode = null; track.orgavoxFxNodes = []; track.orgavoxFxSignature = null; track.objectUrl = null;
        track.sourceName = ''; track.sourceDuration = 0; track.clipDuration = 0; track.file = null;
        if (emit) { this.emitDuration(); this.renderFrame(); }
    }

    removeTrack(track) { this.setTracks(this.tracks.filter((item) => item !== track)); }

    clearAll() {
        this.pause();
        const loading = [...this.loadingTracks];
        this.setTracks([]);
        for (const track of loading) this.detachTrack(track, false);
        // Drop any 1080p+ offscreen transition textures when a project clears.
        for(const name of ['transitionPixelScratch','transitionFullScratch',
            'spiralBlockFromScratch','spiralBlockToScratch','hologramFromScratch','hologramToScratch',
            'cellDissolveFromScratch','cellDissolveToScratch',
            'vortexFromScratch','vortexToScratch',
            'crumpleFromScratch','crumpleToScratch',
            'liquidFillFromScratch','liquidFillToScratch',
            'heatHazeFromScratch','heatHazeToScratch',
            'sphereFromScratch','sphereToScratch',
            'ringsWipeFromScratch','ringsWipeToScratch',
            'snapshotFromScratch','snapshotToScratch',
            'colorPanelWipeFromScratch','colorPanelWipeToScratch',
            'galleryFromScratch','galleryToScratch',
            'vhsTrackingFromScratch','vhsTrackingToScratch',
            'cardSwipeFromScratch','cardSwipeToScratch',
            'cameraShakeFromScratch','cameraShakeToScratch',
            'smokeDissolveFromScratch','smokeDissolveToScratch',
            'splatterWipeFromScratch','splatterWipeToScratch',
            'inkBleedFromScratch','inkBleedToScratch',
            'refractionFromScratch','refractionToScratch',
            'whipSpinFromScratch','whipSpinToScratch',
            'bloomDissolveFromScratch','bloomDissolveToScratch',
            'bokehDissolveFromScratch','bokehDissolveToScratch',
            'lightRaysFromScratch','lightRaysToScratch',
            'blockCoverFromScratch','blockCoverToScratch',
            'disintegrateFromScratch','disintegrateToScratch',
            'asciiFromScratch','asciiToScratch',
            'filmStripFromScratch','filmStripToScratch']){
            if(this[name]){ this[name].width=0; this[name].height=0; this[name]=null; }
        }
        if(this.spiralBlockWebGL){
            this.spiralBlockWebGL.dispose();
            this.spiralBlockWebGL=null;
        }
        if(this.hologramWebGL){
            this.hologramWebGL.dispose();
            this.hologramWebGL=null;
        }
        if(this.cellDissolveWebGL){
            this.cellDissolveWebGL.dispose();
            this.cellDissolveWebGL=null;
        }
        if(this.vortexWebGL){
            this.vortexWebGL.dispose();
            this.vortexWebGL=null;
        }
        if(this.crumpleWebGL){
            this.crumpleWebGL.dispose();
            this.crumpleWebGL=null;
        }
        if(this.liquidFillWebGL){
            this.liquidFillWebGL.dispose();
            this.liquidFillWebGL=null;
        }
        if(this.heatHazeWebGL){
            this.heatHazeWebGL.dispose();
            this.heatHazeWebGL=null;
        }
        if(this.sphereWebGL){
            this.sphereWebGL.dispose();
            this.sphereWebGL=null;
        }
        if(this.ringsWipeWebGL){
            this.ringsWipeWebGL.dispose();
            this.ringsWipeWebGL=null;
        }
        if(this.snapshotWebGL){
            this.snapshotWebGL.dispose();
            this.snapshotWebGL=null;
        }
        if(this.colorPanelWipeWebGL){
            this.colorPanelWipeWebGL.dispose();
            this.colorPanelWipeWebGL=null;
        }
        if(this.galleryWebGL){
            this.galleryWebGL.dispose();
            this.galleryWebGL=null;
        }
        if(this.vhsTrackingWebGL){
            this.vhsTrackingWebGL.dispose();
            this.vhsTrackingWebGL=null;
        }
        if(this.cardSwipeWebGL){
            this.cardSwipeWebGL.dispose();
            this.cardSwipeWebGL=null;
        }
        if(this.cameraShakeWebGL){
            this.cameraShakeWebGL.dispose();
            this.cameraShakeWebGL=null;
        }
        if(this.smokeDissolveWebGL){
            this.smokeDissolveWebGL.dispose();
            this.smokeDissolveWebGL=null;
        }
        if(this.splatterWipeWebGL){
            this.splatterWipeWebGL.dispose();
            this.splatterWipeWebGL=null;
        }
        if(this.inkBleedWebGL){
            this.inkBleedWebGL.dispose();
            this.inkBleedWebGL=null;
        }
        if(this.refractionWebGL){
            this.refractionWebGL.dispose();
            this.refractionWebGL=null;
        }
        if(this.whipSpinWebGL){
            this.whipSpinWebGL.dispose();
            this.whipSpinWebGL=null;
        }
        if(this.bloomDissolveWebGL){
            this.bloomDissolveWebGL.dispose();
            this.bloomDissolveWebGL=null;
        }
        if(this.bokehDissolveWebGL){
            this.bokehDissolveWebGL.dispose();
            this.bokehDissolveWebGL=null;
        }
        if(this.lightRaysWebGL){
            this.lightRaysWebGL.dispose();
            this.lightRaysWebGL=null;
        }
        if(this.blockCoverWebGL){
            this.blockCoverWebGL.dispose();
            this.blockCoverWebGL=null;
        }
        if(this.disintegrateWebGL){
            this.disintegrateWebGL.dispose();
            this.disintegrateWebGL=null;
        }
        if(this.asciiWebGL){
            this.asciiWebGL.dispose();
            this.asciiWebGL=null;
        }
        if(this.filmStripWebGL){
            this.filmStripWebGL.dispose();
            this.filmStripWebGL=null;
        }
        this.currentTime = 0;
        this.emitDuration(); this.emitTime(); this.renderFrame();
    }

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
            const muted = Boolean(track.audio?.muted || track.visible === false);
            const volume = clamp(Number(track.audio?.volume ?? 1), 0, 1) + clamp(Number(track.audio?.gain ?? 0), 0, 200) / 100;
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
        return Boolean(track.sourceName) && duration > 0 && time >= start && time < start + duration;
    }
    setTrackMediaTime(track, time) {
        const localTime = getTrackSourceTime(track, time);
        if(track.media && 'playbackRate' in track.media)track.media.playbackRate=Math.min(4,Math.max(.25,Number(track.speed)||1));
        if (track.type === 'video') {
            try { if (track.media) track.media.currentTime = localTime; } catch (_) { /* no-op */ }
        } else if (track.type === 'audio') {
            try { track.media.currentTime = localTime; } catch (_) { /* no-op */ }
        }
    }

    stopTrackMedia(track, media = track?.media, soundMedia = track?.soundMedia) {
        for (const element of [media, soundMedia]) {
            try { element?.pause?.(); } catch (error) {
                console.warn('Could not pause a MotoriClip media element:', error);
            }
        }
    }

    startTrackMedia(track, time) {
        // Always align a newly activated clip to its own source offset.
        // Start both video and linked sound without sequential awaits.
        this.setTrackMediaTime(track, time);
        const players = [track.media];
        for (const player of players) {
            if (!player) continue;
            try {
                const started = player.play();
                if (started && typeof started.catch === 'function') {
                    started.catch((error) => {
                        if (this.isPlaying && this.isTrackActive(track, this.currentTime)) {
                            console.warn(`Could not start ${track.sourceName}:`, error);
                            this.onRenderError?.(new Error(`Playback failed for ${track.sourceName}: ${error?.message || 'Browser blocked this media.'}`));
                        }
                    });
                }
            } catch (error) {
                console.warn(`Could not start ${track.sourceName}:`, error);
                this.onRenderError?.(new Error(`Playback failed for ${track.sourceName}: ${error?.message || 'Browser blocked this media.'}`));
            }
        }
    }

    syncPlaybackAtTime(time) {
        this.playbackBoundaries.update(
            this.tracks,
            time,
            (track) => this.startTrackMedia(track, time),
            (track, media, soundMedia) => this.stopTrackMedia(track, media, soundMedia)
        );
        this.syncAudioSettings(time);
    }

    async play({ skipSeekWait = false } = {}) {
        if (!skipSeekWait && this.pendingSeekPromise) await this.pendingSeekPromise;
        const duration = this.getTimelineDuration();
        if (duration <= 0) throw new Error('Place a video, audio or image clip on the timeline before pressing Play.');
        if (this.isPlaying) return;
        if (this.currentTime >= duration) this.currentTime = 0;

        await this.ensureAudioGraph();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        // The composition clock runs even when the first clip starts later.
        this.playStartTimeline = this.currentTime;
        this.playStartClock = this.audioContext.currentTime;
        this.isPlaying = true;
        this.syncPlaybackAtTime(this.currentTime);
        this.onPlaybackChange?.(true);
        this.startRenderLoop();
        this.emitTime();
        this.renderFrame();
    }

    pause() {
        this.cancelPendingSeek();
        this.resumeAfterSeek = false;
        if (this.isPlaying) this.currentTime = clamp(this.getCurrentTime(), 0, this.getTimelineDuration());
        this.isPlaying = false;
        this.playbackBoundaries.reset((track, media, soundMedia) => this.stopTrackMedia(track, media, soundMedia));
        this.tracks.forEach((track) => this.stopTrackMedia(track));
        this.stopRenderLoop();
        this.emitTime();
        this.renderFrame();
        this.onPlaybackChange?.(false);
    }
    async togglePlay() { if (this.isPlaying) { this.pause(); return false; } await this.play(); return true; }

    seek(time, { resume = true } = {}) {
        // Capture playback intent before pausing. Slider 'input' scrubs without
        // resuming; its final 'change' resumes if playback was active beforehand.
        const shouldResume = this.isPlaying || this.resumeAfterSeek;
        if (this.isPlaying) this.pause();
        this.cancelPendingSeek();
        this.resumeAfterSeek = shouldResume;

        const generation = this.seekGeneration;
        const controller = new AbortController();
        this.seekController = controller;
        const duration = this.getTimelineDuration();
        this.currentTime = clamp(Number(time) || 0, 0, duration);
        const destination = this.currentTime;

        const pending = (async () => {
            const videoFrames = [];
            for (const track of this.tracks) {
                if (!AUDIO_TYPES.has(track.type) || !track.sourceName || !this.isTrackActive(track, destination)) continue;
                const sourceTime = getTrackSourceTime(track, destination);
                if (track.type === 'video') {
                    // Avoid decoding dozens of inactive/off-screen videos during scrubbing.
                    if (track.media && track.visible !== false) {
                        videoFrames.push(waitForVideoSeek(track.media, sourceTime, { signal: controller.signal }));
                    }
                    // No separate sound player: the video supplies both clocks.
                } else {
                    this.setTrackMediaTime(track, destination);
                }
            }
            this.syncAudioSettings(destination);
            this.emitTime();
            let results;
            try {
                results = await Promise.all(videoFrames);
            } catch (error) {
                if (generation === this.seekGeneration) this.resumeAfterSeek = false;
                throw error;
            }
            if (controller.signal.aborted || generation !== this.seekGeneration || results.some((ready) => !ready)) return false;
            this.renderFrame(); // Never draw a stale, pre-seek video frame.
            if (resume && this.resumeAfterSeek) {
                this.resumeAfterSeek = false;
                if (destination < duration) await this.play({ skipSeekWait: true });
            } else if (resume) {
                this.resumeAfterSeek = false;
            }
            return true;
        })();

        this.pendingSeekPromise = pending;
        void pending.finally(() => {
            if (this.pendingSeekPromise === pending) this.pendingSeekPromise = null;
            if (this.seekController === controller) this.seekController = null;
        }).catch(() => {});
        return pending;
    }

    async stepFrame(direction = 1) {
        // A manual frame step always stops playback, including pending auto-resume.
        if (this.isPlaying) this.pause();
        this.resumeAfterSeek = false;
        const target = stepFrameTime(this.currentTime, direction, this.projectFps, this.getTimelineDuration());
        return this.seek(target, { resume: false });
    }

    startRenderLoop() {
        this.stopRenderLoop();
        const render = () => {
            if (!this.isPlaying) return;
            const duration = this.getTimelineDuration();
            const nextTime = this.getCurrentTime();
            if (duration > 0 && nextTime >= duration) {
                this.currentTime = duration;
                this.pause();
                return;
            }
            this.currentTime = nextTime;
            this.syncPlaybackAtTime(this.currentTime);
            this.emitTime();
            this.renderFrame();
            this.frameRequest = requestAnimationFrame(render);
        };
        this.frameRequest = requestAnimationFrame(render);
    }
    stopRenderLoop() { if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest); this.frameRequest = null; }

    getVisualTracksTopToBottom() {
        // Most preview frames keep the same layer order. Clip timing, opacity,
        // mute, visibility and media frames do not alter paint-stack sorting.
        // The signature also catches live order edits before setTracks().
        const signature = this.tracks.map((track) => `${track.id}:${track.type}:${track.order}:${track.transitionFromId||''}`).join('|');
        if (this.visualStackCache && this.visualStackCacheKey === signature) return this.visualStackCache;
        const stickers = this.tracks.filter((track) => track.type === 'sticker').sort((a,b) => a.order - b.order);
        const videos = this.tracks.filter((track) => track.type === 'video').sort((a,b) => a.order - b.order);
        const backgrounds = this.tracks.filter((track) => track.type === 'background').sort((a,b) => a.order - b.order);
        this.visualStackCacheKey = signature;
        const stack = [...stickers, ...videos, ...backgrounds];
        // A paired still-image B must render above its A even if B normally
        // lives in the background group. Keep other layer ordering intact.
        for (const incoming of [...stack]) {
            if (!incoming.transitionFromId) continue;
            const a = stack.findIndex(item => item.id === incoming.transitionFromId);
            const b = stack.indexOf(incoming);
            if (a >= 0 && b > a) {
                stack.splice(b, 1);
                stack.splice(a, 0, incoming);
            }
        }
        this.visualStackCache = stack;
        return stack;
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
            this.context.save();
            try {
                this.context.globalCompositeOperation = 'source-over';
                this.context.clearRect(0, 0, width, height);
                this.context.fillStyle = '#000';
                this.context.fillRect(0, 0, width, height);
                // A true two-texture shader replaces A and B together. Do not
                // draw A beforehand or semi-transparent pixels get composited
                // twice over the underlying layers.
                const shaderReplacedSources=new Set();
                for(const incoming of this.tracks){
                    if(!['spiralblockwipe','hologram','cell-dissolve','vortex','crumple','liquid-fill','heat-haze','sphere','rings-wipe','snapshot','color-panel-wipe','gallery','vhs-tracking','card-swipe','camera-shake','smoke-dissolve','splatter-wipe','ink-bleed','refraction','whipspin','bloom-dissolve','bokeh-dissolve','light-rays','block-cover','disintegrate','ascii','film-strip'].includes(normalizeTransitionEffectId(incoming.transitionEffectId))
                        ||!incoming.media||incoming.visible===false
                        ||!this.isTrackActive(incoming)
                        ||!isPairedFadeActive(incoming,this.tracks))continue;
                    const amount=pairedEffectProgress(incoming,this.currentTime);
                    const outgoing=this.tracks.find(t=>t.id===incoming.transitionFromId);
                    if(amount>0&&amount<1&&outgoing?.media
                        &&(outgoing.media.readyState===undefined||outgoing.media.readyState>=2))
                        shaderReplacedSources.add(outgoing.id);
                }
                for (const track of [...this.getVisualTracksTopToBottom()].reverse()) {
                    if(shaderReplacedSources.has(track.id))continue;
                    if (!track.media || !this.isTrackActive(track) || track.visible === false
                        || Number(track.opacity ?? 1) <= 0) continue;
                    this.context.save();
                    try {
                        this.context.globalCompositeOperation = SUPPORTED_BLEND_MODES.has(track.blendMode) ? track.blendMode : 'source-over';
                        const pairedSpatial = VISUAL_TYPES.has(track.type) && track.transitionEffectId !== 'fade'
                            && isPairedFadeActive(track,this.tracks);
                        this.context.globalAlpha = clamp(Number(track.opacity ?? 1), 0, 1)
                            * visualFadeOpacity(track, this.currentTime, {ignoreEnter:pairedSpatial});
                        applyVisualContext(this.context,track,this.currentTime,width,height);
                        if (track.media.readyState === undefined || track.media.readyState >= 2) {
                            const painted = pairedSpatial && paintPairedEffect(this,this.context,track,width,height,this.currentTime,drawContained);
                            if (!painted) {
                                if (track.type === 'background') drawCovered(this.context, track.media, width, height);
                                else if (track.type === 'video') drawContained(this.context, track.media, width, height);
                                else if (track.type === 'sticker') {
                                    if(track.effectOverlay){
                                        // Identical absolute clip time for preview and video export.
                                        paintTimelineEffect(this.context,width,height,track.effectOverlay,
                                            Math.max(0,this.currentTime-(Number(track.start)||0)),track.clipDuration);
                                    } else if(track.textOverlay){
                                        // Live and fixed-frame exporters both use renderFrame().
                                        // Text is drawn at the exact clip-relative timestamp,
                                        // never frozen into its thumbnail PNG.
                                        paintTimelineText(this.context,width,height,track.textOverlay,
                                            Math.max(0,this.currentTime-(Number(track.start)||0)),track.clipDuration);
                                    } else this.drawSticker(track, width, height);
                                }
                            }
                            if(track.type!=='sticker'&&!(pairedSpatial&&['spiralblockwipe','hologram','cell-dissolve','vortex','crumple','liquid-fill','heat-haze','sphere','rings-wipe','snapshot','color-panel-wipe','gallery','vhs-tracking','card-swipe','camera-shake','smoke-dissolve','splatter-wipe','ink-bleed','refraction','whipspin','bloom-dissolve','bokeh-dissolve','light-rays','block-cover','disintegrate','ascii','film-strip'].includes(normalizeTransitionEffectId(track.transitionEffectId))))
                                drawVisualVignette(this.context,track,this.currentTime,width,height);
                        }
                    } catch (error) {
                        // Do not break the entire composite because one layer
                        // has an undecodable or temporarily unavailable frame.
                        console.warn(`Could not render ${track.sourceName || track.type}:`, error);
                        this.onRenderError?.(new Error(`Could not render ${track.sourceName || track.type}: ${error.message}`));
                    } finally {
                        this.context.restore();
                    }
                }
            } finally {
                this.context.restore();
            }
        } catch (error) { console.error('Advanced render error:', error); this.onRenderError?.(error); }
    }

    drawSticker(track, width, height) {
        const settings = track.transparency || { mode:'native', keyColour:'#00ff00', tolerance:30, feather:8 };
        if (settings.mode === 'native') {
            drawContained(this.context, track.media, width, height);
            return;
        }
        const sourceWidth = track.media.naturalWidth || track.media.width || 0;
        const sourceHeight = track.media.naturalHeight || track.media.height || 0;
        if (!sourceWidth || !sourceHeight) return;
        const limit = 1600;
        const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
        const processWidth = Math.max(1, Math.round(sourceWidth * scale));
        const processHeight = Math.max(1, Math.round(sourceHeight * scale));
        const signature = [settings.mode, settings.keyColour, settings.tolerance, settings.feather, processWidth, processHeight].join('|');
        // GIF/WebP may animate. Always reprocess those instead of freezing the
        // first keyed frame in the cache.
        const dynamic = /image\/(gif|webp)/i.test(track.fileType || '')
            || /\.(gif|webp)$/i.test(track.sourceName || '');
        const cached = !dynamic ? this.stickerEffectCache.get(track) : null;
        if (cached && cached.media === track.media && cached.signature === signature) {
            this.stickerEffectCache.delete(track);
            this.stickerEffectCache.set(track, cached); // bounded LRU
            drawContained(this.context, cached.canvas, width, height);
            return;
        }

        const processed = document.createElement('canvas');
        processed.width = processWidth;
        processed.height = processHeight;
        const workContext = processed.getContext('2d', { willReadFrequently:true });
        if (!workContext) throw new Error('Could not create sticker-processing canvas.');
        workContext.drawImage(track.media, 0, 0, processWidth, processHeight);
        const imageData = workContext.getImageData(0,0,processWidth,processHeight);
        const pixels = imageData.data;
        const key = hexToRgb(settings.keyColour);
        const tolerance = clamp(Number(settings.tolerance)||0,0,100)*2.55;
        const feather = Math.max(1,clamp(Number(settings.feather)||0,0,100)*2.55);
        for (let index=0; index<pixels.length; index+=4) {
            const r=pixels[index],g=pixels[index+1],b=pixels[index+2],alpha=pixels[index+3];
            let multiplier=1;
            if (settings.mode==='chroma') {
                const distance=Math.hypot(r-key.r,g-key.g,b-key.b);
                multiplier=clamp((distance-tolerance)/feather,0,1);
            } else {
                const luminance=.2126*r+.7152*g+.0722*b;
                if (settings.mode==='light') multiplier=clamp(((255-tolerance)-luminance)/feather,0,1);
                if (settings.mode==='dark') multiplier=clamp((luminance-tolerance)/feather,0,1);
            }
            pixels[index+3]=Math.round(alpha*multiplier);
        }
        workContext.putImageData(imageData,0,0);
        if (!dynamic) {
            this.stickerEffectCache.delete(track);
            this.stickerEffectCache.set(track, {media:track.media,signature,canvas:processed});
            while (this.stickerEffectCache.size > this.stickerEffectCacheLimit) {
                this.stickerEffectCache.delete(this.stickerEffectCache.keys().next().value);
            }
        } else {
            this.stickerEffectCache.delete(track);
        }
        drawContained(this.context,processed,width,height);
    }

    async snapshot(format='png') {
        // PNG is lossless; JPEG is smaller and uses 92% browser encoder quality.
        // Both must capture the same latest *composited* timeline frame.
        const supported={png:{mime:'image/png',extension:'png'},
            jpeg:{mime:'image/jpeg',extension:'jpg',quality:.92}};
        const option=supported[format];
        if(!option)throw new Error('Snapshot format must be PNG or JPEG.');
        // A snapshot requested immediately after scrubbing must wait until the
        // *latest* decoded still frame, never a previous seek's canvas contents.
        while (this.pendingSeekPromise) {
            const pending = this.pendingSeekPromise;
            await pending;
            if (this.pendingSeekPromise === pending) break;
        }
        if (!this.isPlaying) await this.seek(this.currentTime, { resume: false });
        else this.renderFrame();
        const blob=await new Promise(resolve=>this.canvas.toBlob(resolve,option.mime,option.quality));
        if(!blob || blob.type!==option.mime)
            throw new Error(`${option.extension.toUpperCase()} snapshot could not be encoded in this browser.`);
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.download=`motoriclip-frame.${option.extension}`;
        link.href=url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Some browsers begin an anchor download asynchronously.
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        return {type:blob.type,size:blob.size,width:this.canvas.width,height:this.canvas.height};
    }
    emitTime() { this.onTimeChange?.({ currentTime:this.currentTime, duration:this.getTimelineDuration() }); }
    emitDuration() { this.onDurationChange?.(this.getTimelineDuration()); }
    destroy() { this.cancelPendingSeek(); this.clearAll(); try { this.previewGain?.disconnect(); } catch (_) {} this.audioContext?.close?.(); this.analysisContext?.close?.(); }
}
