/*
 * Onda MIDI Playback Module
 * Adds Standard MIDI File (.mid/.midi) playback to Onda without external libraries.
 * Loaded after Onda's main inline player script so it can reuse Onda's WebAudio
 * context, volume control, analyser and transport UI.
 */
(function () {
    'use strict';

    const MIDI_EXTENSION_RE = /\.(mid|midi)$/i;
    const MIDI_MIME_RE = /(?:audio\/(?:midi|x-midi)|application\/x-midi)/i;
    const LOOKAHEAD_SECONDS = 0.20;
    const SCHEDULER_INTERVAL_MS = 40;
    const MAX_LIVE_VOICES = 72;

    const state = {
        song: null,
        playing: false,
        position: 0,
        rate: 1,
        playStartedAt: 0,
        positionAtStart: 0,
        nextNoteIndex: 0,
        schedulerTimer: null,
        timelineFrame: null,
        outputNode: null,
        noiseBuffer: null,
        voices: new Set(),
        ending: false
    };

    function isMidiFile(fileOrMeta) {
        if (!fileOrMeta) return false;
        const name = String(fileOrMeta.name || fileOrMeta.fileName || fileOrMeta.localPath || '');
        const type = String(fileOrMeta.type || fileOrMeta.mimeType || '');
        return fileOrMeta.sourceType === 'midi' || MIDI_EXTENSION_RE.test(name) || MIDI_MIME_RE.test(type);
    }

    function clampNumber(value, min, max, fallback = min) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function bytesToAscii(view, offset, length) {
        let text = '';
        for (let i = 0; i < length; i += 1) text += String.fromCharCode(view.getUint8(offset + i));
        return text;
    }

    function readVariableLength(view, cursor, limit) {
        let value = 0;
        let count = 0;
        while (cursor.pos < limit && count < 4) {
            const byte = view.getUint8(cursor.pos++);
            value = (value << 7) | (byte & 0x7f);
            count += 1;
            if ((byte & 0x80) === 0) return value;
        }
        throw new Error('Invalid MIDI variable-length value.');
    }

    function parseMidi(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        if (view.byteLength < 14 || bytesToAscii(view, 0, 4) !== 'MThd') {
            throw new Error('This file is not a Standard MIDI File.');
        }

        const headerLength = view.getUint32(4, false);
        const format = view.getUint16(8, false);
        const trackCount = view.getUint16(10, false);
        const division = view.getUint16(12, false);
        if (division & 0x8000) {
            throw new Error('SMPTE-timed MIDI files are not supported yet.');
        }
        const ticksPerQuarter = division;
        if (!ticksPerQuarter) throw new Error('MIDI file has an invalid timing division.');

        let offset = 8 + headerLength;
        const channelEvents = [];
        const tempos = [{ tick: 0, microsecondsPerQuarter: 500000, sequence: -1 }];
        let sequence = 0;
        let latestTick = 0;

        for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
            if (offset + 8 > view.byteLength || bytesToAscii(view, offset, 4) !== 'MTrk') {
                throw new Error('MIDI track data is missing or corrupt.');
            }
            const trackLength = view.getUint32(offset + 4, false);
            const trackStart = offset + 8;
            const trackEnd = trackStart + trackLength;
            if (trackEnd > view.byteLength) throw new Error('MIDI track extends beyond the file size.');

            const cursor = { pos: trackStart };
            let runningStatus = null;
            let tick = 0;

            while (cursor.pos < trackEnd) {
                tick += readVariableLength(view, cursor, trackEnd);
                latestTick = Math.max(latestTick, tick);
                if (cursor.pos >= trackEnd) break;

                let status = view.getUint8(cursor.pos++);
                if (status < 0x80) {
                    if (runningStatus === null) throw new Error('Invalid MIDI running status.');
                    cursor.pos -= 1;
                    status = runningStatus;
                } else if (status < 0xf0) {
                    runningStatus = status;
                }

                if (status === 0xff) {
                    if (cursor.pos >= trackEnd) break;
                    const metaType = view.getUint8(cursor.pos++);
                    const length = readVariableLength(view, cursor, trackEnd);
                    if (cursor.pos + length > trackEnd) throw new Error('Invalid MIDI meta event.');
                    if (metaType === 0x51 && length === 3) {
                        const mpq = (view.getUint8(cursor.pos) << 16) | (view.getUint8(cursor.pos + 1) << 8) | view.getUint8(cursor.pos + 2);
                        if (mpq > 0) tempos.push({ tick, microsecondsPerQuarter: mpq, sequence: sequence++ });
                    }
                    cursor.pos += length;
                    runningStatus = null;
                    continue;
                }

                if (status === 0xf0 || status === 0xf7) {
                    const length = readVariableLength(view, cursor, trackEnd);
                    cursor.pos += length;
                    runningStatus = null;
                    continue;
                }

                const eventType = status & 0xf0;
                const channel = status & 0x0f;
                const data1 = view.getUint8(cursor.pos++);
                const oneByteEvent = eventType === 0xc0 || eventType === 0xd0;
                const data2 = oneByteEvent ? null : view.getUint8(cursor.pos++);

                if (eventType === 0x80 || eventType === 0x90 || eventType === 0xc0) {
                    channelEvents.push({
                        tick,
                        sequence: sequence++,
                        type: eventType === 0xc0 ? 'program' : (eventType === 0x90 && data2 > 0 ? 'noteOn' : 'noteOff'),
                        channel,
                        data1,
                        data2: data2 || 0
                    });
                }
            }
            offset = trackEnd;
        }

        tempos.sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
        const consolidatedTempos = [];
        tempos.forEach(tempo => {
            if (consolidatedTempos.length && consolidatedTempos[consolidatedTempos.length - 1].tick === tempo.tick) {
                consolidatedTempos[consolidatedTempos.length - 1] = tempo;
            } else {
                consolidatedTempos.push(tempo);
            }
        });
        if (!consolidatedTempos.length || consolidatedTempos[0].tick !== 0) {
            consolidatedTempos.unshift({ tick: 0, microsecondsPerQuarter: 500000, sequence: -1 });
        }

        let elapsedSeconds = 0;
        consolidatedTempos.forEach((tempo, index) => {
            if (index > 0) {
                const prior = consolidatedTempos[index - 1];
                elapsedSeconds += ((tempo.tick - prior.tick) * prior.microsecondsPerQuarter) / (ticksPerQuarter * 1000000);
            }
            tempo.secondsAtTick = elapsedSeconds;
        });

        function ticksToSeconds(tick) {
            let segment = consolidatedTempos[0];
            for (let i = 1; i < consolidatedTempos.length && consolidatedTempos[i].tick <= tick; i += 1) {
                segment = consolidatedTempos[i];
            }
            return segment.secondsAtTick + ((tick - segment.tick) * segment.microsecondsPerQuarter) / (ticksPerQuarter * 1000000);
        }

        const programByChannel = new Array(16).fill(0);
        const openNotes = new Map();
        const notes = [];
        channelEvents.sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);

        channelEvents.forEach(event => {
            if (event.type === 'program') {
                programByChannel[event.channel] = event.data1;
                return;
            }
            const key = `${event.channel}:${event.data1}`;
            if (event.type === 'noteOn') {
                if (!openNotes.has(key)) openNotes.set(key, []);
                openNotes.get(key).push({
                    tick: event.tick,
                    midi: event.data1,
                    velocity: event.data2,
                    channel: event.channel,
                    program: programByChannel[event.channel]
                });
                return;
            }
            const stack = openNotes.get(key);
            if (!stack || !stack.length) return;
            const started = stack.shift();
            const start = ticksToSeconds(started.tick);
            const end = ticksToSeconds(Math.max(started.tick + 1, event.tick));
            notes.push({ ...started, start, duration: Math.max(0.025, end - start) });
        });

        openNotes.forEach(stack => {
            stack.forEach(started => {
                const start = ticksToSeconds(started.tick);
                const end = ticksToSeconds(Math.max(started.tick + ticksPerQuarter / 2, latestTick));
                notes.push({ ...started, start, duration: Math.max(0.025, end - start) });
            });
        });

        notes.sort((a, b) => a.start - b.start || a.channel - b.channel || a.midi - b.midi);
        const noteEnd = notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
        const duration = Math.max(noteEnd, ticksToSeconds(latestTick));

        return {
            format,
            trackCount,
            ticksPerQuarter,
            notes,
            tempos: consolidatedTempos,
            duration
        };
    }

    function midiFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function waveformForProgram(program) {
        if (program >= 16 && program <= 23) return 'sine';       // organs
        if (program >= 24 && program <= 31) return 'sawtooth';   // guitars
        if (program >= 32 && program <= 39) return 'triangle';   // bass
        if (program >= 40 && program <= 55) return 'sawtooth';   // strings/choir
        if (program >= 80 && program <= 87) return 'square';     // leads
        return 'triangle';                                       // piano/general
    }

    async function ensureOutputNode() {
        if (typeof initAudioEngine !== 'function') throw new Error('Onda audio engine is unavailable.');
        await initAudioEngine();
        if (!audioCtx || !gainNode) throw new Error('Onda WebAudio output could not be initialised.');
        if (!state.outputNode || state.outputNode.context !== audioCtx) {
            state.outputNode = audioCtx.createGain();
            state.outputNode.gain.value = 0.55;
            state.outputNode.connect(gainNode);
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();
    }

    function stopVoice(voice) {
        if (!voice) return;
        try { voice.source.stop(); } catch (err) {}
        try { voice.source.disconnect(); } catch (err) {}
        try { voice.gain.disconnect(); } catch (err) {}
        if (voice.filter) {
            try { voice.filter.disconnect(); } catch (err) {}
        }
        state.voices.delete(voice);
    }

    function stopScheduledVoices() {
        state.voices.forEach(stopVoice);
        state.voices.clear();
    }

    function registerVoice(source, gain, filter = null) {
        if (state.voices.size >= MAX_LIVE_VOICES) {
            stopVoice(state.voices.values().next().value);
        }
        const voice = { source, gain, filter };
        state.voices.add(voice);
        source.onended = () => {
            try { source.disconnect(); } catch (err) {}
            try { gain.disconnect(); } catch (err) {}
            if (filter) {
                try { filter.disconnect(); } catch (err) {}
            }
            state.voices.delete(voice);
        };
    }

    function ensureNoiseBuffer() {
        if (state.noiseBuffer && state.noiseBuffer.sampleRate === audioCtx.sampleRate) return state.noiseBuffer;
        const duration = 0.45;
        const buffer = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate * duration), audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        state.noiseBuffer = buffer;
        return buffer;
    }

    function scheduleDrum(note, when, duration) {
        const source = audioCtx.createBufferSource();
        source.buffer = ensureNoiseBuffer();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        const hitDuration = Math.min(Math.max(duration, 0.045), 0.32);
        filter.type = note.midi < 42 ? 'lowpass' : 'highpass';
        filter.frequency.setValueAtTime(note.midi < 42 ? 170 : 2100, when);
        const peak = clampNumber((note.velocity / 127) * 0.14, 0.018, 0.14, 0.07);
        gain.gain.setValueAtTime(peak, when);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + hitDuration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(state.outputNode);
        source.start(when);
        source.stop(when + hitDuration + 0.02);
        registerVoice(source, gain, filter);
    }

    function scheduleTonalNote(note, when, duration) {
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const safeDuration = Math.max(0.03, duration);
        const attack = Math.min(0.018, safeDuration * 0.18);
        const release = Math.min(0.11, safeDuration * 0.42);
        const peak = clampNumber((note.velocity / 127) * 0.105, 0.008, 0.105, 0.05);
        oscillator.type = waveformForProgram(note.program);
        oscillator.frequency.setValueAtTime(midiFrequency(note.midi), when);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(peak, when + attack);
        gain.gain.setValueAtTime(peak, Math.max(when + attack, when + safeDuration - release));
        gain.gain.exponentialRampToValueAtTime(0.0001, when + safeDuration);
        oscillator.connect(gain);
        gain.connect(state.outputNode);
        oscillator.start(when);
        oscillator.stop(when + safeDuration + 0.02);
        registerVoice(oscillator, gain);
    }

    function findNoteIndex(positionSeconds) {
        const notes = state.song?.notes || [];
        let low = 0;
        let high = notes.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (notes[middle].start < positionSeconds - 0.001) low = middle + 1;
            else high = middle;
        }
        return low;
    }

    function currentPosition() {
        if (!state.song) return 0;
        if (!state.playing || !audioCtx) return state.position;
        const moved = (audioCtx.currentTime - state.playStartedAt) * state.rate;
        return clampNumber(state.positionAtStart + moved, 0, state.song.duration, 0);
    }

    function renderTimeline(position = currentPosition()) {
        if (!state.song) return;
        if (typeof isSeeking === 'undefined' || !isSeeking) {
            if (typeof seekBar !== 'undefined' && seekBar) seekBar.value = position;
            if (typeof timeCurrent !== 'undefined' && timeCurrent) timeCurrent.innerText = formatTime(position);
        }
    }

    function updatePlayingButton(playing) {
        if (typeof isPlaying !== 'undefined') isPlaying = Boolean(playing);
        if (typeof btnPlay !== 'undefined' && btnPlay) {
            btnPlay.innerHTML = playing ? '<span class="playing-spinner">𖦹</span>' : '▷';
            btnPlay.classList.toggle('active-state', Boolean(playing));
        }
    }

    function clearTimers() {
        if (state.schedulerTimer !== null) {
            clearInterval(state.schedulerTimer);
            state.schedulerTimer = null;
        }
        if (state.timelineFrame !== null) {
            cancelAnimationFrame(state.timelineFrame);
            state.timelineFrame = null;
        }
    }

    function finishPlayback() {
        if (!state.song || state.ending) return;
        state.ending = true;
        state.position = state.song.duration;
        state.playing = false;
        clearTimers();
        stopScheduledVoices();
        renderTimeline(state.position);
        updatePlayingButton(false);

        setTimeout(() => {
            state.ending = false;
            if (typeof isRepeatOne !== 'undefined' && isRepeatOne) {
                audioAdapter.currentTime = 0;
                playAudio();
            } else if (typeof isShuffle !== 'undefined' && isShuffle && playlistTracks.length) {
                switchTrack(Math.floor(Math.random() * playlistTracks.length));
            } else if (typeof currentTrackIndex !== 'undefined' && currentTrackIndex < playlistTracks.length - 1) {
                switchTrack(currentTrackIndex + 1);
            } else if (typeof isRepeatAll !== 'undefined' && isRepeatAll && playlistTracks.length) {
                switchTrack(0);
            } else {
                audioAdapter.currentTime = 0;
            }
        }, 0);
    }

    function scheduleAhead() {
        if (!state.playing || !state.song || !audioCtx) return;
        const now = audioCtx.currentTime;
        const position = currentPosition();
        if (position >= state.song.duration - 0.005) {
            finishPlayback();
            return;
        }
        const scheduleUntil = position + LOOKAHEAD_SECONDS * state.rate;
        while (state.nextNoteIndex < state.song.notes.length && state.song.notes[state.nextNoteIndex].start <= scheduleUntil) {
            const note = state.song.notes[state.nextNoteIndex++];
            const intendedStart = state.playStartedAt + ((note.start - state.positionAtStart) / state.rate);
            const realStart = Math.max(now + 0.004, intendedStart);
            const lateBy = Math.max(0, realStart - intendedStart);
            const duration = (note.duration / state.rate) - lateBy;
            if (duration > 0.02) {
                if (note.channel === 9) scheduleDrum(note, realStart, duration);
                else scheduleTonalNote(note, realStart, duration);
            }
        }
    }

    function animateTimeline() {
        if (!state.playing) return;
        const position = currentPosition();
        renderTimeline(position);
        if (position >= (state.song?.duration || 0) - 0.005) {
            finishPlayback();
            return;
        }
        state.timelineFrame = requestAnimationFrame(animateTimeline);
    }

    async function load(blob, meta = {}) {
        if (!blob || typeof blob.arrayBuffer !== 'function') throw new Error('No MIDI file data is available.');
        stopForTrackChange();
        const parsed = parseMidi(await blob.arrayBuffer());
        if (!parsed.notes.length) throw new Error('This MIDI file contains no playable notes.');
        state.song = parsed;
        state.position = 0;
        state.rate = clampNumber(typeof speedSlider !== 'undefined' ? speedSlider.value : 1, 0.25, 4, 1);
        state.nextNoteIndex = 0;
        if (typeof seekBar !== 'undefined' && seekBar) {
            seekBar.max = parsed.duration;
            seekBar.value = 0;
        }
        if (typeof timeCurrent !== 'undefined' && timeCurrent) timeCurrent.innerText = '0:00';
        if (typeof timeTotal !== 'undefined' && timeTotal) timeTotal.innerText = formatTime(parsed.duration);
        meta.duration = formatTime(parsed.duration);
        meta.midiNoteCount = parsed.notes.length;
        meta.midiTrackCount = parsed.trackCount;
        meta.midiFormat = parsed.format;
        meta.sourceType = 'midi';
        return parsed;
    }

    async function play() {
        if (!state.song) return;
        await ensureOutputNode();
        if (state.playing) return;
        if (state.position >= state.song.duration - 0.005) state.position = 0;
        state.ending = false;
        state.positionAtStart = state.position;
        state.playStartedAt = audioCtx.currentTime;
        state.nextNoteIndex = findNoteIndex(state.position);
        state.playing = true;
        updatePlayingButton(true);
        scheduleAhead();
        state.schedulerTimer = setInterval(scheduleAhead, SCHEDULER_INTERVAL_MS);
        state.timelineFrame = requestAnimationFrame(animateTimeline);
    }

    function pause() {
        if (state.playing) state.position = currentPosition();
        state.playing = false;
        clearTimers();
        stopScheduledVoices();
        renderTimeline(state.position);
        updatePlayingButton(false);
    }

    function seek(seconds) {
        if (!state.song) return;
        const wasPlaying = state.playing;
        state.position = clampNumber(seconds, 0, state.song.duration, 0);
        stopScheduledVoices();
        if (wasPlaying && audioCtx) {
            state.positionAtStart = state.position;
            state.playStartedAt = audioCtx.currentTime;
            state.nextNoteIndex = findNoteIndex(state.position);
            scheduleAhead();
        } else {
            state.nextNoteIndex = findNoteIndex(state.position);
        }
        renderTimeline(state.position);
    }

    function setRate(value) {
        const nextRate = clampNumber(value, 0.25, 4, 1);
        if (state.playing) {
            state.position = currentPosition();
            stopScheduledVoices();
            state.positionAtStart = state.position;
            state.playStartedAt = audioCtx.currentTime;
            state.nextNoteIndex = findNoteIndex(state.position);
        }
        state.rate = nextRate;
        if (state.playing) scheduleAhead();
    }

    function stopForTrackChange() {
        pause();
        state.song = null;
        state.position = 0;
        state.nextNoteIndex = 0;
        state.ending = false;
        if (typeof seekBar !== 'undefined' && seekBar) seekBar.value = 0;
    }

    const audioAdapter = {
        get paused() { return !state.playing; },
        get duration() { return state.song ? state.song.duration : 0; },
        get currentTime() { return currentPosition(); },
        set currentTime(value) { seek(value); },
        get playbackRate() { return state.rate; },
        set playbackRate(value) { setRate(value); },
        get src() { return ''; },
        set src(_value) {},
        play,
        pause,
        load() {}
    };

    window.OndaMidi = {
        audio: audioAdapter,
        isMidiFile,
        isMidiTrack: isMidiFile,
        load,
        parseMidi,
        stopForTrackChange,
        getSongInfo() {
            if (!state.song) return null;
            return {
                duration: state.song.duration,
                notes: state.song.notes.length,
                tracks: state.song.trackCount,
                format: state.song.format,
                tempoChanges: state.song.tempos.length
            };
        }
    };
})();
