"use strict";

(async () => {
  const VERSION = "v0.46";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setFinalVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const mark = document.querySelector(".brand-mark");
    if (mark) mark.textContent = "Φ";
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (title) {
      let badge = title.querySelector(".phase1-version, .simple-edit-version");
      title.textContent = "ORGAVOX";
      if (!badge) badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
    const subtitle = brand?.querySelector("p");
    if (subtitle) { subtitle.textContent = ""; subtitle.hidden = true; }
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

  function ensureLeadingTransportDivider() {
    const row = document.querySelector(".orgavox-toolbar-row");
    const transport = row?.querySelector(".orgavox-transport-group");
    if (!row || !transport) return;
    let divider = row.querySelector(".orgavox-leading-divider");
    if (!divider) {
      divider = document.createElement("span");
      divider.className = "orgavox-divider orgavox-leading-divider";
      divider.setAttribute("aria-hidden", "true");
    }
    if (transport.previousElementSibling !== divider) row.insertBefore(divider, transport);
  }

  function keepFeatureButtonsInMenu() {
    if (typeof ui === "undefined") return;
    const menu = document.querySelector(".orgavox-effects-menu");
    if (!menu) return;
    [ui.gateBtn, ui.stretchBtn, ui.normalizeBtn, ui.transposeBtn, ui.eqBtn, ui.driveBtn, ui.dynamicsBtn, ui.stereoBtn, ui.lofiBtn, ui.reverseClipBtn]
      .filter(Boolean)
      .forEach((button) => { if (button.parentElement !== menu) menu.appendChild(button); });
  }

  function placeClipToolButtons() {
    if (typeof ui === "undefined") return;
    const editGroup = document.querySelector(".orgavox-edit-group");
    const effectsDrop = editGroup?.querySelector(".orgavox-effects-dropdown");
    if (!editGroup) return;
    [ui.downloadClipBtn, ui.bounceBtn, ui.analysisBtn, ui.markersBtn].filter(Boolean).forEach((button) => {
      if (effectsDrop) editGroup.insertBefore(button, effectsDrop);
      else if (button.parentElement !== editGroup) editGroup.appendChild(button);
    });
  }

  function applyFinalToolbarStyling() {
    try {
      if (typeof ui !== "undefined") {
        if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.remove("primary"); ui.importBtn.classList.add("orgavox-open-button"); }
        if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); }
        if (ui.stopBtn) ui.stopBtn.classList.add("orgavox-stop-danger");
        if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Cut"; ui.scissorsBtn.classList.add("orgavox-danger-tool"); }
        if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 DEL"; ui.deleteBtn.classList.add("orgavox-danger-tool"); }
        [ui.fadeInBtn, ui.fadeOutBtn, ui.resetFadesBtn].filter(Boolean).forEach((button) => button.classList.add("orgavox-fade-tool"));
      }
      keepFeatureButtonsInMenu();
      placeClipToolButtons();
      window.orgavoxPlaceProjectButton?.();
      window.orgavoxUpdateProjectInfoBar?.();
      window.orgavoxPlaceMarkersButton?.();
      window.orgavoxRenderMarkers?.();
      window.orgavoxPlaceBuild1Controls?.();
      window.orgavoxSyncPlaybackPolish?.();
      window.orgavoxRefreshTrackTools?.();
      window.orgavoxPlaceClipRenderButtons?.();
      ensureLeadingTransportDivider();
      const effectsLibrary = document.querySelector(".effects-library-button") || [...document.querySelectorAll("button")].find((button) => /effects library/i.test(button.textContent || ""));
      if (effectsLibrary) effectsLibrary.classList.add("orgavox-effects-library-button");
      let style = document.getElementById("orgavox-final-toolbar-style");
      if (!style) { style = document.createElement("style"); style.id = "orgavox-final-toolbar-style"; document.head.appendChild(style); }
      style.textContent = `body.simple-edit-phase1{--topbar-h:112px!important}body.simple-edit-phase1 .topbar{height:var(--topbar-h)!important;min-height:var(--topbar-h)!important;padding-top:12px!important;padding-bottom:8px!important}body.simple-edit-phase1 .brand p{display:none!important}body.simple-edit-phase1 .phase1-top-effects{padding-top:10px!important}body.simple-edit-phase1 .workspace{height:calc(100vh - var(--topbar-h))!important}body.simple-edit-phase1 #importBtn.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.24)!important}body.simple-edit-phase1 #exportBtn.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important;box-shadow:0 0 0 1px rgba(74,190,117,.22),0 0 14px rgba(74,190,117,.22)!important}body.simple-edit-phase1 #stopBtn.orgavox-stop-danger,body.simple-edit-phase1 #scissorsBtn.orgavox-danger-tool,body.simple-edit-phase1 #deleteBtn.orgavox-danger-tool{border-color:rgba(220,72,64,.76)!important;background:linear-gradient(180deg,rgba(89,29,26,.84),rgba(35,13,12,.94))!important;color:#ffd8d2!important;box-shadow:0 0 0 1px rgba(220,72,64,.2),0 0 14px rgba(220,72,64,.2)!important}body.simple-edit-phase1 .orgavox-fade-tool{border-color:rgba(74,190,117,.76)!important;background:linear-gradient(180deg,rgba(28,89,52,.74),rgba(12,42,25,.9))!important;color:#d6ffe4!important}body.simple-edit-phase1 .orgavox-effects-library-button{border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(87,46,148,.88),rgba(37,22,74,.96))!important;color:#f1ddff!important}body.simple-edit-phase1 .time-readout{font-size:.94rem!important;min-height:36px!important;padding:9px 14px!important;letter-spacing:.08em!important}body.simple-edit-phase1 .orgavox-leading-divider{display:inline-flex!important;flex:0 0 1px!important;min-height:36px!important;margin-left:0!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control{display:grid!important;grid-template-columns:1fr auto!important;grid-template-rows:auto auto!important;gap:6px 10px!important;align-items:center!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control span{grid-column:1!important;grid-row:1!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control output{grid-column:2!important;grid-row:1!important;text-align:right!important;color:#f8d792!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control input[type="range"]{grid-column:1 / -1!important;grid-row:2!important;width:100%!important}@media (max-width:1380px){body.simple-edit-phase1{--topbar-h:158px!important}}`;
    } catch (error) { console.warn("ORGAVOX final toolbar styling failed.", error); }
  }

  function refreshFinalLayout() {
    try { if (typeof ui !== "undefined") window.orgavoxRefreshLayout?.(); }
    catch (error) { console.warn("ORGAVOX could not refresh layout.", error); }
    applyFinalToolbarStyling();
    setFinalVersion();
  }

  installLocalSoundFxRouting();
  const files = [
    "./simple-edit-core.js?v=0.01", "./simple-edit-timeline.js?v=0.01", "./simple-edit-audio.js?v=0.26", "./simple-edit-export.js?v=0.02", "./simple-edit-phase1.js?v=0.33",
    "./simple-edit-keyframes.js?v=0.10", "./simple-edit-keyframes-fix.js?v=0.11", "./simple-edit-phase3.js?v=0.13", "./simple-edit-effects-library.js?v=0.15", "./simple-edit-echo-settings.js?v=0.25",
    "./simple-edit-stretch-audiotsm.js?v=0.19", "./simple-edit-fade-handles.js?v=0.20", "./simple-edit-normalize.js?v=0.21", "./simple-edit-transpose-engine.js?v=0.26", "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28", "./simple-edit-eq.js?v=0.28", "./simple-edit-drive-engine.js?v=0.29", "./simple-edit-drive.js?v=0.29", "./simple-edit-dynamics-engine.js?v=0.30", "./simple-edit-dynamics.js?v=0.30",
    "./simple-edit-stereo-engine.js?v=0.35", "./simple-edit-stereo.js?v=0.35", "./simple-edit-lofi-engine.js?v=0.37", "./simple-edit-lofi.js?v=0.37", "./simple-edit-render-tools-engine.js?v=0.38", "./simple-edit-render-tools.js?v=0.46",
    "./simple-edit-analysis.js?v=0.40", "./simple-edit-project.js?v=0.43", "./simple-edit-markers.js?v=0.43", "./simple-edit-build1.js?v=0.44", "./simple-edit-track-tools.js?v=0.45", "./simple-edit-clip-menu.js?v=0.46"
  ];

  for (const source of files) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.head.appendChild(script);
    });
  }

  refreshFinalLayout();
  document.documentElement.classList.remove("orgavox-loading");
  document.getElementById("orgavox-boot-style")?.remove();
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX loaded");
  setTimeout(refreshFinalLayout, 0);
  setTimeout(refreshFinalLayout, 150);
  window.addEventListener("resize", () => setTimeout(refreshFinalLayout, 0));
})().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove("orgavox-loading");
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "ORGAVOX failed to load";
});
