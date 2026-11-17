/**
 * MotoriClip Phase 6C — opt-in fixed-timestamp render, using Mediabunny 1.66.0.
 * The original real-time MediaRecorder exporter remains the default.
 * This beta exporter never plays the timeline or modifies existing players.
 */
const MEDIABUNNY_MODULE = 'https://cdn.jsdelivr.net/npm/mediabunny@1.66.0/+esm';
const AAC_ENCODER_MODULE = 'https://esm.sh/@mediabunny/aac-encoder@1.66.0?external=mediabunny';
const AUDIO_RATE = 48000;
export const OFFLINE_EXPORT_LIMIT_SECONDS = 120;
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function offlineFrameSchedule(duration, fps) {
    const length = Number(duration), rate = Number(fps);
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('A positive project duration and frame rate are required.');
    }
    const frames = Math.ceil(length * rate - 1e-8);
    return Array.from({ length: frames }, (_, index) => ({
        index, time: index / rate, duration: Math.min(1 / rate, length - index / rate),
    }));
}

export function clipAtTime(track, time) {
    return Boolean(track?.sourceName && track.file)
        && Number(track.clipDuration) > 0
        && time >= (Number(track.start) || 0)
        && time < (Number(track.start) || 0) + Number(track.clipDuration);
}

export function clipSourceTime(track, time) {
    return Math.max(0, Number(track.sourceOffset) || 0)
        + Math.max(0, time - (Number(track.start) || 0));
}

export function clipAudioEnvelope(track, localTime) {
    const duration = Math.max(0, Number(track.clipDuration) || 0);
    const local = clamp(localTime, 0, duration);
    const fadeIn = clamp(track.audio?.fadeIn, 0, duration);
    const fadeOut = clamp(track.audio?.fadeOut, 0, duration);
    let value = 1;
    if (fadeIn) value = Math.min(value, local / fadeIn);
    if (fadeOut) value = Math.min(value, (duration - local) / fadeOut);
    return Math.max(0, value);
}

export function fadeBreakpoints(track) {
    const d = Math.max(0, Number(track.clipDuration) || 0);
    const fadeIn = clamp(track.audio?.fadeIn, 0, d);
    const fadeOut = clamp(track.audio?.fadeOut, 0, d);
    const positions = new Set([0, d]);
    if (fadeIn) positions.add(fadeIn);
    if (fadeOut) positions.add(d - fadeOut);
    if (fadeIn && fadeOut && fadeIn + fadeOut > d) {
        positions.add(fadeIn * d / (fadeIn + fadeOut));
    }
    return [...positions].filter(t => t >= 0 && t <= d).sort((a,b) => a-b);
}

function offlineAudioTracks(tracks) {
    return tracks.filter(track => ['video','audio'].includes(track.type)
        && track.file && track.sourceName
        && Number(track.clipDuration) > 0
        && track.audio?.muted !== true
        && Number(track.audio?.volume ?? 1) > 0);
}

export class AdvancedOfflineExporter {
    constructor({ engine, onProgress, onState, onDownload, libraryLoader, aacEncoderLoader, renderEngineFactory } = {}) {
        this.engine = engine;
        this.onProgress = onProgress;
        this.onState = onState;
        this.onDownload = onDownload;
        this.libraryLoader = libraryLoader || (() => import(MEDIABUNNY_MODULE));
        this.aacEncoderLoader = aacEncoderLoader || (() => import(AAC_ENCODER_MODULE));
        this.renderEngineFactory = renderEngineFactory || ((canvas) => new engine.constructor({
            canvas, mediaBin: document.createElement('div'),
            onTimeChange(){}, onDurationChange(){}, onPlaybackChange(){},
            onRenderError(error){ throw error; },
        }));
        this.busy = false;
        this.controller = null;
        this.inputs = new Map();
        this.output = null;
    }

    getAvailable() {
        return typeof VideoEncoder !== 'undefined'
            && typeof VideoDecoder !== 'undefined'
            && typeof OfflineAudioContext !== 'undefined';
    }

    status(phase, message) { this.onState?.({ phase, message }); }
    progress(current, duration) {
        const percent = Math.min(100, Math.max(0, 100 * current / duration));
        this.onProgress?.({ current, duration, percent });
    }
    assertActive() {
        if (this.controller?.signal.aborted) throw new Error('Export cancelled.');
    }

    async mediaInput(MB, file) {
        let result = this.inputs.get(file);
        if (result) return result;
        const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
        this.inputs.set(file, input);
        if (!await input.canRead()) throw new Error('Cannot decode ' + (file?.name || 'a media file') + ' with Mediabunny.');
        this.assertActive();
        return input;
    }

    async videoSinks(MB, tracks) {
        const sinks = new Map();
        for (const track of tracks) {
            if (track.type !== 'video' || track.visible === false || Number(track.opacity ?? 1) <= 0) continue;
            const input = await this.mediaInput(MB, track.file);
            const video = await input.getPrimaryVideoTrack();
            if (!video || !await video.canDecode()) {
                throw new Error('Cannot decode video for ' + track.sourceName + ' with WebCodecs.');
            }
            sinks.set(track.id, new MB.CanvasSink(video));
        }
        return sinks;
    }

