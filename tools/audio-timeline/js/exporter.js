/**
 * ORGANON STUDIO: EXPORTER
 * Handles multiplexing canvas video and Web Audio into downloadable formats.
 */

import { audioCtx, masterMixer } from './audio-mixer.js';

const masterCanvas = document.getElementById('master-canvas');
let mediaRecorder;
let recordedChunks = [];

export function startExport(format) {
    recordedChunks = [];
    
    // 1. Capture Video Stream from Canvas at 30fps
    const canvasStream = masterCanvas.captureStream(30);
    
    // 2. Capture Audio Stream from our Web Audio master mixer
    const audioDestination = audioCtx.createMediaStreamDestination();
    masterMixer.connect(audioDestination);
    const audioStream = audioDestination.stream;

    // 3. Combine Video and Audio into a single master stream
    const masterStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
    ]);

    // 4. Configure the MIME type based on dropdown selection
    let mimeType = 'video/webm;codecs=vp9'; // Default highly compatible web format
    
    if (format === 'mp4') {
        // Attempt native MP4 if browser supports it (Safari / Newer Chrome)
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else {
            console.warn("Native MP4 not supported on this browser. Falling back to WebM.");
            alert("Native MP4 not supported in this browser. Exporting as WebM. Use an external converter for CapCut.");
        }
    } else if (format === 'mp3') {
        // Audio only
        mimeType = 'audio/webm'; 
        // Note: pure JS MP3 encoding requires heavy external libraries. 
        // WebM audio works perfectly for extraction workflows.
    }

    // 5. Initialize the Native Recorder
    try {
        mediaRecorder = new MediaRecorder(masterStream, { mimeType: mimeType, videoBitsPerSecond: 8000000 });
    } catch (e) {
        console.error('MediaRecorder initialization failed:', e);
        mediaRecorder = new MediaRecorder(masterStream); // Fallback to absolute defaults
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Trigger forced download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Determine file extension
        let ext = format === 'mp4' && mimeType === 'video/mp4' ? 'mp4' : 
                  format === 'mp3' ? 'webm' : 'webm'; // Fallback mapping
                  
        a.download = `organon-render-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log("Export complete!");
    };

    // 6. Start Recording
    mediaRecorder.start();
    console.log(`Recording started in format: ${mimeType}`);
    
    // Visual feedback on the button
    const exportBtn = document.getElementById('btn-export');
    exportBtn.innerText = "🛑 STOP & SAVE";
    exportBtn.style.background = "var(--brand-red)";
}

export function stopExport() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        
        // Reset button UI
        const exportBtn = document.getElementById('btn-export');
        exportBtn.innerText = "Export Render";
        exportBtn.style.background = ""; // return to default CSS
    }
}