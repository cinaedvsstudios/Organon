"use strict";

(function installOrgavoxFinalCleanup() {
  const VERSION = "v1.02 set 2c";
  const STYLE_ID = "orgavox-final-cleanup-v102c-style";
  let running = false;

  function setVersion() {
    window.ORGAVOX_VERSION = VERSION;
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const title = document.querySelector(".brand h1");
    if (title) {
      title.textContent = "ORGAVOX";
      const badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById("orgavox-track-mix-color-lock")?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .track-label{overflow:hidden!important;display:grid!important;grid-template-columns:26px minmax(0,1fr) 25px!important;grid-template-rows:1fr auto!important;gap:4px 7px!important;align-items:center!important;padding:9px 8px!important}
      body.simple-edit-phase1 .track-label .orgavox-track-name{display:block!important;grid-column:2!important;grid-row:1!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#f5f0db!important;font:900 .68rem var(--font-body)!important;letter-spacing:.035em!important}
      body.simple-edit-phase1 .track-label .orgavox-track-index{grid-column:1!important;grid-row:1 / span 2!important;display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:999px!important;border:1px solid rgba(224,163,96,.72)!important;color:#f8d792!important;background:rgba(0,0,0,.22)!important;font:900 .68rem var(--font-mono)!important}
      body.simple-edit-phase1 .track-label .orgavox-track-mini{grid-column:2 / span 2!important;grid-row:2!important;display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;overflow:visible!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn{min-width:26px!important;height:22px!important;min-height:22px!important;padding:0 6px!important;border:1px solid rgba(137,107,73,.58)!important;border-radius:7px!important;background:rgba(0,0,0,.28)!important;color:#d7c5a1!important;font:900 .54rem var(--font-mono)!important;letter-spacing:.04em!important;cursor:pointer!important;animation:none!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn.mute.active{border-color:rgba(220,72,64,.9)!important;background:linear-gradient(180deg,rgba(105,38,35,.92),rgba(42,15,14,.96))!important;color:#ffd8d2!important;box-shadow:0 0 10px rgba(220,72,64,.18)!important;animation:none!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn.solo.active{border-color:rgba(224,163,96,.95)!important;background:linear-gradient(180deg,rgba(122,83,32,.94),rgba(48,29,11,.98))!important;color:#ffe4a8!important;box-shadow:0 0 10px rgba(224,163,96,.24)!important;animation:none!important}
      body.simple-edit-phase1 .orgavox-track-info-btn{min-width:24px!important;width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border:1px solid rgba(74,190,117,.9)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;font:900 .58rem var(--font-mono)!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important;cursor:pointer!important}
      body.simple-edit-phase1 .orgavox-track-menu-btn{grid-column:3!important;grid-row:1!important;min-width:25px!important;width:25px!important;height:25px!important;min-height:25px!important;padding:0!important;border:1px solid rgba(224,163,96,.55)!important;border-radius:8px!important;background:rgba(0,0,0,.24)!important;color:#ffe4a8!important;font:900 .76rem var(--font-mono)!important;cursor:pointer!important}
      body.simple-edit-phase1 .orgavox-edit-menu,body.simple-edit-phase1 .orgavox-view-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:215px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(224,163,96,.65)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important}
      body.simple-edit-phase1 .orgavox-edit-menu[hidden],body.simple-edit-phase1 .orgavox-view-menu[hidden]{display:none!important}
      body.simple-edit-phase1 .orgavox-edit-menu .tool-button,body.simple-edit-phase1 .orgavox-view-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important}
      body.simple-edit-phase1 #echoSettingsBtn{display:inline-flex!important;visibility:visible!important;opacity:1!important;min-width:32px!important;width:32px!important;height:32px!important;min-height:32px!important;align-items:center!important;justify-content:center!important;margin-left:4px!important}
    `;
    document.head.appendChild(style);
  }

  function trackSettings() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    for (let i = 0; i < 10; i += 1) {
      state.trackSettings[i] = { name: `Track ${i + 1}`, muted: false, solo: false, volume: 100, pan: 0, color: "cyan", ...(state.trackSettings[i] || {}) };
      state.trackSettings[i].name = String(state.trackSettings[i].name || `Track ${i + 1}`).slice(0, 48);
      state.trackSettings[i].volume = Math.max(0, Math.min(200, Number(state.trackSettings[i].volume) || 100));
    }
    return state.trackSettings;
  }

  function fixTrackLabels() {
    const settings = trackSettings();
    const anySolo = settings.some((track) => track.solo);
    document.querySelectorAll(".track-label").forEach((label) => {
      const index = Number(label.dataset.trackLabel);
      if (!Number.isFinite(index) || index < 0 || index > 9) return;
      const setting = settings[index];
      const isCurrent = Number(state.selectedTrack) === index;
      label.classList.toggle("active", isCurrent);
      label.classList.toggle("orgavox-track-muted", setting.muted);
      label.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      label.innerHTML = `
        <span class="orgavox-track-index">${index + 1}</span>
        <strong class="orgavox-track-name" title="${escapeHtml(setting.name)}">${escapeHtml(setting.name)}</strong>
        <button class="orgavox-track-menu-btn" type="button" title="Track menu">⋯</button>
        <span class="orgavox-track-mini">
          <button class="orgavox-track-mix-btn mute${setting.muted ? " active" : ""}" type="button" title="Mute track">M</button>
          <button class="orgavox-track-mix-btn solo${setting.solo ? " active" : ""}" type="button" title="Solo track">S</button>
          <button class="orgavox-track-info-btn" type="button" title="Analyze Track ${index + 1}">i</button>
          <span style="color:#e0a360;font:800 .54rem var(--font-mono);white-space:nowrap;">${Math.round(setting.volume)}%</span>
        </span>`;
      label.onclick = (event) => {
        if (event.target.closest("button")) return;
        state.selectedTrack = index;
        if (typeof selectTrack === "function") selectTrack(index);
        setTimeout(fixTrackLabels, 0);
      };
      label.querySelector(".mute")?.addEventListener("click", (event) => {
        event.stopPropagation();
        setting.muted = !setting.muted;
        stopPlayback?.();
        fixTrackLabels();
        renderTimeline?.();
        window.orgavoxRecordHistory?.();
      });
      label.querySelector(".solo")?.addEventListener("click", (event) => {
        event.stopPropagation();
        setting.solo = !setting.solo;
        stopPlayback?.();
        fixTrackLabels();
        renderTimeline?.();
        window.orgavoxRecordHistory?.();
      });
      label.querySelector(".orgavox-track-info-btn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        state.selectedTrack = index;
        const clip = state.clips.find((item) => Number(item.track) === index);
        if (clip && typeof selectClip === "function") selectClip(clip.id);
        const modal = document.getElementById("analysisModal");
        if (modal) {
          modal.hidden = false;
          setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
        } else if (typeof showToast === "function") showToast("Analyze panel is still loading.");
      });
    });
    document.querySelectorAll(".track-lane").forEach((lane) => {
      const index = Number(lane.dataset.track);
      const setting = settings[index];
      if (!setting) return;
      lane.classList.toggle("selected-track", Number(state.selectedTrack) === index);
      let overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "orgavox-track-volume-overlay";
        lane.appendChild(overlay);
      }
      overlay.textContent = `${setting.name} · VOL ${Math.round(setting.volume)}%`;
      overlay.dataset.track = String(index);
    });
  }

  function fixEditMenu() {
    const wrap = document.getElementById("orgavoxEditDropdown");
    const button = wrap?.querySelector(".orgavox-edit-button,button");
    const panel = wrap?.querySelector(".orgavox-edit-menu");
    if (!wrap || !button || !panel) return;
    wrap.hidden = false;
    wrap.style.display = "inline-flex";
    button.onpointerdown = (event) => { event.stopPropagation(); };
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = panel.hidden;
      document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((menu) => { menu.hidden = true; });
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    };
  }

  function fixViewMenu() {
    const wrap = document.getElementById("orgavoxViewDropdown");
    const button = wrap?.querySelector(".orgavox-view-button,button");
    const panel = wrap?.querySelector(".orgavox-view-menu");
    if (!wrap || !button || !panel) return;
    wrap.hidden = false;
    wrap.style.display = "inline-flex";
    button.onpointerdown = (event) => { event.stopPropagation(); };
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = panel.hidden;
      document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((menu) => { menu.hidden = true; });
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    };
  }

  function fixMarkerArrowOrder() {
    const group = document.querySelector(".orgavox-edit-group") || document.querySelector(".toolbar-actions");
    const marker = document.getElementById("markersBtn") || ui.markersBtn;
    const prev = document.getElementById("prevMarkerBtn");
    const next = document.getElementById("nextMarkerBtn");
    if (!group || !marker || !prev || !next) return;
    if (marker.parentElement !== group) group.appendChild(marker);
    if (prev.parentElement !== group || marker.previousElementSibling !== prev) group.insertBefore(prev, marker);
    if (next.parentElement !== group || marker.nextElementSibling !== next) group.insertBefore(next, marker.nextSibling);
  }

  function fixEchoSettings() {
    const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn;
    const out = document.getElementById("echoOut") || ui.echoOut;
    const control = out?.closest(".range-control") || document.getElementById("echoSlider")?.closest(".range-control");
    if (!button || !control) return;
    button.hidden = false;
    button.style.display = "inline-flex";
    button.classList.add("icon-button");
    button.title = "Echo settings";
    if (out && button.previousElementSibling !== out) out.insertAdjacentElement("afterend", button);
    else if (!out && button.parentElement !== control) control.appendChild(button);
    ui.echoSettingsBtn = button;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function run() {
    if (running) return;
    running = true;
    try {
      setVersion();
      installStyles();
      fixEditMenu();
      fixViewMenu();
      fixMarkerArrowOrder();
      fixEchoSettings();
      fixTrackLabels();
    } finally {
      running = false;
    }
  }

  const oldRenderTimeline = typeof renderTimeline === "function" ? renderTimeline : null;
  if (oldRenderTimeline && !window.__orgavoxFinalCleanupRenderWrapped) {
    window.__orgavoxFinalCleanupRenderWrapped = true;
    renderTimeline = function orgavoxFinalCleanupRenderTimeline() {
      const result = oldRenderTimeline.apply(this, arguments);
      setTimeout(run, 0);
      return result;
    };
  }
  const oldSelectTrack = typeof selectTrack === "function" ? selectTrack : null;
  if (oldSelectTrack && !window.__orgavoxFinalCleanupSelectTrackWrapped) {
    window.__orgavoxFinalCleanupSelectTrackWrapped = true;
    selectTrack = function orgavoxFinalCleanupSelectTrack(index) {
      const result = oldSelectTrack.apply(this, arguments);
      state.selectedTrack = Math.max(0, Math.min(9, Number(index) || 0));
      setTimeout(run, 0);
      return result;
    };
  }

  window.orgavoxApplyFinalCleanup = run;
  run();
  [0, 100, 300, 700, 1500, 2500].forEach((delay) => setTimeout(run, delay));
})();