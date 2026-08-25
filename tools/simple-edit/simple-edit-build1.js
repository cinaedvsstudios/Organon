"use strict";

(function installOrgavoxBuild1(){
  const STYLE_ID="orgavox-build1-style", LIMIT=80;
  let undoStack=[], redoStack=[], last=null, lastSig="", restoring=false, installed=false;
  const masterNodes=new Set();

  function css(){
    document.getElementById(STYLE_ID)?.remove();
    const s=document.createElement("style");
    s.id=STYLE_ID;
    s.textContent=`
      body.simple-edit-phase1 .topbar .tool-button,body.simple-edit-phase1 .topbar .icon-button,body.simple-edit-phase1 .topbar .range-control span,body.simple-edit-phase1 .topbar .range-control output{font-size:.62rem!important;line-height:1!important;font-weight:800!important}
      body.simple-edit-phase1 .topbar .tool-button,body.simple-edit-phase1 .topbar .icon-button{min-height:36px!important;height:36px!important;align-items:center!important}
      body.simple-edit-phase1 .time-readout{font-size:.94rem!important;line-height:1!important}
      #playBtn.orgavox-play-blue{border-color:rgba(117,178,222,.96)!important;background:linear-gradient(180deg,rgba(54,143,220,.98),rgba(21,72,139,.96))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.2)!important}
      #playBtn.orgavox-playing{animation:orgavoxPlayPulse .78s ease-in-out infinite alternate!important}
      @keyframes orgavoxPlayPulse{from{box-shadow:0 0 0 1px rgba(117,178,222,.35),0 0 12px rgba(75,155,255,.28)!important;transform:translateY(0)}to{box-shadow:0 0 0 1px rgba(168,220,255,.74),0 0 25px rgba(75,155,255,.62)!important;transform:translateY(-1px)}}
      .orgavox-history-button{border-color:rgba(224,163,96,.74)!important;background:linear-gradient(180deg,rgba(85,62,35,.84),rgba(30,20,12,.94))!important;color:#ffe4a8!important}
      .orgavox-history-button:disabled{opacity:.44!important;filter:grayscale(.55);cursor:not-allowed!important}
      .orgavox-global-volume-control{display:grid!important;grid-template-columns:auto minmax(58px,92px) 42px!important;align-items:center!important;gap:7px!important;min-width:155px!important;margin:0!important}
      .orgavox-editable-counter{cursor:text!important;border:1px solid rgba(224,163,96,.24)!important;border-radius:8px!important;padding:4px 6px!important;min-width:42px!important;text-align:center!important;background:rgba(0,0,0,.22)!important}
      .orgavox-editable-counter:focus{outline:2px solid rgba(117,178,222,.55)!important;color:#fff!important;box-shadow:0 0 14px rgba(117,178,222,.24)!important}
    `;
    document.head.appendChild(s);
  }

  function clone(v){
    if(v==null||typeof v!=="object")return v;
    if(typeof AudioBuffer!=="undefined"&&v instanceof AudioBuffer)return v;
    if(v.getChannelData&&v.sampleRate&&v.numberOfChannels)return v;
    if(v instanceof Float32Array||v instanceof File||v instanceof Blob)return v;
    if(Array.isArray(v))return v.map(clone);
    const o={};
    Object.entries(v).forEach(([k,x])=>{if(k!=="renderCache")o[k]=clone(x)});
    return o;
  }
  function snap(){return{assets:state.assets.map(clone),clips:state.clips.map(clone),markers:Array.isArray(state.markers)?state.markers.map(clone):[],selectedAssetId:state.selectedAssetId,selectedClipId:state.selectedClipId,selectedTrack:state.selectedTrack,pixelsPerSecond:state.pixelsPerSecond,playhead:state.playhead,stretchMode:!!state.stretchMode,globalVolume:Number(state.globalVolume??100)}}
  function sig(s){return JSON.stringify(s,(k,v)=>["buffer","bufferOverride","file","peaks","renderCache","activeSources","raf","toastTimer","clipDrag"].includes(k)?undefined:v)}
  function baseline(){last=snap();lastSig=sig(last);buttons()}
  function record(){if(restoring||!last)return;const now=snap(), ns=sig(now);if(ns===lastSig)return;undoStack.push(last);if(undoStack.length>LIMIT)undoStack.shift();redoStack=[];last=now;lastSig=ns;buttons()}
  function apply(s){if(!s)return;restoring=true;try{stopPlayback(false);state.assets=s.assets.map(clone);state.clips=s.clips.map(clone);state.markers=Array.isArray(s.markers)?s.markers.map(clone):[];state.selectedAssetId=s.selectedAssetId||state.assets[0]?.id||null;state.selectedClipId=s.selectedClipId||null;state.selectedTrack=Math.max(0,Math.min(9,Number(s.selectedTrack)||0));state.pixelsPerSecond=Math.max(25,Math.min(500,Number(s.pixelsPerSecond)||80));state.playhead=Math.max(0,Number(s.playhead)||0);state.stretchMode=!!s.stretchMode;state.globalVolume=Math.max(0,Math.min(200,Number(s.globalVolume??100)));state.renderCache.clear();if(ui.zoomSlider)ui.zoomSlider.value=state.pixelsPerSecond;if(ui.zoomOut)ui.zoomOut.textContent=`${Math.round(state.pixelsPerSecond/80*100)}%`;globalUpdate();renderAssets();syncSelectedControls();renderTimeline();setPlayhead(state.playhead,true)}finally{restoring=false;last=snap();lastSig=sig(last);buttons()}}
  function undo(){if(!undoStack.length)return;const s=undoStack.pop();redoStack.push(snap());apply(s);showToast("Undo.")}
  function redo(){if(!redoStack.length)return;const s=redoStack.pop();undoStack.push(snap());apply(s);showToast("Redo.")}
  function buttons(){if(ui.undoBtn)ui.undoBtn.disabled=!undoStack.length;if(ui.redoBtn)ui.redoBtn.disabled=!redoStack.length}

  function makeButton(id,text,title,fn){let b=ui[id];if(!b){b=document.createElement("button");b.id=id;b.type="button";b.className="tool-button orgavox-history-button";b.addEventListener("click",fn);ui[id]=b}b.textContent=text;b.title=title;return b}
  function ensureButtons(){makeButton("undoBtn","↶ Undo","Undo — Ctrl+Z",undo);makeButton("redoBtn","↷ Redo","Redo — Ctrl+Y or Ctrl+Shift+Z",redo);buttons()}

  function editable(out,cfg){
    if(!out||out.dataset.orgavoxEditableCounter)return;
    out.dataset.orgavoxEditableCounter="true";out.classList.add("orgavox-editable-counter");out.tabIndex=0;out.setAttribute("role","textbox");
    out.addEventListener("focus",()=>{out.textContent=String(out.textContent||"").replace("%","").trim();document.execCommand?.("selectAll",false,null)});
    out.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key==="Escape"){e.preventDefault();out.blur()}});
    out.addEventListener("blur",()=>{const v=cfg.parse(out.textContent);cfg.apply(v);out.textContent=cfg.format(v)});
  }
  function editableCounters(){
    editable(ui.volumeOut,{parse:t=>Math.max(0,Math.min(200,Number(String(t).replace(/[^\d.]/g,""))||0)),apply:v=>{if(!ui.volumeSlider)return;ui.volumeSlider.value=v;ui.volumeSlider.dispatchEvent(new Event("input",{bubbles:true}));ui.volumeSlider.dispatchEvent(new Event("change",{bubbles:true}));record()},format:v=>`${Math.round(v)}%`});
    editable(ui.zoomOut,{parse:t=>Math.max(25,Math.min(500,Math.round(Math.max(25,Math.min(625,Number(String(t).replace(/[^\d.]/g,""))||100))/100*80))),apply:v=>{if(!ui.zoomSlider)return;state.pixelsPerSecond=v;ui.zoomSlider.value=v;ui.zoomSlider.dispatchEvent(new Event("input",{bubbles:true}));ui.zoomSlider.dispatchEvent(new Event("change",{bubbles:true}));if(ui.zoomOut)ui.zoomOut.textContent=`${Math.round(v/80*100)}%`;record()},format:v=>`${Math.round(v/80*100)}%`});
  }

  function ensureGlobal(){
    if(ui.globalVolumeControl)return ui.globalVolumeControl;
    state.globalVolume=Math.max(0,Math.min(200,Number(state.globalVolume??localStorage.getItem("orgavoxGlobalVolume")??100)));
    const l=document.createElement("label");l.className="range-control orgavox-global-volume-control";l.innerHTML=`<span>🌐 Master</span><input id="globalVolumeSlider" type="range" min="0" max="200" value="${state.globalVolume}"><output id="globalVolumeOut">${state.globalVolume}%</output>`;
    ui.globalVolumeControl=l;ui.globalVolumeSlider=l.querySelector("#globalVolumeSlider");ui.globalVolumeOut=l.querySelector("#globalVolumeOut");
    ui.globalVolumeSlider.addEventListener("input",()=>{state.globalVolume=Math.max(0,Math.min(200,Number(ui.globalVolumeSlider.value)||0));localStorage.setItem("orgavoxGlobalVolume",String(state.globalVolume));globalUpdate();record()});
    editable(ui.globalVolumeOut,{parse:t=>Math.max(0,Math.min(200,Number(String(t).replace(/[^\d.]/g,""))||0)),apply:v=>{state.globalVolume=v;ui.globalVolumeSlider.value=v;localStorage.setItem("orgavoxGlobalVolume",String(v));globalUpdate();record()},format:v=>`${Math.round(v)}%`});
    return l;
  }
  function globalUpdate(){const v=Math.max(0,Math.min(200,Number(state.globalVolume??100)));if(ui.globalVolumeSlider)ui.globalVolumeSlider.value=v;if(ui.globalVolumeOut&&document.activeElement!==ui.globalVolumeOut)ui.globalVolumeOut.textContent=`${Math.round(v)}%`;masterNodes.forEach(g=>{try{g.gain.setTargetAtTime(v/100,g.context.currentTime,.015)}catch{g.gain.value=v/100}})}

  function place(){
    ensureButtons();ensureGlobal();editableCounters();playStyle();
    const edit=document.querySelector(".orgavox-edit-group");
    if(edit&&ui.scissorsBtn){edit.insertBefore(ui.undoBtn,ui.scissorsBtn);edit.insertBefore(ui.redoBtn,ui.scissorsBtn)}
    const main=document.querySelector(".orgavox-main-controls-group");
    if(main&&ui.globalVolumeControl?.parentElement!==main)main.insertBefore(ui.globalVolumeControl,main.firstChild);
    buttons();
  }
  function playStyle(){if(!ui.playBtn)return;ui.playBtn.classList.add("orgavox-play-blue");ui.playBtn.classList.toggle("orgavox-playing",!!state.playing);ui.playBtn.title=state.playing?"Playing — Space pauses":"Play — Space starts"}

  function patchAudio(){
    if(window.__orgavoxBuild1AudioPatched)return;window.__orgavoxBuild1AudioPatched=true;
    const oldConnect=connectClipNodes;
    connectClipNodes=function(ctx,source,clip,dest){const master=ctx.createGain();master.gain.value=Math.max(0,Math.min(2,Number(state.globalVolume??100)/100));masterNodes.add(master);master.connect(dest);source.addEventListener?.("ended",()=>{masterNodes.delete(master);try{master.disconnect()}catch{}},{once:true});return oldConnect(ctx,source,clip,master)};
    const oldStart=startPlayback;startPlayback=async function(){const r=await oldStart.apply(this,arguments);playStyle();return r};
    const oldStop=stopPlayback;stopPlayback=function(){const r=oldStop.apply(this,arguments);playStyle();return r};
    const oldSet=setPlayhead;setPlayhead=function(sec,scroll=false){return oldSet(sec,scroll||!!state.playing)};
  }
  function patchHistory(){
    if(window.__orgavoxBuild1HistoryPatched)return;window.__orgavoxBuild1HistoryPatched=true;
    const oldRender=renderTimeline;renderTimeline=function(){const r=oldRender.apply(this,arguments);window.orgavoxRenderMarkers?.();window.orgavoxUpdateProjectInfoBar?.();setTimeout(record,0);return r};
    const oldAssets=renderAssets;renderAssets=function(){const r=oldAssets.apply(this,arguments);setTimeout(()=>{place();record()},0);return r};
    const oldImport=importFiles;importFiles=async function(){const r=await oldImport.apply(this,arguments);setTimeout(record,0);return r};
    [ui.volumeSlider,ui.echoSlider,ui.zoomSlider].filter(Boolean).forEach(x=>x.addEventListener("change",()=>setTimeout(record,0)));
  }
  function keys(){
    if(window.__orgavoxBuild1KeysBound)return;window.__orgavoxBuild1KeysBound=true;
    document.addEventListener("keydown",e=>{const t=e.target,typing=t&&(/input|textarea|select/i.test(t.tagName||"")||t.isContentEditable);if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();return}if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==="y"){e.preventDefault();redo();return}if(e.code==="Space"&&!typing){e.preventDefault();togglePlayback()}})
  }
  function init(){if(installed)return;installed=true;css();patchAudio();patchHistory();keys();place();setTimeout(()=>{baseline();place();playStyle()},0);setTimeout(()=>{baseline();place()},250)}
  window.orgavoxPlaceBuild1Controls=place;
  window.orgavoxSyncPlaybackPolish=playStyle;
  window.orgavoxUndo=undo;
  window.orgavoxRedo=redo;
  init();
})();
