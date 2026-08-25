"use strict";

(function installOrgavoxClipContextMenu() {
  const STYLE_ID = "orgavox-clip-menu-style";
  const MENU_ID = "orgavoxClipContextMenu";
  let menuClipId = null;
  let menuTime = 0;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-clip-context-menu{position:fixed;z-index:3800;min-width:190px;padding:8px;border:1px solid rgba(224,163,96,.65);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}
      .orgavox-clip-context-menu[hidden]{display:none}
      .orgavox-clip-context-menu button{width:100%;justify-content:flex-start!important;min-height:32px!important;text-align:left!important}
      .orgavox-clip-context-menu .danger{border-color:rgba(220,72,64,.72)!important;color:#ffd8d2!important}
      .orgavox-clip-context-menu .orgavox-clip-menu-hint{padding:4px 7px;color:rgba(245,240,219,.52);font:700 .57rem var(--font-mono);letter-spacing:.035em;text-transform:uppercase}
    `;
    document.head.appendChild(style);
  }

  function ensureMenu() {
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.className = "orgavox-clip-context-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <div class="orgavox-clip-menu-hint" data-menu-title>Clip</div>
      <button class="tool-button" data-action="copy" type="button">⧉ Copy</button>
      <button class="tool-button" data-action="duplicate" type="button">⧉ Duplicate</button>
      <button class="tool-button" data-action="reverse" type="button">↩ Reverse</button>
      <button class="tool-button" data-action="download" type="button">⬇ Download…</button>
      <button class="tool-button" data-action="marker" type="button">🏷 Add marker</button>
      <button class="tool-button danger" data-action="delete" type="button">🗑 Delete</button>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button.dataset.action));
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(`#${MENU_ID}`)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "v") pasteCopiedClip();
    });
    return menu;
  }

  function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) menu.hidden = true;
  }

  function clipById(id) {
    return state.clips.find((clip) => clip.id === id) || null;
  }

  function cloneClip(clip, overrides = {}) {
    return {
      ...clip,
      ...overrides,
      id: makeId("clip"),
      cacheVersion: 0,
      volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((keyframe) => ({ ...keyframe, id: makeId("kf") })) : []
    };
  }

  function pointerMenuTime(event, clip) {
    try {
      if (typeof pointerTime === "function") return Math.max(0, pointerTime(event));
    } catch {}
    return clip?.start || 0;
  }

  function showMenu(event, clipNode) {
    const clip = clipById(clipNode.dataset.clipId);
    if (!clip) return;
    event.preventDefault();
    event.stopPropagation();
    stopPlayback();
    selectClip(clip.id);
    menuClipId = clip.id;
    menuTime = pointerMenuTime(event, clip);
    const menu = ensureMenu();
    const title = menu.querySelector("[data-menu-title]");
    if (title) title.textContent = `${clip.name.slice(0, 26)} · ${formatTime(menuTime)}`;
    menu.querySelector('[data-action="reverse"]').textContent = clip.reverseAudio ? "🔁 Unreverse" : "↩ Reverse";
    menu.style.left = `${Math.min(window.innerWidth - 205, Math.max(8, event.clientX))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 248, Math.max(8, event.clientY))}px`;
    menu.hidden = false;
  }

  function runAction(action) {
    const clip = clipById(menuClipId);
    closeMenu();
    if (!clip) return;
    if (action === "copy") return copyClip(clip);
    if (action === "duplicate") return duplicateClip(clip);
    if (action === "reverse") return reverseClip(clip);
    if (action === "download") return downloadClip(clip);
    if (action === "marker") return addMarker(clip);
    if (action === "delete") return deleteClip(clip);
  }

  function copyClip(clip) {
    state.__orgavoxClipClipboard = cloneClip(clip, { id: clip.id });
    showToast("Clip copied. Press Ctrl+V to paste at the playhead.");
  }

  function pasteCopiedClip() {
    const target = state.__orgavoxClipClipboard;
    if (!target) return;
    const next = cloneClip(target, {
      start: Math.max(0, state.playhead || 0),
      track: Math.max(0, Math.min(9, Number(state.selectedTrack) || 0))
    });
    state.clips.push(next);
    selectClip(next.id);
    renderTimeline();
    showToast("Copied clip pasted at the playhead.");
    window.orgavoxRecordHistory?.();
  }

  function duplicateClip(clip) {
    const next = cloneClip(clip, { start: clip.start + Math.max(.25, clipDuration(clip)) });
    state.clips.push(next);
    selectClip(next.id);
    renderTimeline();
    showToast("Clip duplicated.");
    window.orgavoxRecordHistory?.();
  }

  function reverseClip(clip) {
    state.selectedClipId = clip.id;
    if (typeof window.orgavoxToggleReverseSelectedClip === "function") window.orgavoxToggleReverseSelectedClip();
    else {
      clip.reverseAudio = !clip.reverseAudio;
      invalidateClip(clip);
      renderTimeline();
      showToast(clip.reverseAudio ? "Clip reversed." : "Clip reverse removed.");
    }
    window.orgavoxRecordHistory?.();
  }

  function downloadClip(clip) {
    state.selectedClipId = clip.id;
    if (typeof window.orgavoxDownloadSelectedClip === "function") window.orgavoxDownloadSelectedClip();
    else showToast("Clip download tool is not ready yet.");
  }

  function addMarker(clip) {
    if (!Array.isArray(state.markers)) state.markers = [];
    state.markers.push({
      id: makeId("marker"),
      time: Math.max(0, menuTime || clip.start || 0),
      label: clip.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Clip marker",
      color: "purple"
    });
    renderTimeline();
    window.orgavoxRenderMarkers?.();
    showToast("Marker added to clip position.");
    window.orgavoxRecordHistory?.();
  }

  function deleteClip(clip) {
    stopPlayback();
    state.clips = state.clips.filter((item) => item.id !== clip.id);
    if (state.selectedClipId === clip.id) state.selectedClipId = null;
    syncSelectedControls();
    renderTimeline();
    showToast("Clip deleted.");
    window.orgavoxRecordHistory?.();
  }

  function installContextListener() {
    if (window.__orgavoxClipContextMenuListener) return;
    window.__orgavoxClipContextMenuListener = true;
    document.addEventListener("contextmenu", (event) => {
      const clipNode = event.target.closest?.(".audio-clip");
      if (!clipNode) return;
      showMenu(event, clipNode);
    });
  }

  installStyles();
  ensureMenu();
  installContextListener();
})();
