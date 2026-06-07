import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
let mediaRecorder = null;
let recordedChunks = [];
let canvasStream = null;
let audioDestination = null;
let masterStream = null;

function cleanupStreams() {
  if (masterStream) masterStream.getTracks().forEach(track => track.stop());
  if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
  if (audioDestination) master