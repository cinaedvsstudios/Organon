/**
 * MotoriClip Phase 6B — initial live (real-time) Advanced export.
 *
 * Browser MediaRecorder records the already-composited canvas plus the existing
 * per-clip Web Audio mix. This is intentionally NOT a frame-accurate offline
 * exporter: the browser may drop frames under load. A WebCodecs/Mediabunny
 * renderer remains the release-grade deterministic export milestone.
 */
const PROFILES = Object.freeze({
    webm: [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ],
    mp4: [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4'
    ]
});

export function supportedExportFormats(Recorder = globalThis.MediaRecorder) {
    if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return [];
    return Object.entries(PROFILES).flatMap(([format, candidates]) => {
        const mimeType = candidates.find(candidate => Recorder.isTypeSupported(candidate));
        return mimeType ? [{ format, mimeType, extension:format }] : [];
    });
}
export function selectExportFormat(format, Recorder = globalThis.MediaRecorder) {
    const found = supportedExportFormats(Recorder);
    const selected = found.find(profile => profile.format === format);
    if (!selected) {
        throw new Error(`${String(format).toUpperCase()} recording is not available in this browser. Choose an available format or another browser.`);
    }
    return selected;
}
export function exportBitrate(kilobits) {
    const selected = Number(kilobits);
    return [3000, 6000, 10000, 16000].includes(selected) ? selected * 1000 : 6000000;
}

