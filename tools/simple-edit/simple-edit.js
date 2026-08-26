"use strict";

(async () => {
  const VERSION = "v1.12";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setVersion() {
    window.ORGAVOX_VERSION = VERSION;
    document.title = `Organon — ORGAVOX ${VERSION}`;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
  }

  function localizeSoundFxUrl(value) {
    const text = String(value || "");
    return text.startsWith(REMOTE_SOUND_FX) ? `${LOCAL_SOUND_FX}${text.slice(REMOTE_SOUND_FX.length)}` : value;
  }
  function installLocalSoundFxRouting() {
    if (!window.__orgavoxLocalSoundFxFetchPatched) {
      window.__orgavoxLocalSoundFxFetchPatched = true;
      const originalFetch = window.fetch?.bind(window);
      if (originalFetch) {
        window.fetch = function orgavoxSoundFxFetch(resource, init) {
          if (typeof resource === "string") return originalFetch(localizeSoundFxUrl(resource), init);
          if (resource && typeof resource.url === "string") {
            const localized = localizeSoundFxUrl(resource.url);
            if (localized !== resource.url) return originalFetch(localized, init);
          }
          return originalFetch(resource, init);
        };
      }
    }
    if (!window.__orgavoxLocalSoundFxAudioPatched && window.Audio) {
      window.__orgavoxLocalSoundFxAudioPatched = true;
      const NativeAudio = window.Audio;
      function OrgavoxAudio(src) { return src === undefined ? new NativeAudio() : new NativeAudio(localizeSoundFxUrl(src)); }
      OrgavoxAudio.prototype = NativeAudio.prototype;
      Object.setPrototypeOf(OrgavoxAudio, NativeAudio);
      window.Audio = OrgavoxAudio;
    }
  }
  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.head.appendChild(script);
    });
  }
  function ensureModuleStaging() {
    let staging = document.getElementById("orgavoxModuleStaging");
    if (!staging) {
      staging = document.createElement("div");
      staging.id = "orgavoxModuleStaging";
      staging.className = "orgavox-module-staging";
      staging.hidden = true;
      staging.innerHTML = `<div class="phase1-timeline-toolbar"><div class="orgavox-effects-group"></div><div class="phase1-edit-group"></div></div>`;
      document.body.appendChild(staging);
    }
    return staging;
  }

  installLocalSoundFxRouting();
  const earlyFiles = [
    "./simple-edit-core.js?v=1.05",
    "./simple-edit-timeline.js?v=1.05",
    "./simple-edit-audio.js?v=0.26",
    "./simple-edit-export.js?v=0.02",
    "./simple-edit-keyframes.js?v=0.10",
    "./simple-edit-keyframes-fix.js?v=0.11",
    "./simple-edit-phase3.js?v=0.13"
  ];
  for (const source of earlyFiles) await loadScript(source);
  ensureModuleStaging();
  const behaviorFiles = [
    "./simple-edit-effects-library.js?v=0.15",
    "./simple-edit-echo-settings.js?v=1.04",
    "./simple-edit-stretch-audiotsm.js?v=0.19",
    "./simple-edit-fade-handles.js?v=0.20",
    "./simple-edit-normalize.js?v=0.21",
    "./simple-edit-transpose-engine.js?v=0.26",
    "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28",
    "./simple-edit-eq.js?v=0.28",
    "./simple-edit-drive-engine.js?v=0.29",
    "./simple-edit-drive.js?v=0.29",
    "./simple-edit-dynamics-engine.js?v=0.30",
    "./simple-edit-dynamics.js?v=0.30",
    "./simple-edit-stereo-engine.js?v=0.35",
    "./simple-edit-stereo.js?v=0.35",
    "./simple-edit-lofi-engine.js?v=0.37",
    "./simple-edit-lofi.js?v=0.37",
    "./simple-edit-render-tools-engine.js?v=0.38",
    "./simple-edit-render-tools.js?v=1.04",
    "./simple-edit-analysis.js?v=0.40",
    "./simple-edit-project.js?v=1.06",
    "./simple-edit-markers.js?v=1.04",
    "./simple-edit-undo-redo.js?v=1.04",
    "./simple-edit-track-tools.js?v=1.12",
    "./simple-edit-clip-menu.js?v=0.46",
    "./simple-edit-snap-tools.js?v=1.04",
    "./simple-edit-library-tools.js?v=0.48"
  ];
  for (const source of behaviorFiles) await loadScript(source);

  function installVisibleUiOwner() {
    if (window.__orgavoxVisibleUiOwner112) return;
    window.__orgavoxVisibleUiOwner112 = true;

    const STYLE_ID = "orgavox-visible-ui-owner-v112";
    const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
    let numberPopover = null;
    let clipClipboard = [];

    const q = (selector) => document.querySelector(selector);
    const qa = (selector) => [...document.querySelectorAll(selector)];

    function installStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        :root{--topbar-h:136px!important;--controls-h:0!important;--orgavox-sidebar-w:250px!important;--orgavox-track-label-w:158px!important;--lane-h:112px!important}
        html,body{height:100%!important;overflow:hidden!important}.orgavox-module-staging{display:none!important}
        body.simple-edit-phase1 .app{height:100vh!important;display:grid!important;grid-template-rows:var(--topbar-h) minmax(0,1fr)!important;overflow:hidden!important}
        body.simple-edit-phase1 .topbar{height:var(--topbar-h)!important;min-height:var(--topbar-h)!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:8px!important;padding:10px 16px!important;overflow:visible!important;background:linear-gradient(rgba(18,19,17,.88),rgba(18,19,17,.88)),url('../../images/stonetext.jpg') center/cover!important;border-bottom:1px solid rgba(137,107,73,.8)!important}
        body.simple-edit-phase1 .topbar > :not(.orgavox-top-row):not(.orgavox-mix-row){display:none!important}
        .orgavox-top-row,.orgavox-mix-row{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;width:100%!important}.orgavox-top-row{height:42px!important;flex:0 0 42px!important;flex-wrap:nowrap!important}.orgavox-mix-row{height:42px!important;flex:0 0 42px!important;flex-wrap:nowrap!important;padding-left:296px!important}.orgavox-group{display:inline-flex!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;min-width:0!important}.orgavox-divider{width:1px!important;align-self:stretch!important;min-height:32px!important;max-height:44px!important;margin:0 6px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.46),transparent)!important}
        body.simple-edit-phase1 .clip-controls,body.simple-edit-phase1 .timeline-topline,body.simple-edit-phase1 .phase1-timeline-toolbar,body.simple-edit-phase1 .phase1-workspace-rule{display:none!important}
        .tool-button,.icon-button{white-space:nowrap!important}.topbar .tool-button{min-height:36px!important;padding:8px 12px!important;font-size:.66rem!important}.topbar .icon-button{min-width:36px!important;min-height:36px!important;padding:7px 10px!important}.time-readout{min-height:36px!important;padding:8px 14px!important;font-size:.86rem!important;letter-spacing:.08em!important}
        .orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important}.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important}.orgavox-project-button{border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important}.orgavox-danger-tool,.orgavox-cut-clip-btn{border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(92,28,23,.88),rgba(39,13,10,.96))!important;color:#ffd8d2!important}.orgavox-edit-button{border-color:rgba(224,163,96,.82)!important;background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;color:#ffe4a8!important}.orgavox-view-button,.orgavox-analysis-button{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important}.orgavox-effects-dropdown-button,.orgavox-marker-nav,#markersBtn{border-color:rgba(178,109,255,.84)!important;background:linear-gradient(180deg,rgba(87,45,155,.92),rgba(40,21,82,.96))!important;color:#f4e2ff!important}.orgavox-nudge-button,.orgavox-snap-button,.orgavox-align-button{border-color:rgba(117,178,222,.76)!important;background:linear-gradient(180deg,rgba(33,80,122,.86),rgba(13,35,61,.95))!important;color:#dff5ff!important}.orgavox-history-button{border-color:rgba(137,107,73,.58)!important;background:linear-gradient(180deg,rgba(65,47,30,.58),rgba(28,21,16,.88))!important;color:#b99b75!important}.orgavox-step-button{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important}
        .orgavox-edit-dropdown,.orgavox-view-dropdown,.orgavox-effects-dropdown{position:relative!important;display:inline-flex!important;align-items:center!important;z-index:90!important}.orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:230px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(224,163,96,.65)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important}.orgavox-view-menu,.orgavox-effects-menu{border-color:rgba(117,178,222,.68)!important}.orgavox-edit-menu[hidden],.orgavox-view-menu[hidden],.orgavox-effects-menu[hidden]{display:none!important}.orgavox-edit-menu .tool-button,.orgavox-view-menu .tool-button,.orgavox-effects-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important}
        .topbar .range-control{height:36px!important;min-width:0!important;display:grid!important;grid-template-columns:auto 96px 48px!important;align-items:center!important;gap:7px!important;margin:0!important}.topbar .range-control span{white-space:nowrap!important}.topbar .range-control input[type=range]{width:96px!important;min-width:96px!important}.topbar .range-control output{cursor:pointer!important;color:#e0a360!important;font:800 .62rem var(--font-mono)!important;text-align:right!important}.orgavox-master-control{width:230px!important}.orgavox-clip-volume-control{width:250px!important}.orgavox-echo-control{width:286px!important;grid-template-columns:auto 96px 48px 34px!important}.echo-settings-btn{position:static!important;grid-column:4!important;width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;align-self:center!important;justify-self:start!important;border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(32,82,125,.94),rgba(13,38,66,.96))!important;color:#e1f7ff!important}
        #snapGridSelect{height:34px!important;border:1px solid rgba(117,178,222,.72)!important;border-radius:10px!important;background:#050505!important;color:#f5f0db!important;font:900 .62rem var(--font-mono)!important}#snapGridSelect option{background:#050505!important;color:#f5f0db!important}
        body.simple-edit-phase1 .workspace{height:calc(100vh - var(--topbar-h))!important;display:grid!important;grid-template-columns:var(--orgavox-sidebar-w) minmax(0,1fr)!important;overflow:hidden!important;background:rgba(9,11,9,.97)!important}.library-panel{height:100%!important;display:flex!important;flex-direction:column!important;padding:14px 12px 14px!important;gap:11px!important;overflow:hidden!important;border-right:2px solid rgba(224,163,96,.58)!important;background:transparent!important;box-shadow:8px 0 18px rgba(0,0,0,.22)!important}.panel-heading{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}.orgavox-sidebar-brand{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}.orgavox-sidebar-mark{display:grid!important;place-items:center!important;width:39px!important;height:39px!important;flex:0 0 39px!important;border:1px solid rgba(224,163,96,.92)!important;border-radius:11px!important;background:rgba(0,0,0,.26)!important;color:#f8d792!important;font:900 1.32rem Georgia,serif!important}.orgavox-sidebar-title{min-width:0!important;display:grid!important;gap:1px!important;line-height:1!important}.orgavox-sidebar-title strong{display:flex!important;align-items:baseline!important;gap:6px!important;color:#e0a360!important;font:800 1.08rem var(--font-head,var(--font-headers))!important;letter-spacing:.04em!important;white-space:nowrap!important}.orgavox-sidebar-version{color:#63b8ff!important;font:800 .67rem var(--font-mono)!important;letter-spacing:.08em!important}.orgavox-sidebar-title span:not(.orgavox-sidebar-version){color:#75b2de!important;font:800 .57rem var(--font-body)!important;letter-spacing:.11em!important;text-transform:uppercase!important;white-space:nowrap!important}
        .orgavox-sidebar-zoom{flex:0 0 auto!important;border:1px solid rgba(224,163,96,.24)!important;border-radius:13px!important;background:rgba(0,0,0,.2)!important;padding:9px 10px!important}.orgavox-sidebar-zoom .range-control{width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:1fr auto auto!important;gap:6px 8px!important;margin:0!important;align-items:center!important}.orgavox-sidebar-zoom .range-control span{grid-column:1!important;grid-row:1!important}.orgavox-sidebar-zoom .range-control output{grid-column:2!important;grid-row:1!important}.orgavox-sidebar-zoom #fullscreenBtn{grid-column:3!important;grid-row:1!important;width:34px!important;min-width:34px!important;height:34px!important}.orgavox-sidebar-zoom .range-control input{grid-column:1/span 3!important;grid-row:2!important;width:100%!important}
        .dropzone{display:grid!important;visibility:visible!important;opacity:1!important;flex:0 0 auto!important;min-height:154px!important}.asset-list{display:flex!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;visibility:visible!important;opacity:1!important}
        .timeline-panel{height:100%!important;display:flex!important;flex-direction:column!important;padding:12px 8px 16px 0!important;overflow:hidden!important;background:transparent!important;box-shadow:none!important}.orgavox-project-info-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;flex:0 0 auto!important;margin:0 0 8px 0!important;padding:8px 14px!important;border:1px solid rgba(96,58,22,.78)!important;border-radius:10px!important;background:linear-gradient(180deg,#e5b65d,#c99134)!important}.orgavox-project-info-name{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#17100a!important;font:900 .82rem var(--font-body)!important}.orgavox-project-info-meta{flex:0 0 auto;color:#5a341d!important;font:900 .7rem var(--font-mono)!important;white-space:nowrap!important}
        .timeline-shell{grid-template-columns:var(--orgavox-track-label-w) minmax(0,1fr)!important;height:100%!important;max-height:none!important;min-height:0!important;flex:1 1 auto!important;margin-top:0!important;border-left:0!important;border-top-left-radius:0!important;border-bottom-left-radius:0!important}.track-label-column{width:var(--orgavox-track-label-w)!important;min-width:var(--orgavox-track-label-w)!important;overflow:hidden!important;border-right:1px solid rgba(224,163,96,.54)!important}.ruler-label{height:38px!important}.track-label{height:var(--lane-h)!important;min-height:var(--lane-h)!important;display:grid!important;grid-template-columns:30px minmax(0,1fr) 28px!important;grid-template-rows:auto auto!important;gap:7px 8px!important;align-content:center!important;align-items:center!important;padding:10px 9px!important;overflow:hidden!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de)!important}.track-lane{height:var(--lane-h)!important}.orgavox-track-index{grid-column:1!important;grid-row:1/span 2!important;display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:999px!important;color:#f8d792!important}.orgavox-track-name{grid-column:2!important;grid-row:1!important;align-self:center!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#f5f0db!important;font:900 .72rem var(--font-body)!important}.orgavox-track-menu-btn{grid-column:3!important;grid-row:1!important;width:26px!important;height:26px!important;padding:0!important;align-self:center!important;border:1px solid rgba(224,163,96,.65)!important;border-radius:7px!important;background:rgba(0,0,0,.35)!important;color:#f8d792!important}.orgavox-track-mini{grid-column:2/span 2!important;grid-row:2!important;display:flex!important;align-items:center!important;gap:4px!important;flex-wrap:nowrap!important;overflow:visible!important}.orgavox-track-volume-pill{display:none!important}.orgavox-track-mix-btn,.orgavox-track-info-btn{width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;padding:0!important;border-radius:999px!important;font:900 .55rem var(--font-mono)!important;line-height:1!important;display:grid!important;place-items:center!important;box-sizing:border-box!important}.orgavox-track-mix-btn.mute{border-color:rgba(220,72,64,.8)!important;color:#ffd8d2!important;background:rgba(92,28,23,.55)!important}.orgavox-track-mix-btn.solo{border-color:rgba(224,163,96,.82)!important;color:#ffe4a8!important;background:rgba(129,85,31,.44)!important}.orgavox-track-mix-btn.mute.active{background:linear-gradient(180deg,rgba(105,38,35,.96),rgba(42,15,14,.98))!important;border-color:rgba(220,72,64,.96)!important}.orgavox-track-mix-btn.solo.active{background:linear-gradient(180deg,rgba(122,83,32,.96),rgba(48,29,11,.98))!important;border-color:rgba(224,163,96,.96)!important}.orgavox-track-info-btn{border-color:rgba(74,190,117,.9)!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important}.track-label.active{background:rgba(75,132,191,.16)!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de),inset 0 0 0 2px rgba(117,178,222,.48)!important}.track-lane.selected-track{box-shadow:inset 0 0 0 2px rgba(117,216,255,.55),inset 4px 0 rgba(117,216,255,.85)!important;background-color:rgba(75,155,255,.09)!important}
        .orgavox-track-volume-overlay{position:absolute;left:8px;top:8px;z-index:3;max-width:180px;padding:3px 8px;border:1px solid rgba(224,163,96,.42);border-radius:9px;background:rgba(0,0,0,.78);color:#f8d792;font:900 .58rem var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .orgavox-number-pop,.orgavox-track-number-pop,.orgavox-track-menu{position:fixed;z-index:999999;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}.orgavox-track-menu[hidden]{display:none!important}.orgavox-number-pop label,.orgavox-track-number-pop label{color:rgba(245,240,219,.72);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}.orgavox-number-pop input,.orgavox-track-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono)}#playBtn.orgavox-playing{animation:orgavoxPlayPulse .72s ease-in-out infinite alternate!important;transform-origin:center!important}@keyframes orgavoxPlayPulse{from{transform:scale(1);filter:brightness(1)}to{transform:scale(1.13);filter:brightness(1.25);box-shadow:0 0 26px rgba(75,155,255,.68)}}
        @media(max-width:1380px){:root{--topbar-h:188px!important;--orgavox-sidebar-w:250px!important}.orgavox-top-row{flex-wrap:wrap!important;height:auto!important}.orgavox-mix-row{padding-left:250px!important;flex-wrap:wrap!important;height:auto!important}}
      `;
      document.head.appendChild(style);
    }

    function closeMenus() { qa(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((panel) => { panel.hidden = true; }); }
    function button(id, text, cls = "tool-button") {
      let node = document.getElementById(id);
      if (!node) { node = document.createElement("button"); node.id = id; node.type = "button"; }
      node.textContent = text;
      node.className = cls;
      return node;
    }
    function menuButton(id, text, handler, cls = "tool-button") {
      const node = button(id, text, cls);
      if (!node.dataset.orgavoxUiWired) {
        node.dataset.orgavoxUiWired = "true";
        node.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); closeMenus(); handler?.(); });
      }
      return node;
    }
    function dropdown(id, wrapCls, triggerCls, menuCls, label) {
      let wrap = document.getElementById(id);
      if (!wrap) { wrap = document.createElement("div"); wrap.id = id; }
      wrap.className = wrapCls;
      let trigger = wrap.querySelector(`.${triggerCls}`);
      if (!trigger) { trigger = document.createElement("button"); trigger.type = "button"; wrap.prepend(trigger); }
      trigger.className = `tool-button ${triggerCls}`;
      trigger.textContent = label;
      let menu = wrap.querySelector(`.${menuCls}`);
      if (!menu) { menu = document.createElement("div"); menu.className = menuCls; menu.hidden = true; wrap.appendChild(menu); }
      if (!trigger.dataset.orgavoxMenuWired) {
        trigger.dataset.orgavoxMenuWired = "true";
        trigger.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const open = menu.hidden; closeMenus(); menu.hidden = !open; });
      }
      return { wrap, trigger, menu };
    }
    function divider(id) { let node = document.getElementById(id); if (!node) { node = document.createElement("span"); node.id = id; node.className = "orgavox-divider"; node.setAttribute("aria-hidden", "true"); } return node; }
    function group(name, nodes) { let node = document.getElementById(`orgavoxGroup-${name}`); if (!node) { node = document.createElement("span"); node.id = `orgavoxGroup-${name}`; } node.className = `orgavox-group orgavox-${name}-group`; appendOrdered(node, nodes); return node; }
    function appendOrdered(parent, nodes) { nodes.filter(Boolean).forEach((node) => { if (node.parentElement !== parent || parent.lastElementChild !== node) parent.appendChild(node); }); }

    function selectedClips() { const ids = Array.isArray(state.selectedClipIds) && state.selectedClipIds.length ? state.selectedClipIds : (state.selectedClipId ? [state.selectedClipId] : []); return ids.map((id) => state.clips.find((clip) => clip.id === id)).filter(Boolean); }
    function copyClip() { const clips = selectedClips(); if (!clips.length) return; clipClipboard = clips.map((clip) => ({ ...clip, id: makeId("clip-copy") })); if (typeof showToast === "function") showToast(`${clips.length} clip${clips.length === 1 ? "" : "s"} copied.`); }
    function cutClip() { copyClip(); deleteClips(); }
    function pasteClip() { if (!clipClipboard.length) return; const minStart = Math.min(...clipClipboard.map((clip) => clip.start || 0)); const copies = clipClipboard.map((clip) => ({ ...clip, id: makeId("clip"), start: Math.max(0, (state.playhead || 0) + ((clip.start || 0) - minStart)) })); state.clips.push(...copies); state.selectedClipId = copies[0]?.id || null; state.selectedClipIds = copies.map((clip) => clip.id); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); }
    function deleteClips() { const ids = new Set(selectedClips().map((clip) => clip.id)); if (!ids.size) return; state.clips = state.clips.filter((clip) => !ids.has(clip.id)); state.selectedClipId = null; state.selectedClipIds = []; renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); }
    function clearAll() { if (!state.clips.length) return; state.clips = []; state.selectedClipId = null; state.selectedClipIds = []; renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); }
    function sendToStart() { selectedClips().forEach((clip) => { clip.start = 0; }); renderTimeline(); window.orgavoxRecordHistory?.(); }

    function ensureMasterControl() {
      let control = document.getElementById("orgavoxMasterControl");
      if (!control) {
        control = document.createElement("label");
        control.id = "orgavoxMasterControl";
        control.className = "range-control orgavox-master-control";
        const label = document.createElement("span"); label.textContent = "🌐 Master";
        const slider = document.createElement("input"); slider.id = "globalVolumeSlider"; slider.type = "range"; slider.min = "0"; slider.max = "200"; slider.value = String(state.globalVolume || 100);
        const output = document.createElement("output"); output.id = "globalVolumeOut"; output.textContent = `${Math.round(state.globalVolume || 100)}%`;
        slider.addEventListener("input", () => { state.globalVolume = Number(slider.value) || 100; output.textContent = `${Math.round(state.globalVolume)}%`; localStorage.setItem("orgavoxGlobalVolume", String(state.globalVolume)); });
        control.append(label, slider, output);
      }
      ui.globalVolumeSlider = control.querySelector("#globalVolumeSlider");
      ui.globalVolumeOut = control.querySelector("#globalVolumeOut");
      return control;
    }

    function ensureSidebar() {
      const panel = q(".library-panel");
      if (!panel) return;
      let heading = panel.querySelector(".panel-heading");
      if (!heading) { heading = document.createElement("div"); heading.className = "panel-heading"; panel.prepend(heading); }
      heading.textContent = "";
      const brand = document.createElement("div");
      brand.className = "orgavox-sidebar-brand";
      brand.innerHTML = `<span class="orgavox-sidebar-mark">Φ</span><span class="orgavox-sidebar-title"><strong>ORGAVOX <span class="orgavox-sidebar-version">${VERSION}</span></strong><span>Browser Audio Workstation</span></span>`;
      let badge = document.getElementById("assetCount");
      if (!badge) { badge = document.createElement("span"); badge.id = "assetCount"; }
      badge.className = "count-badge";
      heading.append(brand, badge);
      let zoomWrap = panel.querySelector(".orgavox-sidebar-zoom");
      if (!zoomWrap) { zoomWrap = document.createElement("div"); zoomWrap.className = "orgavox-sidebar-zoom"; }
      const zoom = ui.zoomSlider?.closest(".range-control") || document.querySelector(".zoom-control");
      if (zoom && zoom.parentElement !== zoomWrap) zoomWrap.appendChild(zoom);
      appendOrdered(panel, [heading, zoomWrap, ui.dropzone || q(".dropzone"), q(".library-help"), ui.assetList || q("#assetList")]);
    }

    function ensureProjectBar() {
      const panel = q(".timeline-panel");
      const shell = q(".timeline-shell");
      if (!panel || !shell) return;
      let bar = document.getElementById("orgavoxProjectInfoBar");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "orgavoxProjectInfoBar";
        bar.className = "orgavox-project-info-bar";
        bar.innerHTML = `<span class="orgavox-project-info-name" id="orgavoxProjectInfoName">Untitled Project</span><span class="orgavox-project-info-meta" id="orgavoxProjectInfoMeta">Not saved yet</span>`;
      }
      if (bar.parentElement !== panel || bar.nextElementSibling !== shell) panel.insertBefore(bar, shell);
    }

    function ensureTrackSkeleton() {
      ui.trackLabels = qa(".track-label");
      ui.lanes = qa(".track-lane");
      ui.trackLabels.forEach((label, index) => {
        label.dataset.trackLabel = String(index);
        if (!label.querySelector(".orgavox-track-index")) {
          label.textContent = "";
          const ix = document.createElement("span"); ix.className = "orgavox-track-index"; ix.textContent = String(index + 1);
          const name = document.createElement("strong"); name.className = "orgavox-track-name"; name.textContent = `Track ${index + 1}`;
          const menu = document.createElement("button"); menu.type = "button"; menu.className = "orgavox-track-menu-btn"; menu.textContent = "⋯";
          const mini = document.createElement("span"); mini.className = "orgavox-track-mini";
          const mute = document.createElement("button"); mute.type = "button"; mute.className = "orgavox-track-mix-btn mute"; mute.textContent = "M";
          const solo = document.createElement("button"); solo.type = "button"; solo.className = "orgavox-track-mix-btn solo"; solo.textContent = "S";
          const info = document.createElement("button"); info.type = "button"; info.className = "orgavox-track-info-btn"; info.textContent = "i";
          mini.append(mute, solo, info);
          label.append(ix, name, menu, mini);
        }
      });
      ui.lanes.forEach((lane, index) => {
        let overlay = lane.querySelector(".orgavox-track-volume-overlay");
        if (!overlay) { overlay = document.createElement("button"); overlay.type = "button"; overlay.className = "orgavox-track-volume-overlay"; lane.appendChild(overlay); }
        if (!overlay.textContent) overlay.textContent = `Track ${index + 1} · VOL 100%`;
      });
    }

    function buildTopbar() {
      const topbar = q(".topbar");
      if (!topbar) return;
      let topRow = topbar.querySelector(".orgavox-top-row");
      if (!topRow) { topRow = document.createElement("div"); topRow.className = "orgavox-top-row"; topbar.appendChild(topRow); }
      let mixRow = topbar.querySelector(".orgavox-mix-row");
      if (!mixRow) { mixRow = document.createElement("div"); mixRow.className = "orgavox-mix-row"; topbar.appendChild(mixRow); }

      if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.className = "tool-button orgavox-open-button"; }
      if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.className = "tool-button orgavox-save-button"; }
      const project = button("projectBtn", "📁 Project", "tool-button orgavox-project-button"); ui.projectBtn = project;
      const backStep = button("playheadBackStepBtn", "←", "icon-button orgavox-step-button");
      const forwardStep = button("playheadForwardStepBtn", "→", "icon-button orgavox-step-button");
      ui.undoBtn = button("undoBtn", "↶ Undo", "tool-button orgavox-history-button");
      ui.redoBtn = button("redoBtn", "↷ Redo", "tool-button orgavox-history-button");
      const transport = group("transport", [ui.jumpStartBtn, ui.playBtn, ui.stopBtn, ui.timeReadout, backStep, forwardStep, ui.undoBtn, ui.redoBtn]);

      const edit = dropdown("orgavoxEditDropdown", "orgavox-edit-dropdown", "orgavox-edit-button", "orgavox-edit-menu", "✎ Edit ▾");
      const view = dropdown("orgavoxViewDropdown", "orgavox-view-dropdown", "orgavox-view-button", "orgavox-view-menu", "👁 View ▾");
      const effects = dropdown("orgavoxEffectsDropdown", "orgavox-effects-dropdown", "orgavox-effects-dropdown-button", "orgavox-effects-menu", "Effects ▾");
      const prev = button("prevMarkerBtn", "◀", "icon-button orgavox-marker-nav");
      const marker = button("markersBtn", "🏷 Add Marker", "tool-button orgavox-markers-button");
      const next = button("nextMarkerBtn", "▶", "icon-button orgavox-marker-nav");
      const nudgeLeft = button("nudgeLeftBtn", "◀ Nudge", "tool-button orgavox-nudge-button");
      const nudgeRight = button("nudgeRightBtn", "Nudge ▶", "tool-button orgavox-nudge-button");
      const snap = button("snapGridBtn", "🧲 Snap", "tool-button orgavox-snap-button");
      let snapSelect = document.getElementById("snapGridSelect");
      if (!snapSelect) { snapSelect = document.createElement("select"); snapSelect.id = "snapGridSelect"; }
      if (!snapSelect.dataset.orgavoxUiOptions) { snapSelect.textContent = ""; SNAP_VALUES.forEach((value) => { const option = document.createElement("option"); option.value = String(value); option.textContent = String(value); snapSelect.appendChild(option); }); snapSelect.dataset.orgavoxUiOptions = "true"; }
      ui.snapBtn = snap; ui.snapGridSelect = snapSelect; ui.nudgeLeftBtn = nudgeLeft; ui.nudgeRightBtn = nudgeRight; ui.markersBtn = marker;

      ui.undoHistoryBtn = button("undoHistoryBtn", "↶ Undo History", "tool-button orgavox-history-button");
      ui.downloadClipBtn = button("downloadClipBtn", "⬇ Download Clip", "tool-button orgavox-download-clip-button");
      ui.reverseClipBtn = document.getElementById("reverseClipBtn") || button("reverseClipBtn", "↩ Reverse", "tool-button orgavox-clip-tool-button orgavox-reverse-button");
      ui.bounceBtn = document.getElementById("bounceBtn") || button("bounceBtn", "🧱 Bounce Track", "tool-button orgavox-clip-tool-button orgavox-bounce-button");
      ui.alignPlayheadBtn = button("alignPlayheadBtn", "⤓ Align", "tool-button orgavox-align-button");
      if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Snip"; ui.scissorsBtn.classList.add("orgavox-danger-tool"); }
      if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 Delete"; ui.deleteBtn.classList.add("orgavox-danger-tool"); if (!ui.deleteBtn.dataset.orgavoxDeleteWired) { ui.deleteBtn.dataset.orgavoxDeleteWired = "true"; ui.deleteBtn.addEventListener("click", deleteClips); } }

      appendOrdered(edit.menu, [ui.undoHistoryBtn, menuButton("orgavoxCopyClipBtn", "⧉ Copy", copyClip), menuButton("orgavoxCutClipBtn", "✂ Cut", cutClip, "tool-button orgavox-cut-clip-btn"), menuButton("orgavoxPasteClipBtn", "⧉ Paste", pasteClip), menuButton("orgavoxClearTimelineBtn", "🧹 Clear All", clearAll), ui.deleteBtn, ui.downloadClipBtn, ui.scissorsBtn]);
      const analysisBtn = document.getElementById("analysisBtn") || button("analysisBtn", "📈 Analyze", "tool-button orgavox-analysis-button");
      appendOrdered(view.menu, [button("orgavoxMarkerPanelBtn", "🏷 Markers Panel"), menuButton("orgavoxSendToStartBtn", "↤ Send to Start", sendToStart), ui.alignPlayheadBtn, analysisBtn, button("orgavoxAddBeatMarkersBtn", "▏ Add Beat Markers"), button("orgavoxClearBeatMarkersBtn", "▏ Clear Beat Markers"), button("orgavoxRandomizeTrackColorsBtn", "🎨 Randomize Track Colors"), button("orgavoxExpandTrackBtn", "▣ Expand Track"), button("orgavoxResetTrackViewBtn", "▢ Reset Track View"), ui.bounceBtn]);
      const effectIds = ["gateBtn", "stretchBtn", "fadeInBtn", "fadeOutBtn", "resetFadesBtn", "normalizeBtn", "transposeBtn", "eqBtn", "driveBtn", "dynamicsBtn", "stereoBtn", "lofiBtn", "effectsLibraryBtn", "reverseClipBtn"];
      const fallbackLabels = { gateBtn:"▥ Noise Gate", stretchBtn:"↔ Stretch", fadeInBtn:"↗ Fade In", fadeOutBtn:"↘ Fade Out", resetFadesBtn:"✕ Reset Fades", normalizeBtn:"⚖ Normalize", transposeBtn:"🎼 Transpose", eqBtn:"🎚 EQ / Filter", driveBtn:"🔥 Drive", dynamicsBtn:"📊 Dynamics", stereoBtn:"↔ Stereo / Pan", lofiBtn:"🧊 Lo-Fi / Crush", effectsLibraryBtn:"🎧 Effects Library", reverseClipBtn:"↩ Reverse" };
      appendOrdered(effects.menu, effectIds.map((id) => document.getElementById(id) || button(id, fallbackLabels[id] || id)).filter(Boolean));

      appendOrdered(topRow, [group("files", [ui.importBtn, ui.exportBtn, project]), divider("orgavoxTopDividerFiles"), transport, divider("orgavoxTopDividerTransport"), group("menus", [edit.wrap, view.wrap, effects.wrap]), group("markers", [prev, marker, next]), group("nudge", [nudgeLeft, nudgeRight]), group("snap", [snap, snapSelect])]);

      const volume = ui.volumeSlider?.closest(".range-control"); if (volume) volume.classList.add("orgavox-clip-volume-control");
      const echo = ui.echoSlider?.closest(".range-control");
      if (echo) { echo.classList.add("orgavox-echo-control"); let gear = document.getElementById("echoSettingsBtn"); if (!gear) { gear = document.createElement("button"); gear.id = "echoSettingsBtn"; gear.type = "button"; } gear.className = "icon-button echo-settings-btn"; gear.textContent = "⚙"; echo.appendChild(gear); }
      appendOrdered(mixRow, [ensureMasterControl(), divider("orgavoxMixDividerMaster"), volume, divider("orgavoxMixDividerVolume"), echo]);
      [ui.importBtn, ui.exportBtn, project, ui.deleteBtn, ui.scissorsBtn, ui.undoBtn, ui.redoBtn, ui.downloadClipBtn, ui.reverseClipBtn, ui.bounceBtn, ui.alignPlayheadBtn, backStep, forwardStep].filter(Boolean).forEach((node) => { node.type = "button"; });
      wireStepButtons(backStep, forwardStep);
    }

    function parseTime(text) { const raw = String(text || "").trim(); if (!raw) return 0; if (raw.includes(":")) { const parts = raw.split(":").map(Number); if (parts.some((part) => !Number.isFinite(part))) return state.playhead || 0; return Math.max(0, parts.reduce((sum, part) => sum * 60 + part, 0)); } const n = Number(raw.replace(/s$/i, "")); return Number.isFinite(n) ? Math.max(0, n) : (state.playhead || 0); }
    function showNumber(anchor, label, value, apply) {
      numberPopover?.remove?.();
      const rect = anchor.getBoundingClientRect();
      const form = document.createElement("form");
      form.className = "orgavox-number-pop";
      form.innerHTML = `<label>${label}<input type="text" value="${String(value).replace(/"/g, "&quot;")}"></label><button class="tool-button primary" type="submit">Apply</button>`;
      form.style.left = `${Math.min(window.innerWidth - 190, Math.max(8, rect.left))}px`;
      form.style.top = `${Math.min(window.innerHeight - 110, Math.max(8, rect.bottom + 8))}px`;
      const input = form.querySelector("input");
      form.addEventListener("submit", (event) => { event.preventDefault(); if (apply(input.value) !== false) { form.remove(); numberPopover = null; } });
      document.body.appendChild(form); numberPopover = form; input.focus(); input.select();
    }
    function wireValuePopups() {
      const bind = (node, key, fn) => { if (node && !node.dataset[key]) { node.dataset[key] = "true"; node.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); fn(node); }); } };
      bind(ui.timeReadout, "orgavoxTimePopup", (node) => showNumber(node, "Time", formatTime(state.playhead || 0), (value) => { setPlayhead(parseTime(value), true); return true; }));
      bind(ui.globalVolumeOut, "orgavoxMasterPopup", (node) => showNumber(node, "Master volume", Math.round(state.globalVolume || 100), (value) => { const n = Math.max(0, Math.min(200, Number(String(value).replace(/[^0-9.]/g, "")) || 0)); state.globalVolume = n; localStorage.setItem("orgavoxGlobalVolume", String(n)); if (ui.globalVolumeSlider) ui.globalVolumeSlider.value = n; node.textContent = `${Math.round(n)}%`; return true; }));
      bind(ui.volumeOut, "orgavoxVolumePopup", (node) => showNumber(node, "Clip volume", parseInt(node.textContent, 10) || 100, (value) => { const clip = selectedClip(); if (!clip) return false; const n = Math.max(0, Math.min(200, Number(String(value).replace(/[^0-9.]/g, "")) || 0)); clip.volume = n; if (ui.volumeSlider) ui.volumeSlider.value = n; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); return true; }));
      bind(ui.echoOut, "orgavoxEchoPopup", (node) => showNumber(node, "Echo", parseInt(node.textContent, 10) || 0, (value) => { const clip = selectedClip(); if (!clip) return false; const n = Math.max(0, Math.min(100, Number(String(value).replace(/[^0-9.]/g, "")) || 0)); clip.echo = n; if (ui.echoSlider) ui.echoSlider.value = n; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); return true; }));
      bind(ui.zoomOut, "orgavoxZoomPopup", (node) => showNumber(node, "Timeline zoom %", parseInt(node.textContent, 10) || 100, (value) => { const pct = Math.max(31, Math.min(625, Number(String(value).replace(/[^0-9.]/g, "")) || 100)); state.pixelsPerSecond = Math.max(25, Math.min(500, Math.round(pct / 100 * 80))); if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond; if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`; renderTimeline(); return true; }));
    }
    function wireStepButtons(back, forward) {
      if (back && !back.dataset.orgavoxStepWired) { back.dataset.orgavoxStepWired = "true"; back.addEventListener("click", () => setPlayhead(Math.max(0, (state.playhead || 0) - 0.01), true)); }
      if (forward && !forward.dataset.orgavoxStepWired) { forward.dataset.orgavoxStepWired = "true"; forward.addEventListener("click", () => setPlayhead(Math.max(0, (state.playhead || 0) + 0.01), true)); }
    }
    function wireModuleButtons() {
      window.orgavoxWireProjectButton?.(); window.orgavoxWireUndoRedoControls?.(); window.orgavoxWireSnapControls?.(); window.orgavoxWireMarkerControls?.(); window.orgavoxWireEchoSettingsButton?.(); window.orgavoxWireRenderToolControls?.(); window.orgavoxRefreshTrackTools?.(); window.orgavoxRenderMarkers?.();
      const once = (id, fn) => { const node = document.getElementById(id); if (node && !node.dataset.orgavoxUiMenuAction) { node.dataset.orgavoxUiMenuAction = "true"; node.addEventListener("click", () => { closeMenus(); fn?.(); }); } };
      once("orgavoxMarkerPanelBtn", () => window.orgavoxOpenMarkersPanel?.()); once("orgavoxAddBeatMarkersBtn", () => window.orgavoxAddBeatMarkers?.()); once("orgavoxClearBeatMarkersBtn", () => window.orgavoxClearBeatMarkers?.()); once("orgavoxRandomizeTrackColorsBtn", () => window.orgavoxRandomizeTrackColors?.()); once("orgavoxExpandTrackBtn", () => window.orgavoxExpandSelectedTrack?.()); once("orgavoxResetTrackViewBtn", () => window.orgavoxResetTrackView?.());
      const marker = document.getElementById("markersBtn");
      if (marker && !marker.dataset.orgavoxUiMarkerDirect) { marker.dataset.orgavoxUiMarkerDirect = "true"; marker.addEventListener("click", () => window.orgavoxAddMarkerAtPlayhead?.()); }
    }
    function patchRuntime() {
      if (window.__orgavoxVisibleRuntime112) return;
      window.__orgavoxVisibleRuntime112 = true;
      if (typeof renderTimeline === "function") { const old = renderTimeline; renderTimeline = function orgavoxUiOwnerRenderTimeline() { const result = old.apply(this, arguments); requestAnimationFrame(refresh); return result; }; }
      if (typeof syncSelectedControls === "function") { const old = syncSelectedControls; syncSelectedControls = function orgavoxUiOwnerSyncSelectedControls() { const result = old.apply(this, arguments); const hasClip = Boolean(selectedClip()); [ui.deleteBtn, ui.downloadClipBtn, ui.reverseClipBtn, ui.bounceBtn, ui.scissorsBtn, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn, document.getElementById("analysisBtn")].filter(Boolean).forEach((btn) => { btn.disabled = !hasClip; }); return result; }; }
      document.addEventListener("click", (event) => { const target = event.target; if (!target.closest?.("#orgavoxEditDropdown,#orgavoxViewDropdown,#orgavoxEffectsDropdown,.orgavox-number-pop,.orgavox-track-menu")) closeMenus(); if (target.closest?.(".audio-clip,.track-label,.asset-item,button,input,select,label,.popover,.modal-backdrop,.orgavox-analysis-modal,.orgavox-project-modal,.echo-settings-backdrop")) return; if (state.selectedClipId) { state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); qa(".audio-clip.selected").forEach((clip) => clip.classList.remove("selected")); } }, true);
      document.addEventListener("keydown", (event) => { const target = event.target; const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable); if (typing || event.altKey || event.metaKey) return; if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const step = event.shiftKey ? 1 : event.ctrlKey ? 0.1 : 0.01; setPlayhead((state.playhead || 0) + (event.key === "ArrowRight" ? step : -step), true); });
    }
    function refresh() { document.body.classList.add("simple-edit-phase1"); setVersion(); installStyles(); buildTopbar(); ensureSidebar(); ensureProjectBar(); ensureTrackSkeleton(); wireValuePopups(); wireModuleButtons(); ui.playBtn?.classList.toggle("orgavox-playing", Boolean(state.playing)); }
    window.orgavoxRefreshVisibleUi = refresh;
    patchRuntime(); refresh(); requestAnimationFrame(refresh);
  }

  installVisibleUiOwner();
  setVersion();
  document.documentElement.classList.remove("orgavox-loading");
  document.getElementById("orgavox-boot-style")?.remove();
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX loaded");
})().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove("orgavox-loading");
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "ORGAVOX failed to load";
});