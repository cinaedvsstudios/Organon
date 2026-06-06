/**
 * ORGANON STUDIO: AUDIO TIMELINE CONTROLLER
 * The master file that connects all modules to the UI layout.
 */

// Import all sub-modules
import { audioCtx, decodeAudioFile, renderWaveformToCanvas, createTrackNode } from './audio-mixer.js';
import { loadVideoFile, togglePlayback, stepFrame, downloadCurrentFramePNG } from './video-renderer.js';
import { analyzeCurrentFrame, setBaselineLuminance } from './color-shaders.js';
import { startExport, stopExport } from './exporter.js';

// --- UI ELEMENT SELECTION ---
const btnAddMedia = document.getElementById('btn-add-media');
const audioTrackLane = document.querySelector('.track-lane.audio');
const videoTrackLane = document.querySelector('.track-lane.video');

const btnToggleChroma = document.getElementById('btn-toggle-chroma');
const chromaPanel = document.getElementById('chroma-panel');
const chromaDragHandle = document.getElementById('chroma-drag-handle');
const btnSuggestCorrections = document.querySelector('#chroma-panel button');

const btnPlay = document.getElementById('btn-play');
const btnExport = document.getElementById('btn-export');
const exportFormatPicker = document.getElementById('export-format');

// --- 1. MEDIA IMPORT LOGIC ---
const hiddenFileInput = document.createElement('input');
hiddenFileInput.type = 'file';
hiddenFileInput.accept = 'audio/*, video/*';
hiddenFileInput.multiple = true;

btnAddMedia.addEventListener('click', () => hiddenFileInput.click());

hiddenFileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    if (audioCtx.state === 'suspended') await audioCtx.resume();

    for (const file of files) {
        if (file.type.startsWith('audio/')) {
            const audioBuffer = await decodeAudioFile(file);
            createTrackNode(audioBuffer);

            const waveCanvas = document.createElement('canvas');
            waveCanvas.width = audioTrackLane.clientWidth - 20;
            waveCanvas.height = 50;
            waveCanvas.style.position = 'absolute';
            waveCanvas.style.left = '10px';
            waveCanvas.style.pointerEvents = 'none';

            audioTrackLane.innerHTML = '';
            audioTrackLane.appendChild(waveCanvas);
            renderWaveformToCanvas(audioBuffer, waveCanvas, '#4b84bf');
        }
        
        if (file.type.startsWith('video/')) {
            await loadVideoFile(file);
            videoTrackLane.innerHTML = `<span style="font-size: 12px; color: var(--stone-ochre);">🎞️ ${file.name} Loaded</span>`;
        }
    }
});

// --- 2. FLOATING CHROMINANCE PANEL LOGIC ---
btnToggleChroma.addEventListener('click', () => {
    chromaPanel.style.display = (chromaPanel.style.display === 'none' || chromaPanel.style.display === '') ? 'block' : 'none';
    if(chromaPanel.style.display === 'block') {
        setBaselineLuminance(); // Set the baseline the moment they open the panel
    }
});

let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
chromaDragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - chromaPanel.offsetLeft;
    dragOffsetY = e.clientY - chromaPanel.offsetTop;
    chromaPanel.style.opacity = '0.9';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        chromaPanel.style.left = `${e.clientX - dragOffsetX}px`;
        chromaPanel.style.top = `${e.clientY - dragOffsetY}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        chromaPanel.style.opacity = '1';
    }
});

btnSuggestCorrections.addEventListener('click', () => {
    analyzeCurrentFrame(); // Manually trigger analysis
});

// --- 3. PLAYBACK CONTROLS ---
btnPlay.addEventListener('click', () => {
    const isNowPlaying = togglePlayback();
    btnPlay.innerText = isNowPlaying ? "PAUSE" : "PLAY";
    btnPlay.style.background = isNowPlaying ? "var(--brand-red)" : "var(--stone-ochre)";
    btnPlay.style.color = isNowPlaying ? "white" : "var(--bg-nightsky)";
});

document.getElementById('btn-prev-frame').addEventListener('click', () => {
    stepFrame(-1);
    if(chromaPanel.style.display === 'block') analyzeCurrentFrame(); // Update colors on frame step
});

document.getElementById('btn-next-frame').addEventListener('click', () => {
    stepFrame(1);
    if(chromaPanel.style.display === 'block') analyzeCurrentFrame(); // Update colors on frame step
});

document.getElementById('btn-snap-png').addEventListener('click', () => downloadCurrentFramePNG());

// --- 4. EXPORT LOGIC ---
let isExporting = false;
btnExport.addEventListener('click', () => {
    if (!isExporting) {
        const selectedFormat = exportFormatPicker.value;
        startExport(selectedFormat);
        isExporting = true;
    } else {
        stopExport();
        isExporting = false;
    }
});