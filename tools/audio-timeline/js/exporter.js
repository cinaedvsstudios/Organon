/**
 * ORGANON STUDIO: EXPORTER
 * Handles live recording of the master canvas and Web Audio output.
 */

import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');

let mediaRecorder = null;
let recordedChunks = [];
let activeMasterStream = null;
let activeCanvasStream = null;
let activeAudioDestination = null;
let activeMimeType = 'video/webm';
let activeExtension = 'webm';

function getExportStatusElement() {
    return document.getElementById('export-status');
}

function setExportStatus(message) {
    const exportStatus = getExportStatusElement();
    if (exportStatus) {
        exportStatus.textContent = message;
    }
}

function resetExportButton() {
    const exportBtn = document.getElementById('btn-export');
    if (!exportBtn) return;

    exportBtn.innerText = 'Export Render';
    exportBtn.style.background = '';
}

function setExportButtonRecording() {
    const exportBtn = document.getElementById('btn-export');
    if (!exportBtn) return;

    exportBtn.innerText = '🛑 STOP & SAVE';
    exportBtn.style.background = 'var(--brand-red)';
}

function cleanupExportResources() {
    if (activeMasterStream) {
        activeMasterStream.getTracks().forEach((track) => track.stop());
        activeMasterStream = null;
    }

    if (activeCanvasStream) {
        activeCanvasStream.getTracks().forEach((track) => track.stop());
        activeCanvasStream = null;
    }

    if (activeAudioDestination) {
        try {
            masterMixer.disconnect(activeAudioDestination);
        } catch (error) {
            console.warn('Export audio destination was already disconnected.', error);
        }

        activeAudioDestination = null;
    }
}

function chooseRecorderSettings(format) {
    const videoCandidates = [];

    if (format === 'mp4') {
        videoCandidates.push(
            { mimeType: 'video/mp4', extension: 'mp4' }
        );
    }

    videoCandidates.push(
        { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
        { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
        { mimeType: 'video/webm', extension: 'webm' }
    );

    if (format === 'audio-webm') {
        const audioCandidates = [
            { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
            { mimeType: 'audio/webm', extension: 'webm' }
        ];

        return audioCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) || audioCandidates[audioCandidates.length - 1];
    }

    return videoCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) || videoCandidates[videoCandidates.length - 1];
}

export function startExport(format) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.warn('Export is already running.');
        return;
    }

    cleanupExportResources();
    recordedChunks = [];

    const recorderSettings = chooseRecorderSettings(format);
    activeMimeType = recorderSettings.mimeType;
    activeExtension = recorderSettings.extension;

    activeCanvasStream = masterCanvas.captureStream(30);
    activeAudioDestination = audioCtx.createMediaStreamDestination();
    masterMixer.connect(activeAudioDestination);

    const tracks = [];

    if (format !== 'audio-webm') {
        tracks.push(...activeCanvasStream.getVideoTracks());
    }

    tracks.push(...activeAudioDestination.stream.getAudioTracks());

    activeMasterStream = new MediaStream(tracks);

    try {
        const recorderOptions = { mimeType: activeMimeType };

        if (format !== 'audio-webm') {
            recorderOptions.videoBitsPerSecond = 8000000;
        }

        mediaRecorder = new MediaRecorder(activeMasterStream, recorderOptions);
    } catch (error) {
        console.warn('MediaRecorder options failed. Falling back to browser defaults.', error);
        mediaRecorder = new MediaRecorder(activeMasterStream);
        activeMimeType = mediaRecorder.mimeType || activeMimeType;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error || event);
        setExportStatus('Export failed. Check the browser console.');
        resetExportButton();
        cleanupExportResources();
        recordedChunks = [];
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: activeMimeType });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement('a');
        downloadLink.style.display = 'none';
        downloadLink.href = url;
        downloadLink.download = `organon-render-${Date.now()}.${activeExtension}`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(url);
        cleanupExportResources();
        recordedChunks = [];

        setExportStatus(`Export complete: ${activeMimeType}`);
        resetExportButton();
        console.log(`Export complete: ${activeMimeType}`);
    };

    mediaRecorder.start(1000);
    setExportButtonRecording();
    setExportStatus(`Recording live canvas stream as ${activeMimeType}`);
    console.log(`Recording started: ${activeMimeType}`);
}

export function stopExport() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        setExportStatus('Export stopped. Preparing download...');
        mediaRecorder.stop();
    }
}
