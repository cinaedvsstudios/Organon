import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
const exportStatus = document.getElementById('export-status');
let mediaRecorder = null;
let recordedChunks = [];
let canvasStream = null;
let masterStream = null;
let audioDestination = null;
let mimeType = 'video/webm';
let extension = 'webm';

function status(text) {
  if (exportStatus) exportStatus.textContent = text;
}

function