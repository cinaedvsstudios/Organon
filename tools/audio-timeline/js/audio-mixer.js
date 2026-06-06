/**
 * ORGANON STUDIO: AUDIO TIMELINE MIXER
 * Handles Web Audio Context, multi-track mixing, and waveform visualization.
 */

// 1. Initialize Master Audio Environment
// We create one global AudioContext for the entire app.
export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// The Master Mixer: Everything routes through here before going to speakers or export
export const masterMixer = audioCtx.createGain();
masterMixer.connect(audioCtx.destination);

// Track Storage
export const audioTracks = [];

/**
 * Loads a standard audio file (mp3, wav) or extracts audio from a video,
 * and decodes it into a raw AudioBuffer we can analyze and play.
 */
export async function decodeAudioFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

/**
 * Draws a visual waveform of the audio buffer onto a canvas element.
 * This is what gets injected into your .track-lane.audio div!
 */
export function renderWaveformToCanvas(audioBuffer, canvas, color = "#4b84bf") {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear previous drawing
    ctx.clearRect(0, 0, width, height);

    // Get the raw audio data from the first channel (left channel/mono)
    const channelData = audioBuffer.getChannelData(0);
    
    // We don't want to draw millions of samples, so we calculate "chunks" per pixel
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;
    
    ctx.fillStyle = color;
    
    // Loop through the canvas width, finding the peak audio volume for each pixel segment
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const datum = channelData[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        // Draw a vertical line representing the volume peak at this specific time
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
}

/**
 * Creates a playable source node for a specific audio buffer.
 * Allows you to duck volume, mute, or offset the start time.
 */
export function createTrackNode(audioBuffer, startTimeOffset = 0) {
    const trackGain = audioCtx.createGain();
    trackGain.connect(masterMixer);
    
    const track = {
        buffer: audioBuffer,
        gainNode: trackGain,
        offset: startTimeOffset,
        
        play: function(currentTime) {
            this.source = audioCtx.createBufferSource();
            this.source.buffer = this.buffer;
            this.source.connect(this.gainNode);
            // Start playing at the correct offset
            this.source.start(audioCtx.currentTime, currentTime - this.offset);
        },
        
        stop: function() {
            if (this.source) {
                this.source.stop();
                this.source.disconnect();
            }
        },

        setVolume: function(value) {
            // value between 0 (muted) and 1 (full volume)
            this.gainNode.gain.value = value;
        }
    };
    
    audioTracks.push(track);
    return track;
}