"use strict";

(function installOrgavoxTrackTools() {
  const MENU_ID = "orgavoxTrackMenu";
  const POP_ID = "orgavoxTrackNumberPop";
  const MODAL_ID = "orgavoxTrackActionModal";
  const STYLE_ID = "orgavoxTrackToolsPhase3Styles";
  const TRACK_COUNT = 10;
  const COLOR_KEYS = ["cyan", "gold", "green", "purple", "red", "blue", "white"];
  const COLOR_MAP = { cyan: "#75b2de", gold: "#e0a360", green: "#4abe75", purple: "#b26dff", red: "#dc4840", blue: "#63b8ff", white: "#f5f0db" };

  function defaultTrack(index) { return { name: `Track ${index + 1}`, color: COLOR_KEYS[index % 6], muted: false, solo: false, volume: 100, pan: 0 }; }
  function tracks() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    for (let index = 0; index < TRACK_COUNT; index += 1) {
      const setting = { ...defaultTrack(index), ...(state.trackSettings[index] || {}) };
      setting.name = String(setting.name || `Track ${index + 1}`).slice(0, 48);
      setting.color = COLOR_MAP[setting.color] ? setting.color : defaultTrack(index).color;
      setting.muted = Boolean(setting.muted);
      setting.solo = Boolean(setting.solo);
      setting.volume = Math.max(0, Math.min(200, Number(setting.volume) || 100));
      setting.pan = Math.max(-100, Math.min(100, Number(setting.pan) || 0));
      state.trackSettings[index] = setting;
    }
    state.trackSettings.length = TRACK_COUNT;
    return state.trackSettings;
  }
  function cssColor(index) { return COLOR_MAP[tracks()[index]?.color] || COLOR_MAP.cyan; }
  function cssBg(index, alpha = .13) {
    const hex = cssColor(index).replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function soloActive() { return tracks().some((track) => track.solo); }
  function isTrackAudible(index) {
    const setting = tracks()[index] || defaultTrack(index);
    if (typeof state.__orgavoxRenderTrackOnly === "number") return index === state.__orgavoxRenderTrackOnly;
    if (setting.muted) return false;
    return !soloActive() || setting.solo;
  }
  function trackGainValue(index) { return (isTrackAudible(index) ? 1 : 0) * Math.max(0, Math.min(2, (tracks()[index]?.volume || 100) / 100)); }
  function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .track-label{background:linear-gradient(90deg,var(--orgavox-track-bg,rgba(117,178,222,.12)),rgba(0,0,0,.18))!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de)!important}
      body.simple-edit-phase1 .track-lane{background:linear-gradient(90deg,var(--orgavox-track-bg-soft,rgba(117,178,222,.06)),rgba(0,0,0,.08))!important;box-shadow:inset 3px 0 var(--orgavox-track-color,#75b2de)!important}
      body.simple-edit-phase1 .track-label.orgavox-expanded-track-label{height:calc(var(--lane-h,112px)*1.7)!important;min-height:calc(var(--lane-h,112px)*1.7)!important;align-content:start!important;padding-top:14px!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de),inset 0 0 0 2px rgba(224,163,96,.5)!important}
      body.simple-edit-phase1 .track-lane.orgavox-expanded-track{height:calc(var(--lane-h,112px)*1.7)!important;min-height:calc(var(--lane-h,112px)*1.7)!important;box-shadow:inset 0 0 0 2px rgba(224,163,96,.42),inset 4px 0 var(--orgavox-track-color,#75b2de)!important}
      body.simple-edit-phase1 .track-lane.orgavox-expanded-track .audio-clip{min-height:52px!important}
      body.simple-edit-phase1 .track-label.orgavox-track-muted,body.simple-edit-phase1 .track-lane.orgavox-track-muted{opacity:.58!important}
      body.simple-edit-phase1 .track-label.orgavox-track-excluded,body.simple-edit-phase1 .track-lane.orgavox-track-excluded{opacity:.42!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn.active{transform:scale(1.08)!important;box-shadow:0 0 12px rgba(224,163,96,.38)!important}
      body.simple-edit-phase1 .orgavox-track-volume-overlay{cursor:pointer!important}
      body.simple-edit-phase1 .orgavox-track-volume-overlay:hover{border-color:rgba(117,178,222,.86)!important;color:#e1f7ff!important}
      .orgavox-track-action-modal{position:fixed!important;inset:0!important;z-index:999998!important;display:grid!important;place-items:center!important;padding:24px!important;background:rgba(0,0,0,.58)!important;color:#f5f0db!important}
      .orgavox-track-action-modal[hidden]{display:none!important}
      .orgavox-track-action-dialog{width:min(460px,calc(100vw - 40px))!important;display:grid!important;gap:12px!important;padding:16px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(24,25,24,.98),rgba(10,11,10,.99))!important;box-shadow:0 22px 64px rgba(0,0,0,.76)!important}
      .orgavox-track-action-dialog h3{margin:.1rem 0 .2rem!important;color:#e0a360!important;font-family:var(--font-head,var(--font-headers),Georgia,serif)!important}
      .orgavox-track-action-dialog p{margin:0!important;color:rgba(245,240,219,.7)!important;line-height:1.4!important}
      .orgavox-track-action-dialog .field{display:grid!important;gap:6px!important}
      .orgavox-track-action-dialog input{width:100%!important;box-sizing:border-box!important;border:1px solid rgba(224,163,96,.45)!important;border-radius:10px!important;background:rgba(0,0,0,.35)!important;color:#f5f0db!important;padding:9px 10px!important}
    `;
    document.head.appendChild(style);
  }

  function closeMenu() { const menu = document.getElementById(MENU_ID); if (menu) menu.hidden = true; }
  function ensureMenu() {
    let menu = document.getElementById(MENU_ID);
    if (!menu) { menu = document.createElement("div"); menu.id = MENU_ID; menu.className = "orgavox-track-menu"; menu.hidden = true; document.body.appendChild(menu); }
    return menu;
  }
  function numberPop(anchor, label, value, apply) {
    document.getElementById(POP_ID)?.remove();
    const rect = anchor.getBoundingClientRect();
    const pop = document.createElement("form");
    pop.id = POP_ID;
    pop.className = "orgavox-track-number-pop";
    pop.innerHTML = `<label>${escapeHtml(label)}<input type="text" value="${escapeHtml(value)}"></label><button class="tool-button primary" type="submit">Apply</button>`;
    pop.style.left = `${Math.min(window.innerWidth - 230, Math.max(8, rect.left))}px`;
    pop.style.top = `${Math.min(window.innerHeight - 110, Math.max(8, rect.bottom + 8))}px`;
    const input = pop.querySelector("input");
    pop.addEventListener("submit", (event) => {
      event.preventDefault();
      const number = Number(String(input.value).replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(number) && apply(number) !== false) pop.remove();
    });
    document.body.appendChild(pop); input.select(); input.focus();
  }
  function touch(message) {
    stopPlayback?.();
    renderTimeline();
    refreshTrackLabels();
    window.orgavoxRenderMarkers?.();
    window.orgavoxRecordHistory?.();
    if (message && typeof showToast === "function") showToast(message);
  }

  function ensureActionModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-track-action-modal";
    modal.hidden = true;
    document.body.appendChild(modal);
    modal.addEventListener("pointerdown", (event) => { if (event.target === modal) modal.hidden = true; });
    return modal;
  }

  function openRenameModal(index) {
    const setting = tracks()[index];
    if (!setting) return;
    const modal = ensureActionModal();
    modal.innerHTML = `<form class="orgavox-track-action-dialog" role="dialog" aria-modal="true"><div><span class="eyebrow">Track settings</span><h3>Rename track</h3></div><label class="field"><span>Track name</span><input id="orgavoxTrackRenameInput" type="text" maxlength="48" value="${escapeHtml(setting.name)}"></label><div class="button-row end"><button class="tool-button" data-track-cancel type="button">Cancel</button><button class="tool-button primary" type="submit">Rename</button></div></form>`;
    modal.hidden = false;
    const form = modal.querySelector("form");
    const input = modal.querySelector("#orgavoxTrackRenameInput");
    modal.querySelector("[data-track-cancel]")?.addEventListener("click", () => { modal.hidden = true; });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = input.value.trim().slice(0, 48);
      if (next) { setting.name = next; touch("Rename track"); }
      modal.hidden = true;
    });
    setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  function openClearModal(index) {
    const setting = tracks()[index];
    if (!setting) return;
    const count = state.clips.filter((clip) => Number(clip.track) === index).length;
    if (!count) { showToast?.(`${setting.name} is already empty.`); return; }
    const modal = ensureActionModal();
    modal.innerHTML = `<section class="orgavox-track-action-dialog" role="dialog" aria-modal="true"><div><span class="eyebrow">Confirm track cleanup</span><h3>Clear ${escapeHtml(setting.name)}?</h3></div><p>This will remove ${count} clip${count === 1 ? "" : "s"} from this track. Other tracks stay untouched.</p><div class="button-row end"><button class="tool-button" data-track-cancel type="button">Cancel</button><button class="tool-button danger" data-track-clear type="button">Clear track</button></div></section>`;
    modal.hidden = false;
    modal.querySelector("[data-track-cancel]")?.addEventListener("click", () => { modal.hidden = true; });
    modal.querySelector("[data-track-clear]")?.addEventListener("click", () => {
      state.clips = state.clips.filter((clip) => Number(clip.track) !== index);
      if (state.selectedClipId && !state.clips.some((clip) => clip.id === state.selectedClipId)) state.selectedClipId = null;
      state.selectedClipIds = (state.selectedClipIds || []).filter((id) => state.clips.some((clip) => clip.id === id));
      modal.hidden = true;
      touch("Clear track");
    });
  }

  function showMenu(index, anchor) {
    const menu = ensureMenu();
    menu.textContent = "";
    const actions = [
      ["rename", "✎ Rename track"],
      ["volume", "🔊 Track volume…"],
      ["expand", "▣ Expand track"],
      ["reset", "▢ Reset track view"],
      ["clear", "🧹 Clear track"]
    ];
    actions.forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === "clear" ? "tool-button danger" : "tool-button";
      button.textContent = label;
      button.addEventListener("click", () => runMenuAction(index, action));
      menu.appendChild(button);
    });
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.min(window.innerWidth - 225, Math.max(8, rect.right + 7))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 240, Math.max(8, rect.top))}px`;
    menu.hidden = false;
  }

  function runMenuAction(index, action) {
    closeMenu();
    if (action === "rename") openRenameModal(index);
    if (action === "volume") openTrackVolume(index);
    if (action === "expand") expandTrack(index);
    if (action === "reset") resetTrackView();
    if (action === "clear") openClearModal(index);
  }

  function openTrackVolume(index, anchor = null) {
    const setting = tracks()[index];
    if (!setting) return;
    const target = anchor || document.querySelector(`.track-lane[data-track="${index}"] .orgavox-track-volume-overlay`) || document.body;
    numberPop(target, `${setting.name} volume`, setting.volume, (number) => { setting.volume = Math.max(0, Math.min(200, number)); touch("Track volume updated."); return true; });
  }

  function analyzeTrack(index) {
    state.selectedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0));
    const clip = state.clips.find((item) => Number(item.track) === state.selectedTrack);
    if (clip && typeof selectClip === "function") selectClip(clip.id);
    if (typeof selectTrack === "function") selectTrack(state.selectedTrack);
    const modal = document.getElementById("analysisModal");
    if (!modal) { if (typeof showToast === "function") showToast("Analyze panel is still loading."); return; }
    modal.hidden = false;
    setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
  }

  function wireLabel(index, label) {
    if (!label) return;
    if (!label.dataset.orgavoxTrackLabelClick) {
      label.dataset.orgavoxTrackLabelClick = "true";
      label.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        if (typeof selectTrack === "function") selectTrack(index); else state.selectedTrack = index;
        refreshTrackLabels();
      });
    }
    const menu = label.querySelector(".orgavox-track-menu-btn");
    if (menu && !menu.dataset.orgavoxTrackMenuWired) {
      menu.dataset.orgavoxTrackMenuWired = "true";
      menu.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); showMenu(index, event.currentTarget); });
    }
    const mute = label.querySelector(".orgavox-track-mix-btn.mute");
    if (mute && !mute.dataset.orgavoxTrackMuteWired) {
      mute.dataset.orgavoxTrackMuteWired = "true";
      mute.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const setting = tracks()[index]; setting.muted = !setting.muted; touch(`${setting.name} ${setting.muted ? "muted" : "unmuted"}.`); });
    }
    const solo = label.querySelector(".orgavox-track-mix-btn.solo");
    if (solo && !solo.dataset.orgavoxTrackSoloWired) {
      solo.dataset.orgavoxTrackSoloWired = "true";
      solo.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const setting = tracks()[index]; setting.solo = !setting.solo; touch(`${setting.name} solo ${setting.solo ? "on" : "off"}.`); });
    }
    const info = label.querySelector(".orgavox-track-info-btn");
    if (info && !info.dataset.orgavoxTrackInfoWired) {
      info.dataset.orgavoxTrackInfoWired = "true";
      info.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); analyzeTrack(index); });
    }
  }

  function refreshTrackLabels() {
    const settings = tracks();
    const anySolo = soloActive();
    ui.trackLabels = [...document.querySelectorAll(".track-label")];
    ui.lanes = [...document.querySelectorAll(".track-lane")];
    ui.trackLabels.forEach((label) => {
      const index = Number(label.dataset.trackLabel);
      if (!Number.isFinite(index) || index < 0 || index >= TRACK_COUNT) return;
      const setting = settings[index];
      label.dataset.trackColor = setting.color;
      label.style.setProperty("--orgavox-track-color", cssColor(index));
      label.style.setProperty("--orgavox-track-bg", cssBg(index, .18));
      label.classList.toggle("active", Number(state.selectedTrack) === index);
      label.classList.toggle("orgavox-track-muted", setting.muted);
      label.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      label.classList.toggle("orgavox-expanded-track-label", state.expandedTrack === index);
      const name = label.querySelector(".orgavox-track-name");
      if (name) { name.textContent = setting.name; name.title = setting.name; }
      label.querySelector(".orgavox-track-mix-btn.mute")?.classList.toggle("active", setting.muted);
      label.querySelector(".orgavox-track-mix-btn.solo")?.classList.toggle("active", setting.solo);
      wireLabel(index, label);
    });
    ui.lanes.forEach((lane) => {
      const index = Number(lane.dataset.track);
      if (!Number.isFinite(index) || index < 0 || index >= TRACK_COUNT) return;
      const setting = settings[index];
      lane.style.setProperty("--orgavox-track-color", cssColor(index));
      lane.style.setProperty("--orgavox-track-bg", cssBg(index, .13));
      lane.style.setProperty("--orgavox-track-bg-soft", cssBg(index, .07));
      lane.classList.toggle("selected-track", Number(state.selectedTrack) === index);
      lane.classList.toggle("orgavox-track-muted", setting.muted);
      lane.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      lane.classList.toggle("orgavox-expanded-track", state.expandedTrack === index);
      const overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (overlay) {
        overlay.textContent = `${setting.name} · VOL ${Math.round(setting.volume)}%`;
        if (!overlay.dataset.orgavoxTrackVolumeWired) {
          overlay.dataset.orgavoxTrackVolumeWired = "true";
          overlay.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openTrackVolume(index, overlay); });
        }
      }
    });
  }

  function randomizeTrackColors() {
    const palette = COLOR_KEYS.filter((color) => color !== "white");
    tracks().forEach((track, index) => {
      const current = track.color;
      let next = palette[Math.floor(Math.random() * palette.length)];
      if (palette.length > 1 && next === current) next = palette[(palette.indexOf(next) + index + 1) % palette.length];
      track.color = next;
    });
    touch("Track colors randomized.");
  }
  function expandTrack(index = state.selectedTrack) { state.expandedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0)); touch("Track expanded."); }
  function resetTrackView() { state.expandedTrack = null; touch("Track view reset."); }

  if (!window.__orgavoxTrackAudioPatched && typeof connectClipNodes === "function") {
    window.__orgavoxTrackAudioPatched = true;
    const previousConnectClipNodes = connectClipNodes;
    connectClipNodes = function orgavoxTrackConnectClipNodes(context, source, clip, destination) {
      const gain = context.createGain();
      gain.gain.value = trackGainValue(Math.max(0, Math.min(TRACK_COUNT - 1, Number(clip.track) || 0)));
      gain.connect(destination);
      const extra = Array.prototype.slice.call(arguments, 4);
      return previousConnectClipNodes.call(this, context, source, clip, gain, ...extra);
    };
  }

  function patchRenderTimeline() {
    if (window.__orgavoxTrackToolsRenderPatched || typeof renderTimeline !== "function") return;
    window.__orgavoxTrackToolsRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxTrackToolsRenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      requestAnimationFrame(refreshTrackLabels);
      return result;
    };
  }

  window.orgavoxRefreshTrackTools = refreshTrackLabels;
  window.orgavoxTrackSettings = tracks;
  window.orgavoxTrackIsAudible = isTrackAudible;
  window.orgavoxRandomizeTrackColors = randomizeTrackColors;
  window.orgavoxExpandSelectedTrack = () => expandTrack(state.selectedTrack);
  window.orgavoxResetTrackView = resetTrackView;
  window.orgavoxApplyTrackView = refreshTrackLabels;
  installStyles();
  tracks();
  patchRenderTimeline();
  setTimeout(refreshTrackLabels, 0);
  document.addEventListener("click", (event) => { if (!event.target.closest(`#${MENU_ID}`) && !event.target.closest(".orgavox-track-menu-btn")) closeMenu(); });
})();
