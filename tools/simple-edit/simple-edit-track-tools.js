"use strict";

(function installOrgavoxTrackTools() {
  const MENU_ID = "orgavoxTrackMenu";
  const POP_ID = "orgavoxTrackNumberPop";
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
  function soloActive() { return tracks().some((track) => track.solo); }
  function isTrackAudible(index) { const setting = tracks()[index] || defaultTrack(index); if (typeof state.__orgavoxRenderTrackOnly === "number") return index === state.__orgavoxRenderTrackOnly; if (setting.muted) return false; return !soloActive() || setting.solo; }
  function trackGainValue(index) { return (isTrackAudible(index) ? 1 : 0) * Math.max(0, Math.min(2, (tracks()[index]?.volume || 100) / 100)); }
  function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  function closeMenu() { const menu = document.getElementById(MENU_ID); if (menu) menu.hidden = true; }
  function ensureMenu() { let menu = document.getElementById(MENU_ID); if (!menu) { menu = document.createElement("div"); menu.id = MENU_ID; menu.className = "orgavox-track-menu"; menu.hidden = true; document.body.appendChild(menu); } return menu; }
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
    pop.addEventListener("submit", (event) => { event.preventDefault(); const number = Number(String(input.value).replace(/[^0-9.-]/g, "")); if (Number.isFinite(number) && apply(number) !== false) pop.remove(); });
    document.body.appendChild(pop); input.select(); input.focus();
  }
  function touch(message) { stopPlayback?.(); refreshTrackLabels(); renderTimeline(); window.orgavoxRecordHistory?.(); if (message && typeof showToast === "function") showToast(message); }

  function showMenu(index, anchor) {
    const menu = ensureMenu();
    menu.textContent = "";
    const actions = [["rename", "✎ Rename track"], ["volume", "🔊 Track volume…"], ["expand", "▣ Expand track"], ["reset", "▢ Reset track view"], ["clear", "🧹 Clear track"]];
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
    const setting = tracks()[index];
    if (!setting) return;
    if (action === "rename") { const next = prompt("Track name", setting.name); if (next != null) { setting.name = next.trim().slice(0, 48) || setting.name; touch("Track renamed."); } }
    if (action === "volume") { const anchor = document.querySelector(`.track-label[data-track-label="${index}"] .orgavox-track-volume-pill`) || document.querySelector(`.track-lane[data-track="${index}"] .orgavox-track-volume-overlay`) || document.body; numberPop(anchor, `${setting.name} volume`, setting.volume, (number) => { setting.volume = Math.max(0, Math.min(200, number)); touch("Track volume updated."); return true; }); }
    if (action === "expand") expandTrack(index);
    if (action === "reset") resetTrackView();
    if (action === "clear" && state.clips.some((clip) => Number(clip.track) === index) && (!confirm || confirm(`Clear ${setting.name}?`))) { state.clips = state.clips.filter((clip) => Number(clip.track) !== index); touch("Track cleared."); }
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
    if (!label || label.dataset.orgavoxTrackWired) return;
    label.dataset.orgavoxTrackWired = "true";
    label.addEventListener("click", (event) => { if (event.target.closest("button")) return; if (typeof selectTrack === "function") selectTrack(index); else state.selectedTrack = index; refreshTrackLabels(); });
    label.querySelector(".orgavox-track-menu-btn")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); showMenu(index, event.currentTarget); });
    label.querySelector(".orgavox-track-mix-btn.mute")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); tracks()[index].muted = !tracks()[index].muted; touch(); });
    label.querySelector(".orgavox-track-mix-btn.solo")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); tracks()[index].solo = !tracks()[index].solo; touch(); });
    label.querySelector(".orgavox-track-info-btn")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); analyzeTrack(index); });
    label.querySelector(".orgavox-track-volume-pill")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const setting = tracks()[index]; numberPop(event.currentTarget, `${setting.name} volume`, setting.volume, (number) => { setting.volume = Math.max(0, Math.min(200, number)); touch("Track volume updated."); return true; }); });
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
      label.classList.toggle("active", Number(state.selectedTrack) === index);
      label.classList.toggle("orgavox-track-muted", setting.muted);
      label.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      label.classList.toggle("orgavox-expanded-track-label", state.expandedTrack === index);
      const name = label.querySelector(".orgavox-track-name");
      if (name) { name.textContent = setting.name; name.title = setting.name; }
      label.querySelector(".orgavox-track-mix-btn.mute")?.classList.toggle("active", setting.muted);
      label.querySelector(".orgavox-track-mix-btn.solo")?.classList.toggle("active", setting.solo);
      const pill = label.querySelector(".orgavox-track-volume-pill");
      if (pill) pill.textContent = `${Math.round(setting.volume)}%`;
      wireLabel(index, label);
    });
    ui.lanes.forEach((lane) => {
      const index = Number(lane.dataset.track);
      if (!Number.isFinite(index) || index < 0 || index >= TRACK_COUNT) return;
      const setting = settings[index];
      lane.style.setProperty("--orgavox-track-color", cssColor(index));
      lane.classList.toggle("selected-track", Number(state.selectedTrack) === index);
      lane.classList.toggle("orgavox-track-muted", setting.muted);
      lane.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      lane.classList.toggle("orgavox-expanded-track", state.expandedTrack === index);
      const overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (overlay) overlay.textContent = `${setting.name} · VOL ${Math.round(setting.volume)}%`;
    });
  }

  function randomizeTrackColors() { const palette = COLOR_KEYS.filter((color) => color !== "white"); tracks().forEach((track, index) => { track.color = palette[index % palette.length]; }); touch("Track colors randomized."); }
  function expandTrack(index = state.selectedTrack) { state.expandedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0)); refreshTrackLabels(); window.orgavoxRecordHistory?.(); }
  function resetTrackView() { state.expandedTrack = null; refreshTrackLabels(); window.orgavoxRecordHistory?.(); }

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

  window.orgavoxRefreshTrackTools = refreshTrackLabels;
  window.orgavoxTrackSettings = tracks;
  window.orgavoxRandomizeTrackColors = randomizeTrackColors;
  window.orgavoxExpandSelectedTrack = () => expandTrack(state.selectedTrack);
  window.orgavoxResetTrackView = resetTrackView;
  window.orgavoxApplyTrackView = refreshTrackLabels;
  tracks();
  setTimeout(refreshTrackLabels, 0);
  document.addEventListener("click", (event) => { if (!event.target.closest(`#${MENU_ID}`) && !event.target.closest(".orgavox-track-menu-btn")) closeMenu(); });
})();