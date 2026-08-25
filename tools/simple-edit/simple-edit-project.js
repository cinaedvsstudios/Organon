"use strict";

(function installOrgavoxProjectTools() {
  const STYLE_ID = "orgavox-project-style";
  const MODAL_ID = "projectModal";
  const INPUT_ID = "projectFileInput";
  let busy = false;
  const projectMeta = { name: "Untitled Project", savedAt: null };

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .topbar .brand{display:none!important}
      body.simple-edit-phase1 .orgavox-brand-actions{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;margin-top:0!important;flex:0 0 auto!important;min-width:0!important}
      body.simple-edit-phase1 .orgavox-brand-actions .tool-button{min-height:36px!important;padding:8px 12px!important;font-size:.62rem!important;white-space:nowrap!important}
      .orgavox-open-save-row{display:contents!important}
      .orgavox-project-button{width:auto!important;justify-content:center!important;border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important;box-shadow:0 0 0 1px rgba(178,109,255,.24),0 0 14px rgba(130,78,220,.22)!important}
      .orgavox-sidebar-brand{display:flex;align-items:center;gap:10px;min-width:0}
      .orgavox-sidebar-mark{display:grid;place-items:center;width:39px;height:39px;flex:0 0 39px;border:1px solid rgba(224,163,96,.92);border-radius:11px;background:rgba(0,0,0,.26);color:#f8d792;font:900 1.32rem Georgia,serif;box-shadow:0 0 0 1px rgba(224,163,96,.18),inset 0 0 16px rgba(224,163,96,.08)}
      .orgavox-sidebar-title{min-width:0;display:grid;gap:1px;line-height:1}
      .orgavox-sidebar-title strong{display:flex;align-items:baseline;gap:6px;color:#e0a360;font:800 1.08rem var(--font-headers);letter-spacing:.04em;white-space:nowrap}
      .orgavox-sidebar-version{color:#63b8ff!important;font:800 .67rem var(--font-mono)!important;letter-spacing:.08em!important;text-transform:none!important}
      .orgavox-sidebar-title span:not(.orgavox-sidebar-version){color:#75b2de;font:800 .57rem var(--font-body);letter-spacing:.11em;text-transform:uppercase;white-space:nowrap}
      .orgavox-project-info-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex:0 0 auto;margin:0 8px 8px 0;padding:8px 14px;border:1px solid rgba(96,58,22,.78);border-radius:10px;background:linear-gradient(180deg,#e5b65d,#c99134);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 4px 14px rgba(0,0,0,.22)}
      .orgavox-project-info-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#17100a;font:900 .82rem var(--font-body);letter-spacing:.025em;text-transform:uppercase}
      .orgavox-project-info-meta{flex:0 0 auto;color:#5a341d;font:900 .7rem var(--font-mono);letter-spacing:.035em;white-space:nowrap}
      .orgavox-project-modal{position:fixed;inset:0;z-index:97;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-project-modal[hidden]{display:none}
      .orgavox-project-dialog{width:min(720px,calc(100vw - 42px));max-height:min(700px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-project-summary{margin-top:12px;padding:12px;border-radius:14px;border:1px solid rgba(224,163,96,.32);background:rgba(224,163,96,.08);color:rgba(245,240,219,.78);font-size:.72rem;line-height:1.45}
      .orgavox-project-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
      .orgavox-project-card{display:grid;gap:9px;padding:14px;border:1px solid rgba(137,107,73,.58);border-radius:16px;background:rgba(0,0,0,.2)}
      .orgavox-project-card h4{margin:0;color:#f8d792;font:800 .78rem var(--font-body);text-transform:uppercase;letter-spacing:.045em}
      .orgavox-project-card p{margin:0;color:rgba(245,240,219,.62);font-size:.69rem;line-height:1.45}
      .orgavox-project-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      @media(max-width:760px){.orgavox-project-grid{grid-template-columns:1fr}.orgavox-project-info-bar{align-items:flex-start;flex-direction:column;gap:3px}.orgavox-project-info-meta{white-space:normal}.orgavox-sidebar-title strong{font-size:.96rem}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    if (ui.projectBtn) return ui.projectBtn;
    const button = document.createElement("button");
    button.id = "projectBtn";
    button.type = "button";
    button.className = "tool-button orgavox-project-button";
    button.textContent = "📁 Project";
    button.title = "Save or load an ORGAVOX project";
    button.addEventListener("click", openModal);
    ui.projectBtn = button;
    placeButton();
    return button;
  }

  function chooseActionsContainer() {
    const all = [...document.querySelectorAll(".orgavox-brand-actions")];
    let actions = all.find((node) => node.contains(ui.importBtn) || node.contains(ui.exportBtn) || node.contains(ui.projectBtn)) || all[0];
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "orgavox-brand-actions";
    }
    all.filter((node) => node !== actions && !node.children.length).forEach((node) => node.remove());
    const topbar = document.querySelector(".topbar");
    const deck = document.querySelector(".phase1-top-effects");
    if (topbar && actions.parentElement !== topbar) topbar.insertBefore(actions, deck || topbar.firstChild);
    return actions;
  }

  function placeButton() {
    const button = ui.projectBtn || ensureButton();
    const actions = chooseActionsContainer();
    if (!actions || !button) return;
    const legacyRow = actions.querySelector(".orgavox-open-save-row");
    if (legacyRow) {
      [...legacyRow.children].forEach((child) => actions.insertBefore(child, legacyRow));
      legacyRow.remove();
    }
    [ui.importBtn, ui.exportBtn, button].filter(Boolean).forEach((item) => {
      if (item.parentElement !== actions) actions.appendChild(item);
    });
    button.textContent = "📁 Project";
    button.disabled = busy;
  }

  function ensureSidebarBrand() {
    const heading = document.querySelector(".library-panel .panel-heading");
    if (!heading) return null;
    let count = heading.querySelector("#assetCount");
    let brand = heading.querySelector(".orgavox-sidebar-brand");
    if (!brand) {
      brand = document.createElement("div");
      brand.className = "orgavox-sidebar-brand";
    }
    brand.innerHTML = `
      <div class="orgavox-sidebar-mark">Φ</div>
      <div class="orgavox-sidebar-title"><strong>ORGAVOX <span class="orgavox-sidebar-version">${window.ORGAVOX_VERSION || "v0.43"}</span></strong><span>Browser audio workstation</span></div>
    `;
    [...heading.children].forEach((child) => {
      if (child !== brand && child !== count) child.remove();
    });
    if (brand.parentElement !== heading) heading.prepend(brand);
    if (!count) {
      count = document.createElement("span");
      count.className = "count-badge";
      count.id = "assetCount";
      count.textContent = String(state.assets?.length || 0);
      heading.appendChild(count);
      if (typeof ui !== "undefined") ui.assetCount = count;
    } else if (count.parentElement !== heading) heading.appendChild(count);
    return brand;
  }

  function ensureProjectInfoBar() {
    let bar = document.getElementById("orgavoxProjectInfoBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "orgavoxProjectInfoBar";
      bar.className = "orgavox-project-info-bar";
      bar.innerHTML = `<span class="orgavox-project-info-name" id="orgavoxProjectInfoName">Untitled Project</span><span class="orgavox-project-info-meta" id="orgavoxProjectInfoMeta">Not saved yet</span>`;
    }
    const shell = document.querySelector(".timeline-shell");
    const panel = document.querySelector(".timeline-panel");
    if (panel && shell && bar.parentElement !== panel) panel.insertBefore(bar, shell);
    return bar;
  }

  function formatSavedAt(value) {
    if (!value) return "Not saved yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not saved yet";
    const day = date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Saved ${day} · ${time}`;
  }

  function updateProjectInfoBar() {
    ensureProjectInfoBar();
    ensureSidebarBrand();
    const name = document.getElementById("orgavoxProjectInfoName");
    const meta = document.getElementById("orgavoxProjectInfoMeta");
    if (name) name.textContent = projectMeta.name || "Untitled Project";
    if (meta) meta.textContent = formatSavedAt(projectMeta.savedAt);
  }

  function setProjectInfo(name, savedAt) {
    projectMeta.name = name || "Untitled Project";
    projectMeta.savedAt = savedAt || null;
    updateProjectInfoBar();
  }

  function ensureLoadInput() {
    let input = document.getElementById(INPUT_ID);
    if (input) return input;
    input = document.createElement("input");
    input.id = INPUT_ID;
    input.type = "file";
    input.hidden = true;
    input.accept = ".orgavox,.orgavox.json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) await loadProjectFile(file);
    });
    document.body.appendChild(input);
    return input;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-project-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-project-dialog" role="dialog" aria-modal="true" aria-labelledby="projectTitle">
        <div class="popover-head"><div><span class="eyebrow">Project file</span><h3 id="projectTitle">Save / Load Project</h3></div><button class="icon-button" data-project-close type="button">×</button></div>
        <p class="export-note">Project files save the timeline, clip edits and embedded decoded audio so the session can be opened again later.</p>
        <label class="field"><span>Project name</span><input data-project-name type="text" value="orgavox-project" autocomplete="off"></label>
        <div class="orgavox-project-summary" data-project-summary></div>
        <div class="orgavox-project-grid">
          <div class="orgavox-project-card"><h4>Save project</h4><p>Creates an .orgavox.json file with source audio embedded as WAV data plus all clip positions and effects.</p><button class="tool-button primary" data-project-save type="button">Save Project</button></div>
          <div class="orgavox-project-card"><h4>Load project</h4><p>Opens an .orgavox.json file and replaces the current ORGAVOX session with the saved arrangement.</p><button class="tool-button" data-project-load type="button">Load Project</button></div>
        </div>
        <div class="orgavox-project-actions"><button class="tool-button" data-project-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-project-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-project-save]")?.addEventListener("click", saveProjectFile);
    modal.querySelector("[data-project-load]")?.addEventListener("click", () => ensureLoadInput().click());
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function projectNameInput() { return ensureModal().querySelector("[data-project-name]"); }

  function updateSummary() {
    const summary = ensureModal().querySelector("[data-project-summary]");
    if (!summary) return;
    const duration = typeof projectDuration === "function" ? formatTime(projectDuration()) : "00:00.000";
    summary.textContent = `${state.assets.length} source file${state.assets.length === 1 ? "" : "s"} · ${state.clips.length} clip${state.clips.length === 1 ? "" : "s"} · ${duration} timeline length`;
  }

  function openModal() {
    ensureModal().hidden = false;
    const input = projectNameInput();
    if (input && (!input.value.trim() || input.value === "orgavox-project")) input.value = projectMeta.name !== "Untitled Project" ? projectMeta.name : suggestedProjectName();
    updateSummary();
  }

  function closeModal() { ensureModal().hidden = true; }

  function setBusy(nextBusy, message) {
    busy = Boolean(nextBusy);
    ensureButton().disabled = busy;
    ensureModal().querySelectorAll("button, input").forEach((element) => { element.disabled = busy; });
    if (message) setStatus(message);
    placeButton();
  }

  function suggestedProjectName() {
    const first = state.clips[0]?.name || state.assets[0]?.name || "orgavox-project";
    return safeFilename(first).replace(/-clip$|-mix$/i, "") || "orgavox-project";
  }

  async function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      const slice = bytes.subarray(index, index + chunk);
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(String(base64 || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  async function serialiseAsset(asset) {
    if (!asset?.buffer) return null;
    const wavBlob = audioBufferToWav(asset.buffer);
    const wavBase64 = await arrayBufferToBase64(await wavBlob.arrayBuffer());
    return { id: asset.id, name: asset.name, kind: asset.kind || "WAV", duration: asset.buffer.duration, wavBase64 };
  }

  function serialiseClip(clip) {
    const keys = ["id", "assetId", "name", "track", "start", "sourceStart", "sourceEnd", "stretchDuration", "volume", "echo", "gate", "fadeIn", "fadeOut", "volumeKeyframes", "reverseAudio", "transposeSemitones", "eqSettings", "driveSettings", "dynamicsSettings", "stereoSettings", "lofiSettings"];
    const output = {};
    keys.forEach((key) => { if (clip[key] !== undefined) output[key] = clip[key]; });
    return output;
  }

  async function buildProjectData() {
    const assets = [];
    for (const asset of state.assets) {
      const packed = await serialiseAsset(asset);
      if (packed) assets.push(packed);
    }
    const savedAt = new Date().toISOString();
    return { format: "ORGAVOX_PROJECT", version: window.ORGAVOX_VERSION || "v0.43", savedAt, name: projectNameInput()?.value?.trim() || suggestedProjectName(), pixelsPerSecond: state.pixelsPerSecond, playhead: state.playhead, selectedTrack: state.selectedTrack, assets, clips: state.clips.map(serialiseClip) };
  }

  async function saveProjectFile() {
    if (busy) return;
    stopPlayback();
    setBusy(true, "Saving ORGAVOX project…");
    try {
      const project = await buildProjectData();
      const filename = `${safeFilename(project.name || "orgavox-project")}.orgavox.json`;
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      downloadBlob(blob, filename);
      setProjectInfo(project.name, project.savedAt);
      showToast(`${filename} saved.`);
      setStatus("Ready");
      closeModal();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The project could not be saved.");
      setStatus("Project save failed");
    } finally {
      setBusy(false);
    }
  }

  function safeClipFromProject(raw, assetIds) {
    const assetId = String(raw.assetId || "");
    if (!assetIds.has(assetId)) return null;
    return {
      id: raw.id || makeId("clip"), assetId, name: raw.name || "Project clip", track: Math.max(0, Math.min(9, Number(raw.track) || 0)), start: Math.max(0, Number(raw.start) || 0), sourceStart: Math.max(0, Number(raw.sourceStart) || 0), sourceEnd: Math.max(0.01, Number(raw.sourceEnd) || 0.01), stretchDuration: raw.stretchDuration == null ? null : Math.max(0.01, Number(raw.stretchDuration) || 0.01), volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 100, echo: Number.isFinite(Number(raw.echo)) ? Number(raw.echo) : 0, gate: raw.gate || null, fadeIn: Number(raw.fadeIn) || 0, fadeOut: Number(raw.fadeOut) || 0, volumeKeyframes: Array.isArray(raw.volumeKeyframes) ? raw.volumeKeyframes : [], reverseAudio: Boolean(raw.reverseAudio), transposeSemitones: Number(raw.transposeSemitones) || 0, eqSettings: raw.eqSettings || null, driveSettings: raw.driveSettings || null, dynamicsSettings: raw.dynamicsSettings || null, stereoSettings: raw.stereoSettings || null, lofiSettings: raw.lofiSettings || null, bufferOverride: null, cacheVersion: 0
    };
  }

  async function loadProjectFile(file) {
    if (busy) return;
    if (!audioContext) return showToast("This browser does not provide the Web Audio engine required by ORGAVOX.");
    stopPlayback();
    setBusy(true, "Loading ORGAVOX project…");
    try {
      const project = JSON.parse(await file.text());
      if (project?.format !== "ORGAVOX_PROJECT" || !Array.isArray(project.assets)) throw new Error("This is not an ORGAVOX project file.");
      const assets = [];
      for (const saved of project.assets) {
        if (!saved?.wavBase64) continue;
        const buffer = await audioContext.decodeAudioData(base64ToArrayBuffer(saved.wavBase64).slice(0));
        assets.push({ id: saved.id || makeId("asset"), file: null, name: saved.name || "project-audio.wav", kind: saved.kind || "PROJECT WAV", buffer, duration: buffer.duration, peaks: makePeaks(buffer) });
      }
      const assetIds = new Set(assets.map((asset) => asset.id));
      const clips = (Array.isArray(project.clips) ? project.clips : []).map((clip) => safeClipFromProject(clip, assetIds)).filter(Boolean);
      state.assets = assets;
      state.clips = clips;
      state.selectedAssetId = assets[0]?.id || null;
      state.selectedClipId = clips[0]?.id || null;
      state.selectedTrack = Math.max(0, Math.min(9, Number(project.selectedTrack) || clips[0]?.track || 0));
      state.playhead = Math.max(0, Number(project.playhead) || 0);
      state.pixelsPerSecond = Math.max(25, Math.min(500, Number(project.pixelsPerSecond) || state.pixelsPerSecond || 80));
      state.renderCache.clear();
      if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond;
      if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`;
      renderAssets();
      syncSelectedControls();
      renderTimeline();
      setProjectInfo(project.name || file.name.replace(/\.[^.]+$/, ""), project.savedAt || null);
      const input = projectNameInput();
      if (input) input.value = project.name || suggestedProjectName();
      updateSummary();
      showToast(`${project.name || file.name} loaded.`);
      setStatus("Ready");
      closeModal();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The project could not be loaded.");
      setStatus("Project load failed");
    } finally {
      setBusy(false);
    }
  }

  function patchRender() {
    if (window.__orgavoxProjectRenderPatched) return;
    window.__orgavoxProjectRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxProjectRenderTimeline() {
      previousRenderTimeline();
      placeButton();
      ensureSidebarBrand();
      updateProjectInfoBar();
      updateSummary();
    };
  }

  window.orgavoxPlaceProjectButton = placeButton;
  window.orgavoxUpdateProjectInfoBar = updateProjectInfoBar;
  window.orgavoxEnsureSidebarBrand = ensureSidebarBrand;
  installStyles();
  ensureButton();
  ensureModal();
  ensureLoadInput();
  ensureSidebarBrand();
  ensureProjectInfoBar();
  patchRender();
  placeButton();
  updateProjectInfoBar();
  setTimeout(() => { placeButton(); ensureSidebarBrand(); updateProjectInfoBar(); }, 150);
})();