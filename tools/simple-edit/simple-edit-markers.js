"use strict";

(function installOrgavoxMarkers() {
  const STYLE_ID = "orgavox-markers-style";
  const MODAL_ID = "markersModal";
  const LAYER_ID = "orgavoxMarkerLayer";
  const COLORS = ["gold", "blue", "green", "purple", "red"];
  let activeColor = "gold";

  function markerState() {
    if (!Array.isArray(state.markers)) state.markers = [];
    state.markers = state.markers
      .map((marker, index) => ({
        id: marker.id || makeId("marker"),
        time: Math.max(0, Number(marker.time) || 0),
        label: String(marker.label || `Marker ${index + 1}`).slice(0, 80),
        color: COLORS.includes(marker.color) ? marker.color : "gold"
      }))
      .sort((a, b) => a.time - b.time);
    return state.markers;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-markers-button{border-color:rgba(248,215,146,.82)!important;background:linear-gradient(180deg,rgba(112,75,31,.88),rgba(43,26,10,.95))!important;color:#ffe4a8!important}
      .orgavox-marker-layer{position:absolute;inset:0;z-index:34;pointer-events:none;overflow:visible}
      .orgavox-marker-line{position:absolute;top:0;bottom:0;width:2px;transform:translateX(-1px);background:rgba(248,215,146,.86);box-shadow:0 0 12px rgba(248,215,146,.32);pointer-events:auto;cursor:pointer}
      .orgavox-marker-line[data-color="blue"]{background:rgba(117,178,222,.9);box-shadow:0 0 12px rgba(117,178,222,.28)}
      .orgavox-marker-line[data-color="green"]{background:rgba(74,190,117,.88);box-shadow:0 0 12px rgba(74,190,117,.26)}
      .orgavox-marker-line[data-color="purple"]{background:rgba(178,109,255,.9);box-shadow:0 0 12px rgba(178,109,255,.26)}
      .orgavox-marker-line[data-color="red"]{background:rgba(220,72,64,.88);box-shadow:0 0 12px rgba(220,72,64,.26)}
      .orgavox-marker-tag{position:absolute;top:4px;left:4px;max-width:160px;padding:3px 7px;border:1px solid rgba(30,18,6,.7);border-radius:9px;background:linear-gradient(180deg,#f0c36d,#c89031);color:#17100a;font:900 .6rem var(--font-mono);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(0,0,0,.35)}
      .orgavox-marker-modal{position:fixed;inset:0;z-index:97;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-marker-modal[hidden]{display:none}
      .orgavox-marker-dialog{width:min(760px,calc(100vw - 42px));max-height:min(720px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-marker-form{display:grid;grid-template-columns:minmax(160px,1fr) auto auto;gap:10px;align-items:end;margin-top:14px}
      .orgavox-marker-list{display:grid;gap:8px;margin-top:14px}
      .orgavox-marker-row{display:grid;grid-template-columns:88px minmax(120px,1fr) auto auto;gap:8px;align-items:center;padding:9px;border:1px solid rgba(137,107,73,.5);border-radius:13px;background:rgba(0,0,0,.2)}
      .orgavox-marker-time{color:#75b2de;font:800 .68rem var(--font-mono)}
      .orgavox-marker-name{min-width:0;color:#f5f0db;font:800 .73rem var(--font-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .orgavox-marker-colors{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .orgavox-marker-swatch{width:22px;height:22px;border-radius:999px;border:1px solid rgba(245,240,219,.42);background:#e5b65d;cursor:pointer}
      .orgavox-marker-swatch.active{outline:2px solid rgba(255,255,255,.72);outline-offset:2px}
      .orgavox-marker-swatch[data-color="blue"]{background:#75b2de}.orgavox-marker-swatch[data-color="green"]{background:#4abe75}.orgavox-marker-swatch[data-color="purple"]{background:#b26dff}.orgavox-marker-swatch[data-color="red"]{background:#dc4840}
      .orgavox-marker-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      @media(max-width:760px){.orgavox-marker-form,.orgavox-marker-row{grid-template-columns:1fr}.orgavox-marker-actions{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    if (ui.markersBtn) return ui.markersBtn;
    const button = document.createElement("button");
    button.id = "markersBtn";
    button.type = "button";
    button.className = "tool-button orgavox-markers-button";
    button.textContent = "🏷 Markers";
    button.title = "Timeline markers and cue points";
    button.addEventListener("click", openModal);
    ui.markersBtn = button;
    placeButton();
    return button;
  }

  function placeButton() {
    const button = ui.markersBtn;
    if (!button) return;
    const editGroup = document.querySelector(".orgavox-edit-group");
    const effectsDrop = editGroup?.querySelector(".orgavox-effects-dropdown");
    if (editGroup && effectsDrop && button.parentElement !== editGroup) editGroup.insertBefore(button, effectsDrop);
    else if (editGroup && !button.parentElement) editGroup.appendChild(button);
  }

  function ensureLayer() {
    const content = document.getElementById("timelineContent");
    if (!content) return null;
    let layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      layer.className = "orgavox-marker-layer";
    }
    if (layer.parentElement !== content) content.appendChild(layer);
    return layer;
  }

  function renderMarkers() {
    const layer = ensureLayer();
    if (!layer) return;
    layer.innerHTML = "";
    const pps = Math.max(1, Number(state.pixelsPerSecond) || 80);
    markerState().forEach((marker) => {
      const line = document.createElement("button");
      line.type = "button";
      line.className = "orgavox-marker-line";
      line.dataset.markerId = marker.id;
      line.dataset.color = marker.color;
      line.style.left = `${marker.time * pps}px`;
      line.title = `${marker.label} — ${formatTime(marker.time)}`;
      line.innerHTML = `<span class="orgavox-marker-tag">${escapeHtml(marker.label)}</span>`;
      line.addEventListener("click", (event) => {
        event.stopPropagation();
        jumpToMarker(marker.id);
      });
      line.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        openModal();
      });
      layer.appendChild(line);
    });
    renderList();
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-marker-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-marker-dialog" role="dialog" aria-modal="true" aria-labelledby="markersTitle">
        <div class="popover-head"><div><span class="eyebrow">Timeline cues</span><h3 id="markersTitle">Markers</h3></div><button class="icon-button" data-markers-close type="button">×</button></div>
        <p class="export-note">Drop cue points on the timeline, jump back to them, rename them, or clear them. Markers follow the current timeline zoom.</p>
        <div class="orgavox-marker-form">
          <label class="field"><span>Marker name</span><input data-marker-name type="text" value="Marker" autocomplete="off"></label>
          <div class="orgavox-marker-colors" data-marker-colors></div>
          <button class="tool-button primary" data-marker-add type="button">Add at playhead</button>
        </div>
        <div class="orgavox-marker-list" data-marker-list></div>
        <div class="orgavox-marker-actions"><button class="tool-button" data-marker-copy type="button">Copy list</button><button class="tool-button danger" data-marker-clear type="button">Clear markers</button><button class="tool-button" data-markers-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-markers-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-marker-add]")?.addEventListener("click", addMarkerAtPlayhead);
    modal.querySelector("[data-marker-copy]")?.addEventListener("click", copyMarkerList);
    modal.querySelector("[data-marker-clear]")?.addEventListener("click", clearMarkers);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    renderColorChoices();
    return modal;
  }

  function renderColorChoices() {
    const box = ensureModal().querySelector("[data-marker-colors]");
    if (!box) return;
    box.innerHTML = "";
    COLORS.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "orgavox-marker-swatch";
      swatch.dataset.color = color;
      swatch.classList.toggle("active", color === activeColor);
      swatch.title = color;
      swatch.addEventListener("click", () => {
        activeColor = color;
        renderColorChoices();
      });
      box.appendChild(swatch);
    });
  }

  function renderList() {
    const list = document.getElementById(MODAL_ID)?.querySelector("[data-marker-list]");
    if (!list) return;
    const markers = markerState();
    list.innerHTML = markers.length ? "" : `<div class="empty-state">No markers yet.</div>`;
    markers.forEach((marker) => {
      const row = document.createElement("div");
      row.className = "orgavox-marker-row";
      row.innerHTML = `<span class="orgavox-marker-time">${formatTime(marker.time)}</span><span class="orgavox-marker-name">${escapeHtml(marker.label)}</span><button class="tool-button" data-marker-jump type="button">Jump</button><button class="tool-button danger" data-marker-delete type="button">Delete</button>`;
      row.querySelector("[data-marker-jump]")?.addEventListener("click", () => jumpToMarker(marker.id));
      row.querySelector("[data-marker-delete]")?.addEventListener("click", () => deleteMarker(marker.id));
      row.querySelector(".orgavox-marker-name")?.addEventListener("dblclick", () => renameMarker(marker.id));
      list.appendChild(row);
    });
  }

  function openModal() {
    ensureModal().hidden = false;
    const input = ensureModal().querySelector("[data-marker-name]");
    if (input) input.value = `Marker ${markerState().length + 1}`;
    renderList();
  }

  function closeModal() { ensureModal().hidden = true; }

  function addMarkerAtPlayhead() {
    const modal = ensureModal();
    const input = modal.querySelector("[data-marker-name]");
    const label = (input?.value || `Marker ${markerState().length + 1}`).trim().slice(0, 80) || `Marker ${markerState().length + 1}`;
    markerState().push({ id: makeId("marker"), time: Math.max(0, Number(state.playhead) || 0), label, color: activeColor });
    showToast(`Marker added at ${formatTime(state.playhead || 0)}.`);
    renderTimeline();
    renderMarkers();
    if (input) input.value = `Marker ${markerState().length + 1}`;
  }

  function jumpToMarker(id) {
    const marker = markerState().find((item) => item.id === id);
    if (!marker) return;
    stopPlayback();
    setPlayhead(marker.time);
    renderTimeline();
    renderMarkers();
    showToast(`Jumped to ${marker.label}.`);
  }

  function renameMarker(id) {
    const marker = markerState().find((item) => item.id === id);
    if (!marker) return;
    const next = prompt("Marker name", marker.label);
    if (next == null) return;
    marker.label = next.trim().slice(0, 80) || marker.label;
    renderTimeline();
    renderMarkers();
  }

  function deleteMarker(id) {
    state.markers = markerState().filter((marker) => marker.id !== id);
    renderTimeline();
    renderMarkers();
  }

  function clearMarkers() {
    if (!markerState().length) return;
    if (!confirm("Clear all markers?")) return;
    state.markers = [];
    renderTimeline();
    renderMarkers();
  }

  async function copyMarkerList() {
    const text = markerState().map((marker) => `${formatTime(marker.time)}\t${marker.label}`).join("\n") || "No markers";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Marker list copied.");
    } catch (error) {
      console.warn(error);
      showToast("Could not copy marker list.");
    }
  }

  function patchRender() {
    if (window.__orgavoxMarkersRenderPatched) return;
    window.__orgavoxMarkersRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxMarkersRenderTimeline() {
      previousRenderTimeline();
      placeButton();
      renderMarkers();
    };
    ui.zoomSlider?.addEventListener("input", () => setTimeout(renderMarkers, 0));
    document.addEventListener("keydown", (event) => {
      if (event.key?.toLowerCase() !== "m" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && /input|textarea|select/i.test(target.tagName || "")) return;
      event.preventDefault();
      markerState().push({ id: makeId("marker"), time: Math.max(0, Number(state.playhead) || 0), label: `Marker ${markerState().length + 1}`, color: activeColor });
      renderTimeline();
      renderMarkers();
      showToast("Marker added.");
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  window.orgavoxPlaceMarkersButton = placeButton;
  window.orgavoxRenderMarkers = renderMarkers;
  installStyles();
  ensureButton();
  ensureModal();
  patchRender();
  renderMarkers();
  setTimeout(() => { placeButton(); renderMarkers(); }, 150);
})();