export class AdvancedLiveExporter {
    constructor({ engine, canvas, Recorder = globalThis.MediaRecorder,
        Stream = globalThis.MediaStream, visibilityTarget = globalThis.document,
        requestFrame = globalThis.requestAnimationFrame,
        cancelFrame = globalThis.cancelAnimationFrame,
        onProgress = () => {}, onState = () => {}, onDownload = () => {} }) {
        this.engine = engine;
        this.canvas = canvas;
        this.Recorder = Recorder;
        this.Stream = Stream;
        this.visibilityTarget = visibilityTarget;
        this.requestFrame = requestFrame;
        this.cancelFrame = cancelFrame;
        this.onProgress = onProgress;
        this.onState = onState;
        this.onDownload = onDownload;
        this.busy = false;
        this.phase = 'idle';
        this.frameId = null;
        this.canvasStream = null;
        this.combinedStream = null;
        this.audioMix = null;
        this.connectedGains = [];
        this.recorder = null;
        this.oldPlaybackChange = null;
        this.savedTime = 0;
        this.savedPreviewGain = null;
        this.totalDuration = 0;
        this.recordedChunks = [];
        this.recordedStop = null;
        this.finishPromise = null;
        this.finalizeResult = null;
        this._resolveResult = null;
        this._rejectResult = null;
        this.onVisibility = () => {
            if (this.phase === 'recording' || this.phase === 'preparing') {
                void this.finish('error', new Error('Live export was interrupted when the tab became hidden. Keep MotoriClip visible throughout recording.'));
            }
        };
    }
    getFormats() { return supportedExportFormats(this.Recorder); }
    start({ format = 'webm', fps = 30, bitrateKbps = 6000 } = {}) {
        if (this.busy) return Promise.reject(new Error('An export is already in progress.'));
        const profile = selectExportFormat(format, this.Recorder);
        if (!this.Stream || typeof this.canvas.captureStream !== 'function') {
            return Promise.reject(new Error('This browser cannot capture a canvas video stream.'));
        }
        const duration = this.engine.getTimelineDuration();
        if (!(duration > 0)) return Promise.reject(new Error('Add media to the timeline before exporting.'));
        if (this.visibilityTarget?.hidden) return Promise.reject(new Error('Keep the MotoriClip tab visible to start a live export.'));
        this.busy = true;
        this.phase = 'preparing';
        this.profile = profile;
        this.totalDuration = duration;
        this.savedTime = this.engine.getCurrentTime();
        this.fps = [24, 25, 30, 50, 60].includes(Number(fps)) ? Number(fps) : 30;
        this.bitrate = exportBitrate(bitrateKbps);
        this.recordedChunks = [];
        const result = new Promise((resolve, reject) => {
            this._resolveResult = resolve;
            this._rejectResult = reject;
        });
        this.onState({ phase:'preparing', message:'Preparing source frames and audio mix' });
        void this.prepare().catch(error => { void this.finish('error', error); });
        return result;
    }
    async prepare() {
        if (this.engine.isPlaying) this.engine.pause();
        await this.engine.ensureAudioGraph();
        if (this.phase !== 'preparing') return;
        if (this.engine.audioContext.state === 'suspended') await this.engine.audioContext.resume();
        if (this.phase !== 'preparing') return;
        const seeked = await this.engine.seek(0, { resume:false });
        if (this.phase !== 'preparing') return;
        if (!seeked) throw new Error('The first composition frame could not be decoded.');

        const audioContext = this.engine.audioContext;
        this.audioMix = audioContext.createMediaStreamDestination();
        this.connectedGains = [];
        for (const track of this.engine.tracks) {
            if (!track.gainNode) continue;
            track.gainNode.connect(this.audioMix);
            this.connectedGains.push(track.gainNode);
        }

        this.canvasStream = this.canvas.captureStream(this.fps);
        const videoTracks = this.canvasStream.getVideoTracks();
        if (!videoTracks.length) throw new Error('The canvas did not provide a video stream.');
        const audioTracks = this.connectedGains.length ? this.audioMix.stream.getAudioTracks() : [];
        this.combinedStream = new this.Stream([...videoTracks, ...audioTracks]);
        this.recorder = new this.Recorder(this.combinedStream, {
            mimeType: this.profile.mimeType,
            videoBitsPerSecond: this.bitrate,
            audioBitsPerSecond: 128000
        });
        this.recordedStop = new Promise(resolve => {
            this.recorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) this.recordedChunks.push(event.data);
            };
            this.recorder.onstop = () => resolve();
            this.recorder.onerror = event => {
                void this.finish('error', event.error || new Error('The browser could not encode this video.'));
            };
        });
        this.savedPreviewGain = this.engine.previewGain?.gain.value ?? null;
        if (this.engine.previewGain) this.engine.previewGain.gain.value = 0; // no speaker echo; export mix unaffected
        this.oldPlaybackChange = this.engine.onPlaybackChange;
        this.engine.onPlaybackChange = playing => {
            this.oldPlaybackChange?.(playing);
            if (!playing && this.phase === 'recording') void this.finish('complete');
        };
        this.visibilityTarget?.addEventListener?.('visibilitychange', this.onVisibility);
        if (this.phase !== 'preparing') return;
        this.phase = 'recording';
        this.onState({ phase:'recording', message:'Recording the full timeline in real time' });
        this.recorder.start(1000);
        await this.engine.play();
        if (this.phase === 'recording') this.watchProgress();
    }
    watchProgress() {
        if (this.phase !== 'recording') return;
        const current = Math.min(this.totalDuration, Math.max(0, this.engine.getCurrentTime()));
        this.onProgress({ current, duration:this.totalDuration,
            percent:Math.max(0,Math.min(100,100*current/this.totalDuration)) });
        this.frameId = this.requestFrame(() => this.watchProgress());
    }
    cancel() {
        if (!this.busy) return Promise.resolve(false);
        return this.finish('cancel');
    }
    finish(reason='complete', error=null) {
        if (!this.busy) return Promise.resolve(null);
        if (this.finishPromise) return this.finishPromise;
        this.phase = 'finalizing';
        this.onState({phase:'finalizing',message:reason==='complete'?'Finalizing video file':'Stopping export'});
        this.finishPromise = this.finalize(reason,error);
        return this.finishPromise;
    }
    async finalize(reason,error) {
        let outcome = null;
        let failure = error;
        try {
            if (this.frameId !== null) { this.cancelFrame(this.frameId); this.frameId=null; }
            // Stop timeline first to avoid new input frames after recording ends.
            if (this.engine.isPlaying) this.engine.pause();
            if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
            if (this.recordedStop) {
                await Promise.race([
                    this.recordedStop,
                    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Browser recorder did not finish stopping.')),5000))
                ]);
            }
            if (reason === 'complete' && !failure) {
                if (!this.recordedChunks.length) throw new Error('The browser produced an empty video recording.');
                const actualMime = this.recorder.mimeType || this.profile.mimeType;
                const extension = actualMime.startsWith('video/mp4') ? 'mp4' : 'webm';
                const blob = new Blob(this.recordedChunks, { type: actualMime });
                if (!blob.size) throw new Error('The browser produced an empty video recording.');
                outcome = {blob,extension,mimeType:actualMime,duration:this.totalDuration,
                    width:this.canvas.width,height:this.canvas.height,fps:this.fps};
                await this.onDownload(outcome);
            }
        } catch (caught) {
            failure = caught;
        } finally {
            await this.cleanup();
            if (failure) {
                this.onState({phase:'error',message:failure.message || String(failure)});
                this._rejectResult?.(failure);
            } else if (reason === 'cancel') {
                this.onState({phase:'cancelled',message:'Export cancelled; partial recording discarded'});
                this._resolveResult?.(null);
            } else {
                this.onProgress({current:this.totalDuration,duration:this.totalDuration,percent:100});
                this.onState({phase:'complete',message:`Saved ${outcome.extension.toUpperCase()} video`});
                this._resolveResult?.(outcome);
            }
            this._resolveResult = null;
            this._rejectResult = null;
        }
        return outcome;
    }
    async cleanup() {
        this.visibilityTarget?.removeEventListener?.('visibilitychange',this.onVisibility);
        if (this.frameId !== null) {this.cancelFrame(this.frameId);this.frameId=null;}
        if (this.oldPlaybackChange) this.engine.onPlaybackChange = this.oldPlaybackChange;
        this.oldPlaybackChange = null;
        for (const gain of this.connectedGains) {
            try {gain.disconnect(this.audioMix)} catch (_) { /* node may have been removed */ }
        }
        this.connectedGains = [];
        for (const stream of [this.combinedStream,this.canvasStream,this.audioMix?.stream]) {
            for (const track of stream?.getTracks?.() || []) {
                try {track.stop()} catch (_) { /* already ended */ }
            }
        }
        this.combinedStream=null;this.canvasStream=null;this.audioMix=null;
        this.recorder=null;this.recordedStop=null;this.recordedChunks=[];
        if (this.savedPreviewGain !== null && this.engine.previewGain) {
            this.engine.applyPreviewGain();
        }
        this.savedPreviewGain=null;
        this.busy=false;
        this.phase='idle';
        this.finishPromise=null;
        try { await this.engine.seek(this.savedTime, { resume:false }); } catch (_) { /* preview can be retried */ }
    }
}
