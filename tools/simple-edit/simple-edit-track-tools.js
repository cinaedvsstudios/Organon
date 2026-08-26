"use strict";

(function installOrgavoxTrackTools() {
  const STYLE_ID = "orgavox-track-tools-style";
  const MENU_ID = "orgavoxTrackMenu";
  const POP_ID = "orgavoxTrackNumberPop";
  const TRACK_COUNT = 10;
  const COLOR_KEYS = ["cyan", "gold", "green", "purple", "red", "blue", "white"];
  const COLOR_MAP = { cyan: "#75b2de", gold: "#e0a360", green: "#4abe75", purple: "#b26dff", red: "#dc4840", blue: "#63b8ff", white: "#f5f0db" };

  function defaultTrack(index) { return { name: `Track ${index + 1}`, color: "cyan", muted: false, solo: false, volume: 100, pan: 0 }; }
  function tracks() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    for (let i = 0; i < TRACK_COUNT; i += 1) {
      const existing = state.trackSettings[i] || {};
      state.trackSettings[i] = { ...defaultTrack(i), ...existing };
      state.trackSettings[i].name = String(state.trackSettings[i].name || `Track ${i + 1}`).slice(0, 48);
      state.trackSettings[i].color = COLOR_MAP[state.trackSettings[i].color] ? state.trackSettings[i].color : "cyan";
      state.trackSettings[i].muted = Boolean(state.trackSettings[i].muted);
      state.trackSettings[i].solo = Boolean(state.trackSettings[i].solo);
      state.trackSettings[i].volume = Math.max(0, Math.min(200, Number(state.trackSettings[i].volume) || 100));
      state.trackSettings[i].pan = Math.max(-100, Math.min(100, Number(state.trackSettings[i].pan) || 0));
    }
    state.trackSettings.length = TRACK_COUNT;
    return state.trackSettings;
  }
  function cssColor(index) { return COLOR_MAP[tracks()[index]?.color] || COLOR_MAP.cyan; }
  function soloActive() { return tracks().some((track) => track.solo); }
  function isTrackAudible(index) {
    const setting = tracks()[index] || defaultTrack(index);
    if (typeof state.__orgavoxRenderTrackOnly === "number") return index === state.__orgavoxRenderTrackOnly;
    if (setting.muted) return false;
    return !soloActive() || setting.solo;
  }
  function trackGainValue(index) { return (isTrackAudible(index) ? 1 : 0) * Math.max(0, Math.min(2, (tracks()[index]?.volume || 100) / 100)); }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .track-label{position:relative;display:grid!important;grid-template-columns:26px minmax(0,1fr) 25px!important;grid-template-rows:1fr auto!important;gap:4px 7px!important;align-items:center!important;padding:9px 8px!important;overflow:hidden!important;transition:min-height .18s ease,height .18s ease!important}
      body.simple-edit-phase1 .track-label .orgavox-track-index{grid-column:1!important;grid-row:1 / span 2!important;display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:999px!important;background:rgba(0,0,0,.25)!important;color:#f8d792!important;font:900 .68rem var(--font-mono)!important}
      body.simple-edit-phase1 .track-label .orgavox-track-name{grid-column:2!important;grid-row:1!important;display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#f5f0db!important;font:900 .68rem var(--font-body)!important;letter-spacing:.035em!important}
      body.simple-edit-phase1 .orgavox-track-mini{grid-column:2 / span 2!important;grid-row:2!important;display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;overflow:visible!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn,body.simple-edit-phase1 .orgavox-track-info-btn{min-width:26px!important;height:22px!important;min-height:22px!important;padding:0 6px!important;border:1px solid rgba(137,107,73,.58)!important;border-radius:7px!important;background:rgba(0,0,0,.28)!important;color:#d7c5a1!important;font:900 .54rem var(--font-mono)!important;letter-spacing:.04em!important;cursor:pointer!important;animation:none!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn.mute.active{border-color:rgba(220,72,64,.9)!important;background:linear-gradient(180deg,rgba(105,38,35,.92),rgba(42,15,14,.96))!important;color:#ffd8d2!important;box-shadow:0 0 10px rgba(220,72,64,.18)!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn.solo.active{border-color:rgba(224,163,96,.95)!important;background:linear-gradient(180deg,rgba(122,83,32,.94),rgba(48,29,11,.98))!important;color:#ffe4a8!important;box-shadow:0 0 10px rgba(224,163,96,.24)!important}
      body.simple-edit-phase1 .orgavox-track-info-btn{min-width:24px!important;width:24px!important;padding:0!important;border-color:rgba(74,190,117,.9)!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important}
      body.simple-edit-phase1 .orgavox-track-menu-btn{grid-column:3!important;grid-row:1!important;min-width:25px!important;width:25px!important;height:25px!important;min-height:25px!important;padding:0!important;border:1px solid rgba(224,163,96,.55)!important;border-radius:8px!important;background:rgba(0,0,0,.24)!important;color:#ffe4a8!important;font:900 .76rem var(--font-mono)!important;cursor:pointer!important}
      body.simple-edit-phase1 .track-label.active{background:rgba(75,132,191,.16)!important;box-shadow:inset 3px 0 var(--water-spray)!important}
      body.simple-edit-phase1 .track-label[data-track-color="gold"]{box-shadow:inset 4px 0 #e0a360}body.simple-edit-phase1 .track-label[data-track-color="cyan"]{box-shadow:inset 4px 0 #75b2de}body.simple-edit-phase1 .track-label[data-track-color="green"]{box-shadow:inset 4px 0 #4abe75}body.simple-edit-phase1 .track-label[data-track-color="purple"]{box-shadow:inset 4px 0 #b26dff}body.simple-edit-phase1 .track-label[data-track-color="red"]{box-shadow:inset 4px 0 #dc4840}body.simple-edit-phase1 .track-label[data-track-color="blue"]{box-shadow:inset 4px 0 #63b8ff}body.simple-edit-phase1 .track-label[data-track-color="white"]{box-shadow:inset 4px 0 #f5f0db}
      body.simple-edit-phase1 .track-label.orgavox-track-muted,body.simple-edit-phase1 .track-label.orgavox-track-excluded,body.simple-edit-phase1 .track-lane.orgavox-track-muted,body.simple-edit-phase1 .track-lane.orgavox-track-excluded{filter:grayscale(1);opacity:.48}
      body.simple-edit-phase1 .track-lane{position:relative;transition:min-height .18s ease,height .18s ease!important}
      body.simple-edit-phase1 .track-lane.selected-track{background:linear-gradient(90deg,rgba(80,172,255,.24),rgba(117,178,222,.12))!important;box-shadow:inset 0 0 0 2px rgba(117,178,222,.72),inset 0 0 28px rgba(75,155,255,.28)!important}
      body.simple-edit-phase1 .track-lane::after{content:"";position:absolute;inset:0 0 auto 0;height:2px;background:var(--orgavox-track-color, rgba(117,178,222,.2));opacity:.55;pointer-events:none}
      body.simple-edit-phase1 .orgavox-track-volume-overlay{position:absolute;left:8px;top:8px;z-index:3;max-width:220px;padding:3px 8px;border:1px solid rgba(224,163,96,.42);border-radius:9px;background:rgba(0,0,0,.78);color:#f8d792;font:900 .58rem var(--font-mono);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.48);cursor:pointer;pointer-events:auto}
      body.simple-edit-phase1 .track-lane.orgavox-expanded-track{min-height:348px!important;height:348px!important;background:linear-gradient(90deg,rgba(80,172,255,.22),rgba(117,178,222,.1))!important;box-shadow:inset 0 0 0 2px rgba(117,178,222,.82),inset 0 0 30px rgba(75,155,255,.3)!important}
      body.simple-edit-phase1 .track-label.orgavox-expanded-track-label{min-height:348px!important;height:348px!important;background:rgba(117,178,222,.12)!important}
      .orgavox-track-menu,.orgavox-track-number-pop{position:fixed;z-index:4300;min-width:210px;padding:8px;border:1px solid rgba(224,163,96,.62);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}
      .orgavox-track-menu[hidden],.orgavox-track-number-pop[hidden]{display:none!important}.orgavox-track-menu button{width:100%;justify-content:flex-start!important;min-height:32px!important}.orgavox-track-menu .danger{border-color:rgba(220,72,64,.72)!important;color:#ffd8d2!important}
      .orgavox-track-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono)}
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function touch(message) { renderTimeline(); if (typeof showToast === "function" && message) showToast(message); window.orgavoxRecordHistory?.(); }
  function closeMenu() { const menu = document.getElementById(MENU_ID); if (menu) menu.hidden = true; }
  function ensureMenu() {
    let menu = document.getElementById(MENU_ID);
    if (!menu) { menu = document.createElement("div"); menu.id = MENU_ID; menu.className = "orgavox-track-menu"; menu.hidden = true; document.body.appendChild(menu); }
    return menu;
  }
  function showNumberPop(anchor, label, value, apply) {
    document.getElementById(POP_ID)?.remove();
    const rect = anchor.getBoundingClientRect();
    const pop = document.createElement("form");
    pop.id = POP_ID; pop.className = "orgavox-track-number-pop";
    pop.innerHTML = `<label>${escapeHtml(label)}<input type="text" value="${escapeHtml(value)}"></label><button class="tool-button primary" type="submit">Apply</button>`;
    pop.style.left = `${Math.min(window.innerWidth - 230, Math.max(8, rect.left))}px`;
    pop.style.top = `${Math.min(window.innerHeight - 110, Math.max(8, rect.bottom + 8))}px`;
    const input = pop.querySelector("input");
    pop.onsubmit = (event) => { event.preventDefault(); const n = Number(String(input.value).replace(/[^0-9.-]/g, "")); if (Number.isFinite(n) && apply(n) !== false) pop.remove(); };
    document.body.appendChild(pop); input.select(); input.focus();
  }

  function showMenu(index, anchor) {
    const menu = ensureMenu();
    menu.innerHTML = `
      <button class="tool-button" data-action="rename" type="button">✎ Rename track</button>
      <button class="tool-button" data-action="volume" type="button">🔊 Track volume…</button>
      <button class="tool-button" data-action="expand" type="button">▣ Expand track</button>
      <button class="tool-button" data-action="reset" type="button">▢ Reset track view</button>
      <button class="tool-button danger" data-action="clear" type="button">🧹 Clear track</button>`;
    menu.querySelectorAll("[data-action]").forEach((button) => button.onclick = () => runMenuAction(index, button.dataset.action));
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.min(window.innerWidth - 225, Math.max(8, rect.right + 7))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 240, Math.max(8, rect.top))}px`;
    menu.hidden = false;
  }
  function runMenuAction(index, action) {
    closeMenu();
    const setting = tracks()[index];
    if (action === "rename") { const next = prompt("Track name", setting.name); if (next != null) { setting.name = next.trim().slice(0, 48) || setting.name; touch("Track renamed."); } }
    if (action === "volume") showNumberPop(document.querySelector(`.track-label[data-track-label="${index}"]`) || document.body, `Track ${index + 1} volume`, setting.volume, (n) => { setting.volume = Math.max(0, Math.min(200, n)); stopPlayback?.(); touch("Track volume updated."); return true; });
    if (action === "expand") expandTrack(index);
    if (action === "reset") resetTrackView();
    if (action === "clear") { if (state.clips.some((clip) => Number(clip.track) === index) && (!confirm || confirm(`Clear ${setting.name}?`))) { state.clips = state.clips.filter((clip) => Number(clip.track) !== index); touch("Track cleared."); } }
  }

  function analyzeTrack(index) {
    state.selectedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0));
    const clip = state.clips.find((item) => Number(item.track) === state.selectedTrack);
    if (clip && typeof selectClip === "function") selectClip(clip.id);
    if (typeof selectTrack === "function") selectTrack(state.selectedTrack);
    const modal = document.getElementById("analysisModal");
    if (!modal) return showToast("Analyze panel is still loading.");
    modal.hidden = false;
    setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
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
      label.classList.toggle("active", Number(state.selectedTrack) === index);
      label.classList.toggle("orgavox-track-muted", setting.muted);
      label.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      label.classList.toggle("orgavox-expanded-track-label", state.expandedTrack === index);
      label.innerHTML = `<span class="orgavox-track-index">${index + 1}</span><strong class="orgavox-track-name" title="${escapeHtml(setting.name)}">${escapeHtml(setting.name)}</strong><button class="orgavox-track-menu-btn" type="button" title="Track menu">⋯</button><span class="orgavox-track-mini"><button class="orgavox-track-mix-btn mute${setting.muted ? " active" : ""}" type="button" title="Mute track">M</button><button class="orgavox-track-mix-btn solo${setting.solo ? " active" : ""}" type="button" title="Solo track">S</button><button class="orgavox-track-info-btn" type="button" title="Analyze Track ${index + 1}">i</button></span>`;
      label.querySelector(".orgavox-track-menu-btn")?.addEventListener("click", (event) => { event.stopPropagation(); showMenu(index, event.currentTarget); });
      label.querySelector(".mute")?.addEventListener("click", (event) => { event.stopPropagation(); setting.muted = !setting.muted; stopPlayback?.(); touch(); });
      label.querySelector(".solo")?.addEventListener("click", (event) => { event.stopPropagation(); setting.solo = !setting.solo; stopPlayback?.(); touch(); });
      label.querySelector(".orgavox-track-info-btn")?.addEventListener("click", (event) => { event.stopPropagation(); analyzeTrack(index); });
      label.addEventListener("click", (event) => { if (event.target.closest("button")) return; if (typeof selectTrack === "function") selectTrack(index); else state.selectedTrack = index; refreshTrackLabels(); });
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
      let overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (!overlay) { overlay = document.createElement("button"); overlay.type = "button"; overlay.className = "orgavox-track-volume-overlay"; lane.appendChild(overlay); }
      overlay.textContent = `${setting.name} · VOL ${Math.round(setting.volume)}%`;
      overlay.onclick = (event) => { event.stopPropagation(); showNumberPop(overlay, `${setting.name} volume`, setting.volume, (n) => { setting.volume = Math.max(0, Math.min(200, n)); stopPlayback?.(); touch("Track volume updated."); return true; }); };
    });
  }

  function randomizeTrackColors() { const palette = COLOR_KEYS.filter((color) => color !== "white"); tracks().forEach((track, index) => { track.color = palette[index % palette.length]; }); touch("Track colors randomized."); }
  function expandTrack(index = state.selectedTrack) { state.expandedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0)); refreshTrackLabels(); window.orgavoxRecordHistory?.(); }
  function resetTrackView() { state.expandedTrack = null; refreshTrackLabels(); window.orgavoxRecordHistory?.(); }
  function applyTrackView() { refreshTrackLabels(); }

  function patchAudioRouting() {
    if (window.__orgavoxTrackAudioPatched || typeof connectClipNodes !== "function") return;
    window.__orgavoxTrackAudioPatched = true;
    const previousConnectClipNodes = connectClipNodes;
    connectClipNodes = function orgavoxTrackConnectClipNodes(context, source, clip, destination) {
      const gain = context.createGain();
      gain.gain.value = trackGainValue(Math.max(0, Math.min(TRACK_COUNT - 1, Number(clip.track) || 0)));
      gain.connect(destination);
      return previousConnectClipNodes(context, source, clip, gain);
    };
  }
  function patchRender() {
    if (window.__orgavoxTrackRenderPatched) return;
    window.__orgavoxTrackRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxTrackRenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      refreshTrackLabels();
      return result;
    };
  }

  window.orgavoxRefreshTrackTools = refreshTrackLabels;
  window.orgavoxTrackSettings = tracks;
  window.orgavoxRandomizeTrackColors = randomizeTrackColors;
  window.orgavoxExpandSelectedTrack = () => expandTrack(state.selectedTrack);
  window.orgavoxResetTrackView = resetTrackView;
  window.orgavoxApplyTrackView = applyTrackView;

  installStyles();
  tracks();
  patchAudioRouting();
  patchRender();
  refreshTrackLabels();
  setTimeout(refreshTrackLabels, 100);
  document.addEventListener("click", (event) => { if (!event.target.closest(`#${MENU_ID}`) && !event.target.closest(".orgavox-track-menu-btn")) closeMenu(); });
})();
