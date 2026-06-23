/**
 * ORGANON STUDIO: ADVANCED AUDIO TIMELINE CONTROLLER
 * v0.13 — output dimensions, startup version toast, black Project Files bin, and throttled timeline-drag rendering.
 * Basic Mode remains completely separate and unchanged.
 */

import { AdvancedTimeline } from './advanced-timeline.js';
import { AdvancedMediaEngine } from './advanced-media-engine.js';

(() => {
    const FILE_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv|mp3|wav|m4a|aac|ogg|opus|flac|gif|webp|png|jpe?g)$/i;
    const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
    const AUDIO_PATTERN = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
    const STICKER_PATTERN = /\.(gif|webp|png)$/i;
    const BACKGROUND_PATTERN = /\.(jpe?g)$/i;
    const state = { files:[], tracks:[], selectedTrackId:null, selectedFileId:null, contextTrackId:null, dragDepth:0, isSeeking:false, serial:0, liveRenderRequest:null, toastTimer:null };

    const elements = {
        app: document.getElementById('advanced-app'), canvas:document.getElementById('advanced-canvas'), mediaBin:document.getElementById('media-bin'),
        previewStage:document.getElementById('preview-stage'), previewResizeHandle:document.getElementById('preview-resize-handle'), previewEmpty:document.getElementById('preview-empty'), previewState:document.getElementById('preview-state'),
        previewSeek:document.getElementById('preview-seek'), previewVolume:document.getElementById('preview-volume'), timeReadout:document.getElementById('time-readout'),
        btnPlay:document.getElementById('btn-play'), btnPreviewMute:document.getElementById('btn-preview-mute'), btnStepBack:document.getElementById('btn-step-back'), btnStepForward:document.getElementById('btn-step-forward'), btnSnapshot:document.getElementById('btn-snapshot'),
        fileInput:document.getElementById('file-input'), btnImport:document.getElementById('btn-import'), btnBrowse:document.getElementById('btn-browse'), btnHeaderBrowse:document.getElementById('btn-header-browse'), btnClear:document.getElementById('btn-clear'), btnBasicMode:document.getElementById('btn-basic-mode'),
        fileList:document.getElementById('file-list'), fileCount:document.getElementById('file-count'), projectDropZone:document.getElementById('project-drop-zone'), dropOverlay:document.getElementById('project-drop-overlay'), canvasWidth:document.getElementById('canvas-width'), canvasHeight:document.getElementById('canvas-height'), canvasAspectLabel:document.getElementById('canvas-aspect-label'), btnApplyCanvas:document.getElementById('btn-apply-canvas'), toast:document.getElementById('app-toast'),
        inspectorKind:document.getElementById('inspector-kind'), inspectorProject:document.getElementById('inspector-project'), inspectorVideo:document.getElementById('inspector-video'), inspectorBackground:document.getElementById('inspector-background'), inspectorAudio:document.getElementById('inspector-audio'), inspectorSticker:document.getElementById('inspector-sticker'),
        selectedVideoName:document.getElementById('selected-video-name'), videoVisibleSwitch:document.getElementById('video-visible-switch'), videoAudioSwitch:document.getElementById('video-audio-switch'), videoAudioVolume:document.getElementById('video-audio-volume'), videoAudioVolumeValue:document.getElementById('video-audio-volume-value'), videoBlendMode:document.getElementById('video-blend-mode'), btnExtractAudio:document.getElementById('btn-extract-audio'),
        selectedBackgroundName:document.getElementById('selected-background-name'), backgroundVisibleSwitch:document.getElementById('background-visible-switch'), backgroundBlendMode:document.getElementById('background-blend-mode'),
        selectedAudioName:document.getElementById('selected-audio-name'), audioAuditionSwitch:document.getElementById('audio-audition-switch'), audioTrackVolume:document.getElementById('audio-track-volume'), audioTrackVolumeValue:document.getElementById('audio-track-volume-value'),
        selectedStickerName:document.getElementById('selected-sticker-name'), stickerVisibleSwitch:document.getElementById('sticker-visible-switch'), stickerBlendMode:document.getElementById('sticker-blend-mode'), stickerTransparencyMode:document.getElementById('sticker-transparency-mode'), stickerKeyColour:document.getElementById('sticker-key-colour'), stickerKeyColourText:document.getElementById('sticker-key-colour-text'), stickerKeyTolerance:document.getElementById('sticker-key-tolerance'), stickerKeyToleranceValue:document.getElementById('sticker-key-tolerance-value'), stickerEdgeFeather:document.getElementById('sticker-edge-feather'), stickerEdgeFeatherValue:document.getElementById('sticker-edge-feather-value'),
        contextMenu:document.getElementById('timeline-context-menu'), contextMenuTitle:document.getElementById('context-menu-title'), contextAddLayer:document.getElementById('context-add-layer'), contextExtractAudio:document.getElementById('context-extract-audio'), contextRemoveLayer:document.getElementById('context-remove-layer')
    };

    const engine = new AdvancedMediaEngine({
        canvas:elements.canvas, mediaBin:elements.mediaBin,
        onTimeChange:updateTimeDisplay,
        onDurationChange:(duration) => { timeline.setDuration(duration); updateTimeDisplay({ currentTime:engine.currentTime, duration }); },
        onPlaybackChange:setPlayButton,
        onRenderError:(error) => { elements.previewState.textContent = `Preview error: ${error.message}`; }
    });
    const timeline = new AdvancedTimeline({
        lanesElement:document.getElementById('timeline-lanes'), rulerElement:document.getElementById('timeline-ruler'), emptyElement:document.getElementById('timeline-empty'),
        onSelect:selectTrack, onContextMenu:openContextMenu, onDropProjectFile:placeProjectFile, onTrackChange:onTimelineTrackChanged, onSeek:(time) => engine.seek(time)
    });

    function clamp(value,min,max) { return Math.min(max,Math.max(min,value)); }
    function formatTime(seconds) { const safe=Math.max(0,Number(seconds)||0), minutes=Math.floor(safe/60), remainder=Math.floor(safe%60).toString().padStart(2,'0'); return `${minutes}:${remainder}`; }
    function getKind(file) {
        const name=file.name || '';
        if (file.type?.startsWith('video/') || VIDEO_PATTERN.test(name)) return 'video';
        if (file.type?.startsWith('audio/') || AUDIO_PATTERN.test(name)) return 'audio';
        if (file.type==='image/jpeg' || BACKGROUND_PATTERN.test(name)) return 'background';
        if (file.type==='image/gif' || file.type==='image/webp' || file.type==='image/png' || STICKER_PATTERN.test(name)) return 'sticker';
        return null;
    }
    function kindLabel(kind) { return ({ video:'🎬', audio:'🎵', sticker:'✨', background:'🖼️' })[kind] || '📄'; }
    function kindName(kind) { return ({ video:'video', audio:'audio', sticker:'image / sticker', background:'jpeg background' })[kind] || 'file'; }
    function getTrack(trackId=state.selectedTrackId) { return state.tracks.find((track) => track.id===trackId) || null; }
    function getFile(fileId) { return state.files.find((file) => file.id===fileId) || null; }
    function trackLabel(type, order) { return `${type==='sticker'?'Sticker':type==='video'?'Video':type==='background'?'Background':'Audio'} ${order}`; }
    function nextOrder(type) { return state.tracks.filter((track) => track.type===type).length + 1; }

    function createTrack(type, extras={}) {
        const order=nextOrder(type);
        return {
            id:`${type}-${Date.now()}-${++state.serial}`, type, order, label:trackLabel(type,order), start:0, sourceDuration:0, clipDuration:0,
            sourceName:'', file:null, visible:true, blendMode:'source-over', audio:{ volume:1, muted:false }, transparency:{ mode:'native', keyColour:'#00ff00', tolerance:30, feather:8 }, ...extras
        };
    }

    function addBlankLayer(type) {
        const track=createTrack(type);
        state.tracks.push(track);
        refreshAll();
        selectTrack(track.id);
        return track;
    }

    async function loadTrackFromFile(track, entry, start=0) {
        track.start=Math.max(0,Number(start)||0);
        try {
            await engine.loadTrack(track,entry.file);
            if (!track.clipDuration) track.clipDuration=(track.type==='sticker'||track.type==='background')?3:track.sourceDuration||1;
            refreshAll();
            selectTrack(track.id);
            elements.previewState.textContent=`Loaded ${entry.name}`;
        } catch (error) {
            elements.previewState.textContent=`Could not load ${entry.name}`;
            alert(`Could not load ${entry.name}. ${error.message}`);
        }
    }

    async function placeProjectFile({ fileId, trackId, start }) {
        const entry=getFile(fileId);
        if (!entry) return;
        let track=getTrack(trackId);
        if (track && track.sourceName) track=null;
        // A Project File always creates/uses a lane of its own media type. This means
        // a file can be dropped anywhere in the timeline without being blocked by the
        // type of a lane already underneath the pointer.
        if (track && track.type!==entry.kind) track=null;
        if (!track) { track=createTrack(entry.kind); state.tracks.push(track); }
        await loadTrackFromFile(track,entry,start);
    }

    function greatestCommonDivisor(a,b) { let x=Math.abs(a), y=Math.abs(b); while(y) [x,y]=[y,x%y]; return x || 1; }
    function updateCanvasAspectLabel(width,height) { const divisor=greatestCommonDivisor(width,height); elements.canvasAspectLabel.textContent=`${Math.round(width/divisor)}:${Math.round(height/divisor)}`; }
    function applyCanvasResolution({ announce=false } = {}) {
        const width=clamp(Math.round(Number(elements.canvasWidth.value)||1280),64,7680);
        const height=clamp(Math.round(Number(elements.canvasHeight.value)||720),64,7680);
        elements.canvasWidth.value=String(width); elements.canvasHeight.value=String(height);
        engine.setCanvasResolution(width,height);
        elements.previewStage.style.aspectRatio=`${width} / ${height}`;
        updateCanvasAspectLabel(width,height);
        if (announce) { elements.previewState.textContent=`Canvas set to ${width} × ${height}`; showToast(`Canvas set to ${width} × ${height}`); }
    }
    function showToast(message, duration=3200) {
        if (!elements.toast) return;
        clearTimeout(state.toastTimer);
        elements.toast.textContent=message;
        elements.toast.classList.add('visible');
        state.toastTimer=setTimeout(()=>elements.toast.classList.remove('visible'),duration);
    }

    function renderFiles() {
        elements.fileList.innerHTML='';
        elements.fileCount.textContent=`${state.files.length} media`;
        if (!state.files.length) {
            elements.fileList.innerHTML='<div class="empty-file-list">No project files yet.<br>Import or drop media here first.</div>';
            return;
        }
        for (const entry of state.files) {
            const row=document.createElement('div');
            row.className=`file-row kind-${entry.kind}${entry.id===state.selectedFileId?' active':''}`;
            row.draggable=true; row.tabIndex=0; row.dataset.fileId=entry.id; row.title='Drag this file to the timeline.';
            row.innerHTML=`<span class="file-kind">${kindLabel(entry.kind)}</span><span><span class="file-name">${escapeHtml(entry.name)}</span><span class="file-meta">${kindName(entry.kind)} · ${formatFileSize(entry.file.size)} · drag to timeline</span></span>`;
            row.addEventListener('dragstart',(event) => {
                state.selectedFileId=entry.id;
                event.dataTransfer.effectAllowed='copy';
                // Keep both a custom type and a plain-text fallback. Do not redraw
                // Project Files here: removing the source node during dragstart
                // cancels the native drag in Chromium.
                event.dataTransfer.setData('application/x-organon-project-file',entry.id);
                event.dataTransfer.setData('text/x-organon-project-file',entry.id);
                event.dataTransfer.setData('text/plain',entry.id);
                timeline.beginProjectFileDrag(entry.id);
                row.classList.add('is-dragging');
            });
            row.addEventListener('dragend',() => {
                timeline.endProjectFileDrag();
                row.classList.remove('is-dragging');
            });
            row.addEventListener('click',() => { state.selectedFileId=entry.id; renderFiles(); });
            row.addEventListener('keydown',(event)=> { if(event.key==='Enter'||event.key===' ') { event.preventDefault(); state.selectedFileId=entry.id; renderFiles(); } });
            elements.fileList.appendChild(row);
        }
    }
    function escapeHtml(value) { return String(value).replace(/[&<>'"]/g,(character)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[character])); }
    function formatFileSize(size) { if(!Number.isFinite(size)) return 'unknown size'; if(size<1024*1024) return `${Math.max(1,Math.round(size/1024))} KB`; return `${(size/(1024*1024)).toFixed(1)} MB`; }

    async function addFiles(files) {
        const usable=[];
        for (const file of Array.from(files||[])) {
            const kind=getKind(file);
            if(!kind || !FILE_PATTERN.test(file.name)) continue;
            const duplicate=state.files.some((entry)=>entry.file.name===file.name && entry.file.size===file.size && entry.file.lastModified===file.lastModified);
            if(!duplicate) usable.push({ id:`file-${Date.now()}-${++state.serial}`, file, name:file.name, kind });
        }
        if(!usable.length) { elements.previewState.textContent='No supported media files found.'; return; }
        state.files.push(...usable); renderFiles(); elements.previewState.textContent=`Added ${usable.length} file${usable.length===1?'':'s'} to Project Files`;
    }

    function updateTimeDisplay({ currentTime,duration }) {
        const safeDuration=Math.max(0,Number(duration)||0); const safeCurrent=clamp(Number(currentTime)||0,0,safeDuration||Infinity);
        elements.timeReadout.textContent=`${formatTime(safeCurrent)} / ${formatTime(safeDuration)}`;
        if(!state.isSeeking) { elements.previewSeek.max=String(safeDuration); elements.previewSeek.value=String(Math.min(safeCurrent,safeDuration)); }
        elements.previewSeek.disabled=safeDuration<=0; timeline.setCurrentTime(safeCurrent);
        elements.previewEmpty.hidden=state.tracks.some((track)=>track.type==='video'&&track.sourceName);
    }
    function setPlayButton(isPlaying) { elements.btnPlay.textContent=isPlaying?'⏸️':'▶️'; elements.btnPlay.title=isPlaying?'Pause preview':'Play preview'; }
    function syncPreviewMuteButton() { const muted=engine.previewMuted||engine.previewVolume<=0; elements.btnPreviewMute.textContent=muted?'🔇':'🔊'; elements.btnPreviewMute.title=muted?'Unmute preview':'Mute preview'; }
    function setSwitch(button,on) { button.classList.toggle('on',Boolean(on)); button.setAttribute('aria-pressed',String(Boolean(on))); }

    function selectTrack(trackId) { state.selectedTrackId=trackId; timeline.setSelectedTrack(trackId); syncInspector(); }
    function syncInspector() {
        const track=getTrack();
        elements.inspectorKind.textContent=track?track.label:'Project';
        elements.inspectorProject.hidden=Boolean(track); elements.inspectorVideo.hidden=track?.type!=='video'; elements.inspectorBackground.hidden=track?.type!=='background'; elements.inspectorAudio.hidden=track?.type!=='audio'; elements.inspectorSticker.hidden=track?.type!=='sticker';
        if(!track) return;
        if(track.type==='video') {
            elements.selectedVideoName.textContent=track.sourceName||track.label; setSwitch(elements.videoVisibleSwitch,track.visible!==false); setSwitch(elements.videoAudioSwitch,!track.audio.muted); elements.videoAudioVolume.value=String(Math.round(track.audio.volume*100)); elements.videoAudioVolumeValue.textContent=`${Math.round(track.audio.volume*100)}%`; elements.videoBlendMode.value=track.blendMode||'source-over'; elements.btnExtractAudio.disabled=!track.file;
        }
        if(track.type==='background') { elements.selectedBackgroundName.textContent=track.sourceName||track.label; setSwitch(elements.backgroundVisibleSwitch,track.visible!==false); elements.backgroundBlendMode.value=track.blendMode||'source-over'; }
        if(track.type==='audio') { elements.selectedAudioName.textContent=track.sourceName||track.label; setSwitch(elements.audioAuditionSwitch,!track.audio.muted); elements.audioTrackVolume.value=String(Math.round(track.audio.volume*100)); elements.audioTrackVolumeValue.textContent=`${Math.round(track.audio.volume*100)}%`; }
        if(track.type==='sticker') { const settings=track.transparency; elements.selectedStickerName.textContent=track.sourceName||track.label; setSwitch(elements.stickerVisibleSwitch,track.visible!==false); elements.stickerBlendMode.value=track.blendMode||'source-over'; elements.stickerTransparencyMode.value=settings.mode||'native'; elements.stickerKeyColour.value=settings.keyColour||'#00ff00'; elements.stickerKeyColourText.value=settings.keyColour||'#00ff00'; elements.stickerKeyTolerance.value=String(settings.tolerance??30); elements.stickerKeyToleranceValue.textContent=`${settings.tolerance??30}%`; elements.stickerEdgeFeather.value=String(settings.feather??8); elements.stickerEdgeFeatherValue.textContent=`${settings.feather??8}%`; }
    }
    function refreshAll() { engine.setTracks(state.tracks); timeline.setTracks(state.tracks); timeline.setSelectedTrack(state.selectedTrackId); syncInspector(); }
    function onTimelineTrackChanged(track, detail = {}) {
        if (detail.live) {
            // Pointer events can arrive much faster than display frames. The clip itself
            // moves immediately in the timeline; compositor redraw is coalesced to one
            // requestAnimationFrame so dragging does not repeatedly repaint the canvas.
            if (state.liveRenderRequest !== null) return;
            state.liveRenderRequest=requestAnimationFrame(()=> {
                state.liveRenderRequest=null;
                engine.renderFrame();
            });
            return;
        }
        if (state.liveRenderRequest !== null) {
            cancelAnimationFrame(state.liveRenderRequest);
            state.liveRenderRequest=null;
        }
        engine.setTracks(state.tracks);
        timeline.setDuration(engine.getTimelineDuration());
        syncInspector();
    }

    async function extractAudioFromSelectedVideo() {
        const video=getTrack();
        if(!video || video.type!=='video' || !video.file) return;
        const audio=createTrack('audio',{ extractedFrom:video.id, start:video.start, clipDuration:video.clipDuration, label:`Extracted Audio ${nextOrder('audio')}` });
        state.tracks.push(audio); video.audio.muted=true;
        await loadTrackFromFile(audio,{ file:video.file, name:video.sourceName, kind:'audio' },video.start);
        audio.clipDuration=Math.min(video.clipDuration,audio.sourceDuration||video.clipDuration); refreshAll(); selectTrack(audio.id);
    }

    function openContextMenu(trackId,x,y) {
        selectTrack(trackId);
        state.contextTrackId=trackId; const track=getTrack(trackId); if(!track) return;
        elements.contextMenuTitle.textContent=track.sourceName||track.label;
        elements.contextAddLayer.textContent=`➕ Add ${track.type==='sticker'?'Sticker':track.type==='video'?'Video':track.type==='background'?'Background':'Audio'} layer`;
        elements.contextExtractAudio.hidden=track.type!=='video'||!track.file;
        elements.contextMenu.hidden=false;
        const maxX=window.innerWidth-elements.contextMenu.offsetWidth-8, maxY=window.innerHeight-elements.contextMenu.offsetHeight-8;
        elements.contextMenu.style.left=`${clamp(x,8,maxX)}px`; elements.contextMenu.style.top=`${clamp(y,8,maxY)}px`;
    }
    function hideContextMenu() { elements.contextMenu.hidden=true; state.contextTrackId=null; }
    function addLayerFromContext() { const track=getTrack(state.contextTrackId); if(!track) return; addBlankLayer(track.type); hideContextMenu(); }
    function removeLayerFromContext() { const track=getTrack(state.contextTrackId); if(!track) return; engine.detachTrack(track,false); state.tracks=state.tracks.filter((item)=>item.id!==track.id); state.selectedTrackId=null; refreshAll(); hideContextMenu(); }

    function installPreviewResize() {
        let active=null;
        elements.previewResizeHandle.addEventListener('pointerdown',(event)=> { event.preventDefault(); active={ pointerId:event.pointerId, x:event.clientX, width:elements.previewStage.getBoundingClientRect().width }; elements.previewStage.classList.add('is-resizing'); elements.previewResizeHandle.setPointerCapture?.(event.pointerId); });
        elements.previewResizeHandle.addEventListener('pointermove',(event)=> { if(!active||active.pointerId!==event.pointerId) return; const parentWidth=elements.previewStage.parentElement.clientWidth; const width=clamp(active.width+(event.clientX-active.x),300,Math.max(300,parentWidth)); elements.previewStage.style.width=`${Math.round(width)}px`; });
        const stop=(event)=> { if(!active||active.pointerId!==event.pointerId) return; active=null; elements.previewStage.classList.remove('is-resizing'); };
        elements.previewResizeHandle.addEventListener('pointerup',stop); elements.previewResizeHandle.addEventListener('pointercancel',stop);
    }

    function hasExternalFiles(event) {
        return Array.from(event.dataTransfer?.types || []).includes('Files');
    }

    function installGlobalFileDrop() {
        const show=()=>elements.dropOverlay.classList.add('visible');
        const hide=()=>elements.dropOverlay.classList.remove('visible');
        const addDroppedFiles=async(event)=> {
            if (event.__organonExternalFilesHandled) return;
            const files=event.dataTransfer?.files;
            if (!files?.length) return;
            event.__organonExternalFilesHandled=true;
            event.preventDefault();
            // One capture-phase handler owns each external drop. Without this,
            // a drop on the Project Files pad would be processed once globally
            // and a second time by the pad itself.
            event.stopPropagation();
            state.dragDepth=0;
            hide();
            await addFiles(files);
        };

        // Capture phase deliberately blocks the browser from opening a dropped file
        // before it reaches the app. Project File row drags do not contain Files,
        // so they are left alone for the timeline module.
        document.addEventListener('dragenter',(event)=> {
            if (!hasExternalFiles(event)) return;
            event.preventDefault();
            state.dragDepth+=1;
            show();
        }, true);
        document.addEventListener('dragover',(event)=> {
            if (!hasExternalFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect='copy';
        }, true);
        document.addEventListener('dragleave',(event)=> {
            if (!hasExternalFiles(event)) return;
            state.dragDepth=Math.max(0,state.dragDepth-1);
            if (!state.dragDepth) hide();
        }, true);
        document.addEventListener('drop',addDroppedFiles, true);

        // The Project Files pad has its own visible drop target as well. This gives
        // the user a reliable place to aim without relying on whole-window events.
        const zone=elements.projectDropZone;
        zone.addEventListener('dragenter',(event)=> {
            if (!hasExternalFiles(event)) return;
            event.preventDefault();
            zone.classList.add('drop-target-active');
        });
        zone.addEventListener('dragover',(event)=> {
            if (!hasExternalFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect='copy';
            zone.classList.add('drop-target-active');
        });
        zone.addEventListener('dragleave',()=>zone.classList.remove('drop-target-active'));
        zone.addEventListener('drop',async(event)=> {
            if (!hasExternalFiles(event)) return;
            zone.classList.remove('drop-target-active');
            await addDroppedFiles(event);
        });
        zone.addEventListener('click',(event)=> { if(event.target.closest('.file-row')) return; elements.fileInput.click(); });
        zone.addEventListener('keydown',(event)=>{
            if(event.key==='Enter'||event.key===' ') {
                event.preventDefault();
                elements.fileInput.click();
            }
        });
    }


    elements.btnApplyCanvas.addEventListener('click',()=>applyCanvasResolution({ announce:true }));
    for (const dimensionInput of [elements.canvasWidth,elements.canvasHeight]) {
        dimensionInput.addEventListener('change',()=>applyCanvasResolution({ announce:true }));
        dimensionInput.addEventListener('keydown',(event)=> { if(event.key==='Enter') { event.preventDefault(); applyCanvasResolution({ announce:true }); } });
    }

    elements.btnImport.addEventListener('click',()=>elements.fileInput.click()); elements.btnBrowse.addEventListener('click',browseDirectory); elements.btnHeaderBrowse.addEventListener('click',browseDirectory); elements.btnBasicMode.addEventListener('click',()=>{ window.location.href='./index.html'; });
    elements.btnClear.addEventListener('click',()=> { if(!state.files.length&&!state.tracks.length) return; if(!confirm('Clear all Project Files and all timeline clips?')) return; engine.clearAll(); state.files=[]; state.tracks=[]; state.selectedTrackId=null; state.selectedFileId=null; renderFiles(); refreshAll(); });
    elements.fileInput.addEventListener('change',async(event)=> { await addFiles(event.target.files); event.target.value=''; });
    async function browseDirectory() {
        if(!window.showDirectoryPicker) { elements.fileInput.click(); return; }
        try { const handle=await window.showDirectoryPicker({ mode:'read' }); const files=[]; for await(const entry of handle.values()) if(entry.kind==='file'&&FILE_PATTERN.test(entry.name)) files.push(await entry.getFile()); await addFiles(files); }
        catch(error) { if(error.name!=='AbortError') { console.warn(error); elements.previewState.textContent='Folder browse was unavailable. Use Import instead.'; } }
    }

    elements.btnPlay.addEventListener('click',async()=> { try { await engine.togglePlay(); } catch(error) { elements.previewState.textContent=error.message; } });
    elements.btnStepBack.addEventListener('click',()=>engine.stepFrame(-1)); elements.btnStepForward.addEventListener('click',()=>engine.stepFrame(1)); elements.btnSnapshot.addEventListener('click',async()=> { try{await engine.snapshot();}catch(error){elements.previewState.textContent=error.message;} });
    elements.btnPreviewMute.addEventListener('click',()=> { engine.togglePreviewMute(); syncPreviewMuteButton(); }); elements.previewVolume.addEventListener('input',(event)=> { engine.setPreviewVolume(Number(event.target.value)/100); syncPreviewMuteButton(); });
    elements.previewSeek.addEventListener('pointerdown',()=>{state.isSeeking=true;}); elements.previewSeek.addEventListener('input',(event)=>engine.seek(Number(event.target.value))); elements.previewSeek.addEventListener('change',(event)=>{state.isSeeking=false; engine.seek(Number(event.target.value));});

    elements.videoVisibleSwitch.addEventListener('click',()=> { const track=getTrack(); if(!track||track.type!=='video')return; track.visible=!track.visible; refreshAll(); });
    elements.videoAudioSwitch.addEventListener('click',()=> { const track=getTrack(); if(!track||track.type!=='video')return; track.audio.muted=!track.audio.muted; refreshAll(); });
    elements.videoAudioVolume.addEventListener('input',()=> { const track=getTrack(); if(!track||track.type!=='video')return; track.audio.volume=Number(elements.videoAudioVolume.value)/100; elements.videoAudioVolumeValue.textContent=`${elements.videoAudioVolume.value}%`; engine.setTracks(state.tracks); });
    elements.videoBlendMode.addEventListener('change',()=> { const track=getTrack(); if(!track||track.type!=='video')return; track.blendMode=elements.videoBlendMode.value; engine.renderFrame(); }); elements.btnExtractAudio.addEventListener('click',extractAudioFromSelectedVideo);
    elements.backgroundVisibleSwitch.addEventListener('click',()=> { const track=getTrack(); if(!track||track.type!=='background')return; track.visible=!track.visible; refreshAll(); });
    elements.backgroundBlendMode.addEventListener('change',()=> { const track=getTrack(); if(!track||track.type!=='background')return; track.blendMode=elements.backgroundBlendMode.value; engine.renderFrame(); });
        elements.audioAuditionSwitch.addEventListener('click',()=> { const track=getTrack(); if(!track||track.type!=='audio')return; track.audio.muted=!track.audio.muted; refreshAll(); });
    elements.audioTrackVolume.addEventListener('input',()=> { const track=getTrack(); if(!track||track.type!=='audio')return; track.audio.volume=Number(elements.audioTrackVolume.value)/100; elements.audioTrackVolumeValue.textContent=`${elements.audioTrackVolume.value}%`; engine.setTracks(state.tracks); });
    elements.stickerVisibleSwitch.addEventListener('click',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; track.visible=!track.visible; refreshAll(); });
    elements.stickerBlendMode.addEventListener('change',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; track.blendMode=elements.stickerBlendMode.value; engine.renderFrame(); });
    elements.stickerTransparencyMode.addEventListener('change',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; track.transparency.mode=elements.stickerTransparencyMode.value; engine.renderFrame(); });
    elements.stickerKeyColour.addEventListener('input',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; track.transparency.keyColour=elements.stickerKeyColour.value; elements.stickerKeyColourText.value=track.transparency.keyColour; engine.renderFrame(); });
    elements.stickerKeyColourText.addEventListener('change',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; const value=elements.stickerKeyColourText.value.trim(); const color=/^#[0-9a-f]{6}$/i.test(value)?value:'#00ff00'; track.transparency.keyColour=color; elements.stickerKeyColour.value=color; elements.stickerKeyColourText.value=color; engine.renderFrame(); });
    elements.stickerKeyTolerance.addEventListener('input',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; track.transparency.tolerance=Number(elements.stickerKeyTolerance.value); elements.stickerKeyToleranceValue.textContent=`${track.transparency.tolerance}%`; engine.renderFrame(); });
    elements.stickerEdgeFeather.addEventListener('input',()=> { const track=getTrack(); if(!track||track.type!=='sticker')return; track.transparency.feather=Number(elements.stickerEdgeFeather.value); elements.stickerEdgeFeatherValue.textContent=`${track.transparency.feather}%`; engine.renderFrame(); });
    elements.contextAddLayer.addEventListener('click',addLayerFromContext); elements.contextExtractAudio.addEventListener('click',async()=>{await extractAudioFromSelectedVideo(); hideContextMenu();}); elements.contextRemoveLayer.addEventListener('click',removeLayerFromContext);
    document.addEventListener('click',(event)=> { if(!elements.contextMenu.contains(event.target)) hideContextMenu(); }); document.addEventListener('keydown',(event)=> { if(event.key==='Escape')hideContextMenu(); }); window.addEventListener('beforeunload',()=>engine.destroy());

    installPreviewResize();
    installGlobalFileDrop();
    applyCanvasResolution();
    renderFiles(); refreshAll(); syncPreviewMuteButton();
    requestAnimationFrame(()=>showToast('Advanced Audio Timeline v0.13 loaded'));
})();
