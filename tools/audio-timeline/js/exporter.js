/**
 * ORGANON STUDIO: EXPORTER
 * Live browser recorder for the Audio Timeline canvas and Web Audio graph.
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

function getSupportedRecorderProfile(format) {
    if (format === 'audio-webm') {
        const audioTypes = [
            'audio/webm;codecs=opus',
            'audio/webm'
        ];

        for (const type of audioTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                return { mimeType: type, extension: 'webm', audioOnly: true };
            }
        }

        return { mimeType: '', extension: 'webm', audioOnly: true };
    }

    if (format === 'mp4') {
        const mp4Types = [
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/mp4'
        ];

        for (const type of mp4Types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return { mimeType: type, extension: 'mp4', audioOnly: false };
            }
        }

        console.warn('Native MediaRecorder MP4 is not supported here. Falling back to WebM.');
    }

    const webmTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ];

    for (const type of webmTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
            return { mimeType: type, extension: 'webm', audioOnly: false };
        }
    }

    return { mimeType: '', extension: 'webm', audioOnly: false };
}

function setExportStatus(message) {
    const exportStatus = document.getElementById('export-status');
    if (exportStatus) {
        exportStatus.textContent = message;
    }
}

function resetExportButton(message = 'Export complete.') {
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
        exportBtn.innerText = 'Export Render';
        exportBtn.style.background = '';
    }

    setExportStatus(message);
}

function cleanupExportGraph() {
    if (activeMasterStream) {
        activeMasterStream.getTracks().forEach(track => track.stop());
    }

    if (activeCanvasStream) {
        activeCanvasStream.getTracks().forEach(track => track.stop());
    }

    if (activeAudioDestination) {
        try {
            masterMixer.disconnect(activeAudioDestination);
        } catch (error) {
            console.warn('Export audio destination was already disconnected.', error);
        }
    }

    activeMasterStream = null;
    activeCanvasStream = null;
    activeAudioDestination = null;
}

export function startExport(format) {
    if (!window.MediaRecorder) {
        alert('MediaRecorder is not available in this browser.');
        return false;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.warn('Export already running.');
        return false;
    }

    recordedChunks = [];

    const profile = getSupportedRecorderProfile(format);
    activeMimeType = profile.mimeType;
    activeExtension = profile.extension;

    activeAudioDestination = audioCtx.createMediaStreamDestination();
    masterMixer.connect(activeAudioDestination);

    activeCanvasStream = profile.audioOnly ? null : masterCanvas.captureStream(30);

    const streamTracks = [
        ...(activeCanvasStream ? activeCanvasStream.getVideoTracks() : []),
        ...activeAudioDestination.stream.getAudioTracks()
    ];

    activeMasterStream = new MediaStream(streamTracks);

    try {
        const recorderOptions = activeMimeType
            ? { mimeType: activeMimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 }
            : { videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 };

        mediaRecorder = new MediaRecorder(activeMasterStream, recorderOptions);
        activeMimeType = mediaRecorder.mimeType || activeMimeType || 'application/octet-stream';
    } catch (error) {
        cleanupExportGraph();
        console.error('MediaRecorder initialization failed:', error);
        alert('Export could not start in this browser.');
        resetExportButton('Export failed.');
        return false;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error || event);
        cleanupExportGraph();
        resetExportButton('Export failed. Check the console.');
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: activeMimeType });
        recordedChunks = [];

        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.style.display = 'none';
        downloadLink.href = url;
        downloadLink.download = `organon-render-${Date.now()}.${activeExtension}`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);

        cleanupExportGraph();
        resetExportButton(`Export complete: ${activeMimeType}`);
        console.log(`Export complete: ${activeMimeType}`);
    };

    mediaRecorder.start(1000);

    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
        exportBtn.innerText = 'STOP & SAVE';
        exportBtn.style.background = 'var(--brand-red)';
    }

    setExportStatus(`Recording live stream as ${activeMimeType}`);
    return true;
}

export function stopExport() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        setExportStatus('Export stopped. Preparing download...');
        mediaRecorder.stop();
    }
}
