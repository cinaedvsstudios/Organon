import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
let mediaRecorder = null;
let recordedChunks = [];

export function startExport(format) {
  recordedChunks = [];
  const canvasStream = masterCanvas.captureStream(30);
  const audioDestination = audioCtx.createMediaStreamDestination();
  masterMixer.connect(audioDestination);
  const tracks = [
    ...canvasStream