    async mixAudio(MB, tracks, duration) {
        const audible = offlineAudioTracks(tracks);
        if (!audible.length) return null;
        const offline = new OfflineAudioContext(2, Math.ceil(duration * AUDIO_RATE), AUDIO_RATE);
        let scheduled = 0;
        for (const track of audible) {
            this.assertActive();
            const input = await this.mediaInput(MB, track.file);
            const audioTrack = await input.getPrimaryAudioTrack();
            if (!audioTrack) {
                if (track.type === 'audio') throw new Error('This audio layer has no decodable audio: ' + track.sourceName);
                continue; // Silent video: keep its image without adding fake sound.
            }
            if (!await audioTrack.canDecode()) throw new Error('Cannot decode audio in ' + track.sourceName);
            const gain = offline.createGain();
            gain.connect(offline.destination);
            const volume = clamp(track.audio?.volume ?? 1, 0, 1);
            const start = Math.max(0, Number(track.start) || 0);
            const end = Math.min(duration, start + (Number(track.clipDuration) || 0));
            if (end <= start) continue;
            const sourceStart = Math.max(0, Number(track.sourceOffset) || 0);
            const localEnd = end - start;
            const points = fadeBreakpoints(track).filter(t => t <= localEnd);
            if (!points.includes(localEnd)) points.push(localEnd);
            gain.gain.setValueAtTime(volume * clipAudioEnvelope(track, 0), start);
            for (const point of points) {
                if (point > 0) gain.gain.linearRampToValueAtTime(
                    volume * clipAudioEnvelope(track, point), start + point);
            }
            const sink = new MB.AudioBufferSink(audioTrack);
            // Read a small lead-in so the first returned chunk spanning a
            // trimmed in-point isn't silently skipped.
            const from = Math.max(0, sourceStart - 1);
            const to = sourceStart + localEnd;
            for await (const wrapped of sink.buffers(from, to)) {
                this.assertActive();
                if (!wrapped?.buffer) continue;
                const chunkStart = Number(wrapped.timestamp) || 0;
                const chunkEnd = chunkStart + wrapped.buffer.duration;
                const overlapStart = Math.max(chunkStart, sourceStart);
                const overlapEnd = Math.min(chunkEnd, to);
                if (overlapEnd - overlapStart <= 1 / AUDIO_RATE) continue;
                const position = start + overlapStart - sourceStart;
                const node = offline.createBufferSource();
                node.buffer = wrapped.buffer;
                node.connect(gain);
                node.start(position, overlapStart - chunkStart, overlapEnd - overlapStart);
                scheduled += 1;
            }
        }
        if (!scheduled) return null;
        this.assertActive();
        return offline.startRendering();
    }

    async ensureAacEncoder(MB) {
        if (typeof MB.canEncodeAudio !== 'function') return;
        const encoding = { numberOfChannels:2, sampleRate:AUDIO_RATE, bitrate:192000 };
        if (await MB.canEncodeAudio('aac', encoding)) return;
        this.status('preparing', 'Loading an AAC encoder for MP4 audio…');
        let extension;
        try {
            extension = await this.aacEncoderLoader();
        } catch (error) {
            throw new Error('MP4 audio encoding is unavailable and the AAC fallback could not load. Choose WebM/Opus or retry with internet access.');
        }
        this.assertActive();
        if (typeof extension?.registerAacEncoder !== 'function') {
            throw new Error('The AAC encoder extension is invalid. Choose WebM/Opus.');
        }
        extension.registerAacEncoder();
        if (!await MB.canEncodeAudio('aac', encoding)) {
            throw new Error('This browser cannot encode AAC for MP4, even with the fallback. Choose WebM/Opus or the real-time exporter.');
        }
    }

    async start({ format = 'mp4', fps = 30, bitrateKbps = 6000 } = {}) {
        if (this.busy) throw new Error('An offline export is already running.');
        if (this.engine.isPlaying) throw new Error('Pause the preview before using fixed-frame export.');
        if (!this.getAvailable()) throw new Error('This browser does not support the WebCodecs/OfflineAudioContext export APIs.');
        if (!['mp4','webm'].includes(format)) throw new Error('Select MP4 or WebM.');
        const duration = this.engine.getTimelineDuration();
        if (!duration || duration > OFFLINE_EXPORT_LIMIT_SECONDS) {
            throw new Error('Experimental frame-accurate export currently supports projects up to 2 minutes.');
        }
        const rate = Number(fps);
        if (![24,25,30,50,60].includes(rate)) throw new Error('Choose a supported project frame rate.');
        const tracks = this.engine.tracks.filter(track => track.sourceName);
        if (tracks.some(track => !track.file)) throw new Error('Some source media is missing. Reimport the file before exporting.');
        const frames = offlineFrameSchedule(duration, rate);
        this.busy = true;
        this.controller = new AbortController();
        let output = null;
        try {
            this.status('preparing', 'Loading frame-accurate export tools…');
            const MB = await this.libraryLoader();
            this.assertActive();
            const width = this.engine.outputWidth, height = this.engine.outputHeight;
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const renderer = this.renderEngineFactory(canvas);
            const localTracks = tracks.map(track => ({
                ...track,
                audio: { ...(track.audio || {}) },
                transparency: { ...(track.transparency || {}) },
                media: track.type === 'video' ? null : track.media,
                soundMedia: null,
                audioNode: null, gainNode: null, objectUrl: null,
            }));
            renderer.tracks = localTracks;
            const clones = new Map(localTracks.map(track => [track.id, track]));
            const sinks = await this.videoSinks(MB, tracks);
            this.assertActive();
            this.status('preparing', 'Mixing audio offline…');
            const mixed = await this.mixAudio(MB, tracks, duration);
            this.assertActive();
            if (mixed && format === 'mp4') await this.ensureAacEncoder(MB);
            this.assertActive();

            const outputFormat = format === 'mp4' ? new MB.Mp4OutputFormat() : new MB.WebMOutputFormat();
            const target = new MB.BufferTarget();
            output = new MB.Output({ format: outputFormat, target });
            this.output = output;
            const quality = new MB.Quality({ bitrate: clamp(bitrateKbps, 1000, 50000) * 1000 });
            const videoSource = new MB.CanvasSource(canvas, {
                codec: format === 'mp4' ? 'avc' : 'vp9', quality
            });
            output.addVideoTrack(videoSource);
            let audioSource = null;
            if (mixed) {
                audioSource = new MB.AudioBufferSource({
                    codec: format === 'mp4' ? 'aac' : 'opus',
                    quality: new MB.Quality({ bitrate: 192000 }),
                });
                output.addAudioTrack(audioSource);
            }
            await output.start();
            this.assertActive();
            this.status('recording', 'Encoding fixed-timestamp frames…');
            let audioError = null;
            const audioWriting = audioSource
                ? audioSource.add(mixed).catch(error => { audioError = error; })
                : Promise.resolve();
            for (const frame of frames) {
                this.assertActive();
                if (audioError) throw audioError;
                for (const track of tracks) {
                    if (track.type !== 'video' || !sinks.has(track.id)) continue;
                    const clone = clones.get(track.id);
                    if (!clipAtTime(track, frame.time)) { clone.media = null; continue; }
                    const sink = sinks.get(track.id);
                    const decoded = await sink.getCanvas(clipSourceTime(track, frame.time));
                    this.assertActive();
                    if (!decoded?.canvas) {
                        throw new Error('Frame decoding failed in ' + track.sourceName + ' at ' + frame.time.toFixed(3) + 's.');
                    }
                    clone.media = decoded.canvas;
                }
                renderer.currentTime = frame.time;
                renderer.renderFrame();
                await videoSource.add(frame.time, frame.duration, {
                    keyFrame: frame.index % Math.max(1, rate * 2) === 0,
                });
                if (frame.index % Math.max(1, Math.ceil(rate / 2)) === 0 || frame.index === frames.length - 1) {
                    this.progress(Math.min(duration, frame.time + frame.duration), duration);
                }
            }
            await audioWriting;
            if (audioError) throw audioError;
            this.assertActive();
            this.status('finalizing', 'Finalizing deterministic video…');
            await output.finalize();
            this.assertActive();
            if (!target.buffer?.byteLength) throw new Error('Video encoder produced an empty file.');
            const mime = format === 'mp4' ? 'video/mp4' : 'video/webm';
            this.onDownload?.({ blob: new Blob([target.buffer], { type:mime }), extension:format });
            this.progress(duration, duration);
            this.status('complete', 'Frame-accurate beta export completed');
            return true;
        } catch (error) {
            if (this.controller?.signal.aborted || /cancelled/i.test(String(error))) {
                this.status('cancelled', 'Frame-accurate export cancelled');
                return false;
            }
            this.status('error', error?.message || 'Deterministic video export failed.');
            throw error;
        } finally {
            if (output && output.state !== 'finalized' && output.state !== 'canceled') {
                try { await output.cancel(); } catch (_) { /* best effort */ }
            }
            for (const input of this.inputs.values()) {
                try { input.dispose(); } catch (_) { /* best effort */ }
            }
            this.inputs.clear();
            this.output = null;
            this.controller = null;
            this.busy = false;
        }
    }

    async cancel() {
        if (!this.busy || !this.controller) return;
        this.controller.abort();
        // Disposing inputs interrupts a potentially long WebCodecs decode.
        for (const input of this.inputs.values()) {
            try { input.dispose(); } catch (_) { /* best effort */ }
        }
        if (this.output && this.output.state !== 'finalized' && this.output.state !== 'canceled') {
            try { await this.output.cancel(); } catch (_) { /* best effort */ }
        }
    }
}
