/**
 * ORGANON STUDIO: EXPORTER
 * Handles live MediaRecorder export from the canvas preview and Web Audio graph.
 */

import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
const exportStatus = document.getElementById('export-status');

let mediaRecorder = null;
let recordedChunks = [];
let activeCanvasStream = null;
let activeMasterStream = null;
let activeAudioDestination = null;
let activeMimeType = 'video/webm';
let activeExtension = 'webm';

function setStatus(message) {
    if (exportStatus) exportStatus.textContent = message;
}

function chooseMimeType(format) {
    if (format === 'audio-webm') {
        return { mimeType: 'audio/webm