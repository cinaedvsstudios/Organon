import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
let mediaRecorder = null;
let recordedChunks = [];
let canvasStream = null;
let audioDestination = null;
let masterStream = null;
let mimeType = 'video/webm';
let extension = 'webm';

function pickFormat(format) {
  if (format === 'audio-webm') return { mimeType: 'audio/webm;codecs=opus', extension: 'webm' };
  if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp