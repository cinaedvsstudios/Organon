/**
 * ORGANON STUDIO: EXPORTER
 * Handles multiplexing canvas video and Web Audio into downloadable formats.
 */

import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
const exportStatus = document.getElementById('export-status');
let mediaRecorder = null;
let recordedChunks = [];
let activeCanvasStream = null;
let activeMasterStream = null;
let activeAudioDestination = null