/**
 * ORGANON STUDIO: EXPORTER
 * Live MediaRecorder export from canvas plus Web Audio.
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