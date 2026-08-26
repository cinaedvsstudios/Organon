"use strict";

(function installOrgavoxBuildSix() {
  const STYLE_ID = "orgavox-build6-style";
  const MODAL_ID = "orgavoxStretchModal";
  const NOTES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  let stretchClickGuard = false;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-stretch-modal{position:fixed;inset:0;z-index:3900;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-stretch-modal[hidden]{display:none}
      .orgavox-stretch-dialog{width:min(650px,calc(100vw - 42px));max-height:min(700px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-stretch-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
      .orgavox-stretch-card{display:grid;gap:9px;padding:14px;border:1px solid rgba(137,107,73,.58);border-radius:16px;background:rgba(0,0,0,.2)}
      .orgavox-stretch-card h4{margin:0;color:#f8d792;font:800 .78rem var(--font-body);text-transform:uppercase;letter-spacing:.045em}
      .orgavox-stretch-card p{margin:0;color:rgba(245,240,219,.62);font-size:.69rem;line-height:1.45}
      .orgavox-stretch-field{display:grid;gap:5px}
      .orgavox-stretch-field span{color:rgba(245,240,219,.62);font:800 .58rem var(--font-mono);text-transform:uppercase;letter-spacing:.06em}
      .orgavox-stretch-field input{min-height:34px;border:1px solid rgba(137,107,73,.58);border-radius:10px;background:rgba(0,0,0,.26);color:#f5f0db;padding:6px 9px;font:800 .78rem var(--font-mono)}
      .orgavox-stretch-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      .orgavox-stretch-button-active{border-color:rgba(248,215,146,.9)!important;background:linear-gradient(180deg,rgba(129,85,31,.92),rgba(55,34,13,.96))!important;color:#fff0bd!important;box-shadow:0 0 0 1px rgba(248,215,146,.24),0 0 16px rgba(248,215,146,.2)!important}
      .audio-clip{position:absolute!important}
      .orgavox-clip-meta-line{position:absolute;left:6px;bottom:4px;z-index:4;max-width:calc(100% - 12px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:7px;background:rgba(0,0,0,.42);color:#dff5ff;font:900 .51rem var(--font-mono);letter-spacing:.035em;pointer-events:none}
      .orgavox-track-meta-line{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#75b2de;font:900 .48rem var(--font-mono);letter-spacing:.035em;text-transform:uppercase}
      .orgavox-track-mini .orgavox-track-meta-line{margin-left:2px}
      .clip-effect-badges span.orgavox-meta-effect-badge{background:rgba(117,178,222,.2);color:#dff5ff}
      @media(max-width:760px){.orgavox-stretch-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function modal() {
    let node = document.getElementById(MODAL_ID);
    if (node) return node;
    node = document.createElement("div");
    node.id = MODAL_ID;
    node.className = "orgavox-stretch-modal";
    node.hidden = true;
    node.innerHTML = `
      <section class="orgavox-stretch-dialog" role="dialog" aria-modal="true" aria-labelledby="stretchModalTitle">
        <div class="popover-head"><div><span class="eyebrow">Effect menu</span><h3 id="stretchModalTitle">Stretch settings</h3></div><button class="icon-button" data-stretch-close type="button">×</button></div>
        <p class="export-note" data-stretch-summary>Select a clip to stretch it by duration or percentage. Toggle stretch handles when you want to drag the clip edges manually.</p>
        <div class="orgavox-stretch-grid">
          <div class="orgavox-stretch-card">
            <h4>Selected clip</h4>
            <label class="orgavox-stretch-field"><span>Duration in seconds</span><input data-stretch-duration type="number" min="0.05" step="0.01"></label>
            <label class="orgavox-stretch-field"><span>Percent</span><input data-stretch-percent type="number" min="5" max="800" step="1" value="100"></label>
            <button class="tool-button primary" data-stretch-apply type="button">Apply to clip</button>
            <button class="tool-button" data-stretch-reset type="button">Reset clip stretch</button>
          </div>
          <div class="orgavox-stretch-card">
            <h4>Track / handles</h4>
            <p>Track stretch applies the percent setting to every clip on the selected track. Stretch handles switch edge dragging into time-stretch mode.</p>
            <button class="tool-button" data-stretch-track type="button">Apply percent to track</button>
            <button class="tool-button" data-stretch-handles type="button">Toggle stretch handles</button>
          </div>
        </div>
        <div class="orgavox-stretch-actions"><button class="tool-button" data-stretch-close type="button">Close</button></div>
      </section>
    `;
    document.body.appendChild(node);
    node.querySelectorAll("[data-stretch-close]").forEach((button) => button.addEventListener("click", closeStretch));
    node.querySelector("[data-stretch-apply]")?.addEventListener("click", applySelectedStretch);
    node.querySelector("[data-stretch-reset]")?.addEventListener("click", resetSelectedStretch);
    node.querySelector("[data-stretch-track]")?.addEventListener("click", applyTrackStretch);
    node.querySelector("[data-stretch-handles]")?.addEventListener("click", toggleStretchHandles);
    node.addEventListener("click", (event) => { if (event.target === node) closeStretch(); });
    return node;
  }

  function selected() {
    return typeof selectedClip === "function" ? selectedClip() : state.clips.find((clip) => clip.id === state.selectedClipId) || null;
  }

  function currentTrackIndex() {
    const clip = selected();
    return Math.max(0, Math.min(9, Number(clip?.track ?? state.selectedTrack) || 0));
  }

  function baseDuration(clip) {
    return Math.max(0.01, bufferDuration(clip));
  }

  function stretchPercentFromClip(clip) {
    if (!clip) return 100;
    return Math.round(stretchedAudioDuration(clip) / baseDuration(clip) * 100);
  }

  function updateStretchModal() {
    const node = modal();
    const clip = selected();
    const duration = node.querySelector("[data-stretch-duration]");
    const percent = node.querySelector("[data-stretch-percent]");
    const summary = node.querySelector("[data-stretch-summary]");
    const handles = node.querySelector("[data-stretch-handles]");
    if (clip) {
      if (duration && document.activeElement !== duration) duration.value = stretchedAudioDuration(clip).toFixed(2);
      if (percent && document.activeElement !== percent) percent.value = String(stretchPercentFromClip(clip));
      if (summary) summary.textContent = `${clip.name} · source ${baseDuration(clip).toFixed(2)}s · output ${stretchedAudioDuration(clip).toFixed(2)}s`;
    } else {
      if (duration) duration.value = "";
      if (percent && !percent.value) percent.value = "100";
      if (summary) summary.textContent = "Select a clip to stretch it by duration or percentage. Toggle stretch handles when you want to drag the clip edges manually.";
    }
    if (handles) {
      handles.classList.toggle("orgavox-stretch-button-active", Boolean(state.stretchMode));
      handles.textContent = state.stretchMode ? "Stretch handles on" : "Stretch handles off";
    }
    if (ui.stretchBtn) {
      ui.stretchBtn.classList.toggle("orgavox-stretch-button-active", Boolean(state.stretchMode));
      ui.stretchBtn.textContent = state.stretchMode ? "↔ Stretch on" : "↔ Stretch";
      ui.stretchBtn.title = "Open stretch settings";
      ui.stretchBtn.setAttribute("aria-pressed", String(Boolean(state.stretchMode)));
    }
  }

  function openStretch() {
    modal().hidden = false;
    updateStretchModal();
  }

  function closeStretch() {
    modal().hidden = true;
  }

  function percentValue() {
    const raw = Number(modal().querySelector("[data-stretch-percent]")?.value || 100);
    return Math.max(5, Math.min(800, raw || 100)) / 100;
  }

  function applySelectedStretch() {
    const clip = selected();
    if (!clip) return showToast("Select a clip before stretching.");
    const durationInput = modal().querySelector("[data-stretch-duration]");
    const duration = Number(durationInput?.value);
    stopPlayback();
    clip.stretchDuration = Number.isFinite(duration) && duration > 0 ? Math.max(0.05, duration) : Math.max(0.05, baseDuration(clip) * percentValue());
    invalidateClip(clip);
    renderTimeline();
    updateStretchModal();
    showToast("Clip stretch updated.");
    window.orgavoxRecordHistory?.();
  }

  function resetSelectedStretch() {
    const clip = selected();
    if (!clip) return showToast("Select a clip first.");
    stopPlayback();
    clip.stretchDuration = null;
    invalidateClip(clip);
    renderTimeline();
    updateStretchModal();
    showToast("Clip stretch reset.");
    window.orgavoxRecordHistory?.();
  }

  function applyTrackStretch() {
    const track = currentTrackIndex();
    const clips = state.clips.filter((clip) => clip.track === track);
    if (!clips.length) return showToast("That track has no clips.");
    stopPlayback();
    const factor = percentValue();
    clips.forEach((clip) => {
      clip.stretchDuration = Math.max(0.05, baseDuration(clip) * factor);
      invalidateClip(clip);
    });
    renderTimeline();
    updateStretchModal();
    showToast(`Track ${track + 1} stretched to ${Math.round(factor * 100)}%.`);
    window.orgavoxRecordHistory?.();
  }

  function toggleStretchHandles() {
    state.stretchMode = !state.stretchMode;
    updateStretchModal();
    showToast(state.stretchMode ? "Stretch handles on." : "Stretch handles off.");
    window.orgavoxRecordHistory?.();
  }

  function patchStretchButton() {
    if (!ui.stretchBtn || ui.stretchBtn.dataset.orgavoxBuild6Stretch === "true") return;
    ui.stretchBtn.dataset.orgavoxBuild6Stretch = "true";
    ui.stretchBtn.addEventListener("click", (event) => {
      if (stretchClickGuard) return;
      stretchClickGuard = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      openStretch();
      setTimeout(() => { stretchClickGuard = false; }, 0);
    }, true);
  }

  function effectNames(clip) {
    const fx = [];
    if (!clip) return fx;
    if (clip.volume !== 100) fx.push(`VOL ${Math.round(clip.volume)}%`);
    if (clip.echo > 0) fx.push("ECHO");
    if (clip.gate?.enabled) fx.push("GATE");
    if (clip.fadeIn > 0) fx.push("FADE IN");
    if (clip.fadeOut > 0) fx.push("FADE OUT");
    if (clip.reverseAudio) fx.push("REV");
    if (Number(clip.transposeSemitones)) fx.push(`TRANS ${Number(clip.transposeSemitones) > 0 ? "+" : ""}${Number(clip.transposeSemitones)}`);
    if (clip.eqSettings) fx.push("EQ");
    if (clip.driveSettings) fx.push("DRIVE");
    if (clip.dynamicsSettings) fx.push("DYN");
    if (clip.stereoSettings) fx.push("STEREO");
    if (clip.lofiSettings) fx.push("LOFI");
    if (Math.abs(stretchedAudioDuration(clip) - baseDuration(clip)) > 0.005) fx.push(`STR ${stretchPercentFromClip(clip)}%`);
    return fx;
  }

  function assetFor(clip) {
    return state.assets.find((asset) => asset.id === clip?.assetId) || null;
  }

  function estimateMetaForAsset(asset) {
    if (!asset?.buffer) return { key: "--", bpm: "--" };
    if (asset.orgavoxMeta) return asset.orgavoxMeta;
    const buffer = asset.buffer;
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const totalSeconds = Math.min(buffer.duration, 24);
    const startOffset = Math.min(Math.max(0, buffer.duration - totalSeconds), Math.max(0, buffer.duration * 0.1));
    const startSample = Math.floor(startOffset * sampleRate);
    const endSample = Math.min(channel.length, startSample + Math.floor(totalSeconds * sampleRate));
    const hop = Math.max(1, Math.floor(sampleRate * 0.02));
    const env = [];
    for (let pos = startSample; pos < endSample; pos += hop) {
      let sum = 0;
      const end = Math.min(endSample, pos + hop);
      for (let i = pos; i < end; i += 1) sum += Math.abs(channel[i] || 0);
      env.push(sum / Math.max(1, end - pos));
    }
    let bpm = "--";
    if (env.length > 16) {
      const avg = env.reduce((a, b) => a + b, 0) / env.length;
      const peaks = [];
      for (let i = 1; i < env.length - 1; i += 1) {
        if (env[i] > avg * 1.28 && env[i] >= env[i - 1] && env[i] >= env[i + 1]) peaks.push(i * 0.02);
      }
      const buckets = new Map();
      for (let i = 1; i < peaks.length; i += 1) {
        const gap = peaks[i] - peaks[i - 1];
        if (gap < 0.25 || gap > 2.1) continue;
        let candidate = 60 / gap;
        while (candidate < 70) candidate *= 2;
        while (candidate > 180) candidate /= 2;
        const rounded = Math.round(candidate);
        buckets.set(rounded, (buckets.get(rounded) || 0) + 1);
      }
      const best = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 2) bpm = `~${best[0]}`;
    }

    const pitchScores = new Array(12).fill(0);
    const analysisLength = Math.min(endSample - startSample, Math.floor(sampleRate * 8));
    const step = Math.max(1, Math.floor(sampleRate / 9000));
    for (let note = 0; note < 12; note += 1) {
      for (let octave = 2; octave <= 5; octave += 1) {
        const midi = note + 12 * (octave + 1);
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        let sin = 0;
        let cos = 0;
        for (let offset = 0; offset < analysisLength; offset += step) {
          const sample = channel[startSample + offset] || 0;
          const phase = 2 * Math.PI * freq * (offset / sampleRate);
          sin += sample * Math.sin(phase);
          cos += sample * Math.cos(phase);
        }
        pitchScores[note] += Math.sqrt(sin * sin + cos * cos);
      }
    }
    const bestNote = pitchScores.indexOf(Math.max(...pitchScores));
    const key = Number.isFinite(bestNote) && pitchScores[bestNote] > 0 ? `~${NOTES[bestNote]}` : "--";
    asset.orgavoxMeta = { key, bpm };
    return asset.orgavoxMeta;
  }

  function clipMeta(clip) {
    const meta = estimateMetaForAsset(assetFor(clip));
    const fx = effectNames(clip);
    return {
      key: meta.key || "--",
      bpm: meta.bpm || "--",
      fx,
      label: `KEY ${meta.key || "--"} · BPM ${meta.bpm || "--"} · FX ${fx.length ? fx.join(", ") : "NONE"}`
    };
  }

  function addClipMetaLines() {
    state.clips.forEach((clip) => {
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      if (!element) return;
      const meta = clipMeta(clip);
      let line = element.querySelector(".orgavox-clip-meta-line");
      if (!line) {
        line = document.createElement("div");
        line.className = "orgavox-clip-meta-line";
        element.appendChild(line);
      }
      line.textContent = meta.label;
      const badges = element.querySelector(".clip-effect-badges");
      if (badges && meta.fx.length) {
        meta.fx.forEach((fx) => {
          if ([...badges.querySelectorAll("span")].some((span) => span.textContent === fx)) return;
          const badge = document.createElement("span");
          badge.className = "orgavox-meta-effect-badge";
          badge.textContent = fx;
          badges.appendChild(badge);
        });
      }
    });
  }

  function addTrackMetaLines() {
    const labels = [...document.querySelectorAll(".track-label")];
    labels.forEach((label) => {
      const index = Number(label.dataset.trackLabel);
      if (!Number.isFinite(index)) return;
      const mini = label.querySelector(".orgavox-track-mini") || label;
      const selectedOnTrack = state.clips.find((clip) => clip.track === index && clip.id === state.selectedClipId);
      const firstOnTrack = state.clips.find((clip) => clip.track === index);
      const clip = selectedOnTrack || firstOnTrack;
      let line = mini.querySelector(".orgavox-track-meta-line");
      if (!line) {
        line = document.createElement("span");
        line.className = "orgavox-track-meta-line";
        mini.appendChild(line);
      }
      if (!clip) {
        line.textContent = "KEY -- BPM -- FX NONE";
        return;
      }
      const meta = clipMeta(clip);
      line.textContent = `KEY ${meta.key} BPM ${meta.bpm} FX ${meta.fx.length ? meta.fx.slice(0, 3).join("/") : "NONE"}`;
      line.title = meta.label;
    });
  }

  function refreshMeta() {
    patchStretchButton();
    updateStretchModal();
    addClipMetaLines();
    addTrackMetaLines();
    installFullProjectCapture();
  }

  function patchRender() {
    if (window.__orgavoxBuild6RenderPatched) return;
    window.__orgavoxBuild6RenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxBuild6RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      refreshMeta();
      return result;
    };

    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxBuild6SyncSelectedControls() {
      const result = previousSyncSelectedControls.apply(this, arguments);
      updateStretchModal();
      addTrackMetaLines();
      return result;
    };
  }

  async function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(String(base64 || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  async function packAsset(asset) {
    if (!asset?.buffer) return null;
    const blob = audioBufferToWav(asset.buffer);
    return {
      id: asset.id,
      name: asset.name,
      kind: asset.kind || "WAV",
      duration: asset.buffer.duration,
      meta: asset.orgavoxMeta || null,
      wavBase64: await arrayBufferToBase64(await blob.arrayBuffer())
    };
  }

  function packClip(clip) {
    const keys = [
      "id", "assetId", "name", "track", "start", "sourceStart", "sourceEnd", "stretchDuration",
      "volume", "echo", "gate", "fadeIn", "fadeOut", "volumeKeyframes", "reverseAudio", "transposeSemitones",
      "eqSettings", "driveSettings", "dynamicsSettings", "stereoSettings", "lofiSettings"
    ];
    const output = {};
    keys.forEach((key) => { if (clip[key] !== undefined) output[key] = clip[key]; });
    output.meta = clip.orgavoxMeta || null;
    return output;
  }

  function packMarker(marker) {
    return {
      id: marker.id || makeId("marker"),
      time: Math.max(0, Number(marker.time) || 0),
      label: marker.label || "Marker",
      color: marker.color || "purple"
    };
  }

  async function buildFullProject() {
    const assets = [];
    for (const asset of state.assets) {
      const packed = await packAsset(asset);
      if (packed) assets.push(packed);
    }
    const projectName = document.querySelector("[data-project-name]")?.value?.trim()
      || document.getElementById("orgavoxProjectInfoName")?.textContent?.trim()
      || "orgavox-project";
    return {
      format: "ORGAVOX_PROJECT",
      build: "full-v0.49",
      version: window.ORGAVOX_VERSION || "v0.49",
      savedAt: new Date().toISOString(),
      name: projectName,
      pixelsPerSecond: state.pixelsPerSecond,
      playhead: state.playhead,
      selectedTrack: state.selectedTrack,
      selectedAssetId: state.selectedAssetId,
      selectedClipId: state.selectedClipId,
      globalVolume: Number(state.globalVolume ?? 100),
      trackSettings: Array.isArray(state.trackSettings) ? state.trackSettings : [],
      markers: Array.isArray(state.markers) ? state.markers.map(packMarker) : [],
      snap: {
        enabled: localStorage.getItem("orgavoxSnapEnabled") === "true",
        grid: Number(localStorage.getItem("orgavoxSnapGrid") || "1") || 1
      },
      assets,
      clips: state.clips.map(packClip)
    };
  }

  async function saveFullProject(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (!state.assets.length && !state.clips.length) return showToast("Nothing to save yet.");
    stopPlayback();
    setStatus("Saving full ORGAVOX project…");
    try {
      const project = await buildFullProject();
      const filename = `${safeFilename(project.name || "orgavox-project")}.orgavox.json`;
      downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), filename);
      window.orgavoxSetProjectInfo?.(project.name, project.savedAt);
      const name = document.getElementById("orgavoxProjectInfoName");
      const meta = document.getElementById("orgavoxProjectInfoMeta");
      if (name) name.textContent = project.name;
      if (meta) {
        const date = new Date(project.savedAt);
        meta.textContent = `Saved ${date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }
      showToast(`${filename} saved with markers, track settings and effects.`);
      setStatus("Ready");
      document.getElementById("projectModal").hidden = true;
    } catch (error) {
      console.error(error);
      showToast(error.message || "The full project could not be saved.");
      setStatus("Project save failed");
    }
  }

  function safeLoadedClip(raw, assetIds) {
    const assetId = String(raw.assetId || "");
    if (!assetIds.has(assetId)) return null;
    return {
      id: raw.id || makeId("clip"),
      assetId,
      name: raw.name || "Project clip",
      track: Math.max(0, Math.min(9, Number(raw.track) || 0)),
      start: Math.max(0, Number(raw.start) || 0),
      sourceStart: Math.max(0, Number(raw.sourceStart) || 0),
      sourceEnd: Math.max(0.01, Number(raw.sourceEnd) || 0.01),
      stretchDuration: raw.stretchDuration == null ? null : Math.max(0.01, Number(raw.stretchDuration) || 0.01),
      volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 100,
      echo: Number.isFinite(Number(raw.echo)) ? Number(raw.echo) : 0,
      gate: raw.gate || null,
      fadeIn: Number(raw.fadeIn) || 0,
      fadeOut: Number(raw.fadeOut) || 0,
      volumeKeyframes: Array.isArray(raw.volumeKeyframes) ? raw.volumeKeyframes : [],
      reverseAudio: Boolean(raw.reverseAudio),
      transposeSemitones: Number(raw.transposeSemitones) || 0,
      eqSettings: raw.eqSettings || null,
      driveSettings: raw.driveSettings || null,
      dynamicsSettings: raw.dynamicsSettings || null,
      stereoSettings: raw.stereoSettings || null,
      lofiSettings: raw.lofiSettings || null,
      orgavoxMeta: raw.meta || null,
      bufferOverride: null,
      cacheVersion: 0
    };
  }

  async function loadFullProject(file) {
    stopPlayback();
    setStatus("Loading full ORGAVOX project…");
    try {
      const project = JSON.parse(await file.text());
      if (project?.format !== "ORGAVOX_PROJECT" || !Array.isArray(project.assets)) throw new Error("This is not an ORGAVOX project file.");
      const assets = [];
      for (const saved of project.assets) {
        if (!saved?.wavBase64) continue;
        const buffer = await audioContext.decodeAudioData(base64ToArrayBuffer(saved.wavBase64).slice(0));
        const asset = { id: saved.id || makeId("asset"), file: null, name: saved.name || "project-audio.wav", kind: saved.kind || "PROJECT WAV", buffer, duration: buffer.duration, peaks: makePeaks(buffer) };
        if (saved.meta) asset.orgavoxMeta = saved.meta;
        assets.push(asset);
      }
      const assetIds = new Set(assets.map((asset) => asset.id));
      const clips = (Array.isArray(project.clips) ? project.clips : []).map((clip) => safeLoadedClip(clip, assetIds)).filter(Boolean);
      state.assets = assets;
      state.clips = clips;
      state.markers = Array.isArray(project.markers) ? project.markers.map(packMarker) : [];
      state.trackSettings = Array.isArray(project.trackSettings) ? project.trackSettings : [];
      state.globalVolume = Math.max(0, Math.min(200, Number(project.globalVolume ?? 100)));
      state.selectedAssetId = project.selectedAssetId && assetIds.has(project.selectedAssetId) ? project.selectedAssetId : assets[0]?.id || null;
      state.selectedClipId = clips.some((clip) => clip.id === project.selectedClipId) ? project.selectedClipId : clips[0]?.id || null;
      state.selectedTrack = Math.max(0, Math.min(9, Number(project.selectedTrack) || clips[0]?.track || 0));
      state.playhead = Math.max(0, Number(project.playhead) || 0);
      state.pixelsPerSecond = Math.max(25, Math.min(500, Number(project.pixelsPerSecond) || state.pixelsPerSecond || 80));
      if (project.snap) {
        localStorage.setItem("orgavoxSnapEnabled", String(Boolean(project.snap.enabled)));
        localStorage.setItem("orgavoxSnapGrid", String(Number(project.snap.grid) || 1));
      }
      state.renderCache.clear();
      if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond;
      if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`;
      if (ui.globalVolumeSlider) ui.globalVolumeSlider.value = state.globalVolume;
      if (ui.globalVolumeOut) ui.globalVolumeOut.textContent = `${Math.round(state.globalVolume)}%`;
      renderAssets();
      syncSelectedControls();
      renderTimeline();
      setPlayhead(state.playhead, true);
      window.orgavoxRefreshTrackTools?.();
      window.orgavoxRenderMarkers?.();
      window.orgavoxRefreshBuild6?.();
      const projectName = project.name || file.name.replace(/\.[^.]+$/, "");
      const name = document.getElementById("orgavoxProjectInfoName");
      const meta = document.getElementById("orgavoxProjectInfoMeta");
      if (name) name.textContent = projectName;
      if (meta) meta.textContent = project.savedAt ? `Saved ${new Date(project.savedAt).toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })} · ${new Date(project.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loaded project";
      const input = document.querySelector("[data-project-name]");
      if (input) input.value = projectName;
      showToast(`${projectName} loaded with markers, tracks and effects.`);
      setStatus("Ready");
      document.getElementById("projectModal").hidden = true;
      window.orgavoxRecordHistory?.();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The project could not be loaded.");
      setStatus("Project load failed");
    }
  }

  function fullProjectInput() {
    let input = document.getElementById("orgavoxFullProjectInput");
    if (input) return input;
    input = document.createElement("input");
    input.id = "orgavoxFullProjectInput";
    input.type = "file";
    input.hidden = true;
    input.accept = ".orgavox,.orgavox.json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) await loadFullProject(file);
    });
    document.body.appendChild(input);
    return input;
  }

  function installFullProjectCapture() {
    const modalNode = document.getElementById("projectModal");
    if (!modalNode || modalNode.dataset.orgavoxFullProject === "true") return;
    modalNode.dataset.orgavoxFullProject = "true";
    const save = modalNode.querySelector("[data-project-save]");
    const load = modalNode.querySelector("[data-project-load]");
    if (save) {
      save.textContent = "Save Full Project";
      save.title = "Save audio, timeline, markers, track settings, effects, snap and mixer data.";
      save.addEventListener("click", saveFullProject, true);
    }
    if (load) {
      load.textContent = "Load Full Project";
      load.title = "Load audio, timeline, markers, track settings, effects, snap and mixer data.";
      load.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        fullProjectInput().click();
      }, true);
    }
    modalNode.querySelectorAll(".orgavox-project-card p").forEach((p) => {
      if (/source audio embedded/i.test(p.textContent)) p.textContent = "Creates an .orgavox.json file with embedded audio, clips, markers, track colours/mixer data, effects and snap settings.";
      if (/replaces the current/i.test(p.textContent)) p.textContent = "Loads a full ORGAVOX project and restores tracks, markers, mixer settings and effects.";
    });
  }

  installStyles();
  modal();
  patchStretchButton();
  patchRender();
  refreshMeta();
  setTimeout(refreshMeta, 0);
  setTimeout(refreshMeta, 250);
  window.orgavoxRefreshBuild6 = refreshMeta;
})();