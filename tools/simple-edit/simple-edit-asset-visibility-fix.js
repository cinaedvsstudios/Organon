"use strict";

(function installSimpleEditAssetVisibilityFix() {
  const VERSION = "v0.18";
  const STYLE_ID = "simple-edit-asset-visibility-fix-style";

  function setVersion() {
    document.title = `Organon — Simple Edit ${VERSION}`;
    const badge = document.querySelector(".phase1-version, .simple-edit-version");
    if (badge) badge.textContent = VERSION;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .library-panel {
        overflow: hidden !important;
      }
      body.simple-edit-phase1 .asset-list {
        display: flex !important;
        flex: 1 1 220px !important;
        min-height: 180px !important;
        max-height: none !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 8 !important;
        padding-top: 2px;
      }
      body.simple-edit-phase1 .asset-list .asset-item {
        display: grid !important;
        flex: 0 0 auto !important;
        min-height: 58px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      body.simple-edit-phase1 .asset-list .empty-state {
        min-height: 120px !important;
      }
      body.simple-edit-phase1 .audio-clip {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 12 !important;
      }
      body.simple-edit-phase1 .track-lane {
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureVisibleAssetItems() {
    const list = ui.assetList;
    if (!list) return;
    if (!state.assets.length) {
      if (!list.querySelector(".empty-state")) {
        list.innerHTML = '<div class="empty-state">No sound files loaded.</div>';
      }
      return;
    }

    const existing = list.querySelectorAll(".asset-item");
    if (existing.length === state.assets.length) return;

    list.innerHTML = "";
    state.assets.forEach((asset) => {
      const item = document.createElement("div");
      item.className = `asset-item${asset.id === state.selectedAssetId ? " selected" : ""}`;
      item.draggable = true;
      item.dataset.assetId = asset.id;

      const wave = document.createElement("canvas");
      wave.className = "asset-wave";

      const info = document.createElement("div");
      info.className = "asset-info";

      const name = document.createElement("div");
      name.className = "asset-name";
      name.title = asset.name || "Sound effect";
      name.textContent = asset.name || "Sound effect";

      const meta = document.createElement("div");
      meta.className = "asset-meta";
      meta.textContent = `${formatTime(asset.duration || 0)} · ${asset.kind || "audio"}`;

      info.append(name, meta);

      const add = document.createElement("button");
      add.type = "button";
      add.className = "asset-add";
      add.textContent = "+";
      add.title = `Add to Track ${state.selectedTrack + 1} at the playhead`;
      add.addEventListener("click", (event) => {
        event.stopPropagation();
        addClipFromAsset(asset.id, state.selectedTrack, state.playhead);
      });

      item.append(wave, info, add);

      item.addEventListener("click", () => {
        state.selectedAssetId = asset.id;
        renderAssets();
      });
      item.addEventListener("dragstart", (event) => {
        state.dragAssetId = asset.id;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", asset.id);
      });
      item.addEventListener("dragend", () => {
        state.dragAssetId = null;
      });

      list.appendChild(item);
      requestAnimationFrame(() => {
        try {
          if (asset.peaks) drawMiniWave(wave, asset.peaks);
        } catch (error) {
          console.warn("Could not draw asset waveform", error);
        }
      });
    });

    if (ui.assetCount) ui.assetCount.textContent = String(state.assets.length);
  }

  function verifyClipWasDrawn(clipId) {
    if (!clipId) return;
    requestAnimationFrame(() => {
      const clip = state.clips.find((item) => item.id === clipId);
      if (!clip) return;
      if (!document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clipId)}"]`)) {
        renderTimeline();
      }
    });
  }

  const previousRenderAssets = renderAssets;
  renderAssets = function assetVisibilityRenderAssets() {
    previousRenderAssets();
    ensureVisibleAssetItems();
  };

  const previousAddClipFromAsset = addClipFromAsset;
  addClipFromAsset = function assetVisibilityAddClipFromAsset(assetId, track, start) {
    const beforeSelected = state.selectedClipId;
    previousAddClipFromAsset(assetId, track, start);
    ensureVisibleAssetItems();
    const clipId = state.selectedClipId || beforeSelected;
    verifyClipWasDrawn(clipId);
  };

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function assetVisibilityRenderTimeline() {
    previousRenderTimeline();
    ensureVisibleAssetItems();
  };

  installStyles();
  setVersion();
  ensureVisibleAssetItems();
  renderTimeline();
  setStatus("Ready — sound library display fixed");
})();