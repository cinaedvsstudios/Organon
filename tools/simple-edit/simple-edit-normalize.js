"use strict";

(function installSimpleEditNormalize() {
  const VERSION = "v0.21";
  const STYLE_ID = "simple-edit-normalize-style";
  const MODAL_ID = "normalizeModal";
  const DEFAULT_TARGET_DB = -16;
  const MIN_DB = -60;
  const MAX_DB = -1;
  const MAX_VOLUME = 200;
  const MIN_VOLUME = 0;
  const metrics = new Map();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const dbToLinear = (db) => Math.pow(10, Number(db) / 20);
  const linearToDb = (value) => value > 0.0000001 ? 20 * Math.log10(value) : -Infinity;
  const trackCount = () => Math.max(10, Array.isArray(ui.lanes) ? ui.lanes.length : 10);
  const clipsForTrack = (track) => state.clips.filter((clip) => Number(clip.track) === track);

  function setVersion() {
    document.title = `Organon — Simple Edit ${VERSION}`;
    const badge = document.querySelector(".phase1-version, .simple-edit-version");
    if (badge) badge.textContent = VERSION;
  }

  function formatDb(db) {
    if (!Number.isFinite(db)) return "silent";
    return `${db.toFixed(1)} dB`;
  }

  function formatGain(gain) {
    if (!Number.isFinite(gain) || gain <= 0) return "—";
    const db = linearToDb(gain);
    const sign = db >= 0 ? "+" : "";
    return `${sign}${db.toFixed(1)} dB / ×${gain.toFixed(2)}`;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .phase2-normalize-group { padding-left:2px; padding-right:2px; }
      body.simple-edit-phase1 .audio-clip.normalized .clip-effect-badges span.normalize-badge { border-color:rgba(80,215,178,.72); color:#c9fff1; }
      .normalize-backdrop { position:fixed; inset:0; z-index:2750; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(5,7,7,.74); backdrop-filter:blur(7px); }
      .normalize-backdrop.open { display:flex; }
      .normalize-dialog { width:min(1040px,97vw); max-height:min(800px,92vh); overflow:auto; border:1px solid rgba(224,163,96,.58); border-radius:22px; background:linear-gradient(180deg,rgba(39,37,30,.98),rgba(14,18,16,.99)); color:#f5f0db; box-shadow:0 26px 80px rgba(0,0,0,.54), inset 0 0 0 1px rgba(255,255,255,.04); padding:18px; }
      .normalize-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:14px; }
      .normalize-head h3 { margin:4px 0 6px; font-family:var(--font-headers); font-size:1.35rem; letter-spacing:.04em; }
      .normalize-head p { margin:0; color:rgba(245,240,219,.72); line-height:1.45; max-width:760px; }
      .normalize-controls { display:flex; flex-wrap:wrap; gap:10px; align-items:end; padding:12px; border:1px solid rgba(224,163,96,.24); border-radius:16px; background:rgba(7,9,8,.38); margin-bottom:12px; }
      .normalize-target { display:grid; gap:5px; min-width:170px; }
      .normalize-target span { color:#f8d792; font:800 .72rem var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
      .normalize-target input { border:1px solid rgba(224,163,96,.38); border-radius:10px; background:rgba(0,0,0,.28); color:#f5f0db; padding:8px 10px; font:800 .9rem var(--font-mono); }
      .normalize-table { display:grid; gap:8px; }
      .normalize-track-row { display:grid; grid-template-columns:32px 96px minmax(140px,1fr) 110px 110px 150px 180px 90px; gap:8px; align-items:center; border:1px solid rgba(224,163,96,.18); border-radius:14px; background:rgba(0,0,0,.2); padding:8px 10px; }
      .normalize-track-row.header { background:rgba(224,163,96,.1); color:#f8d792; font:800 .72rem var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
      .normalize-track-row.header > div { white-space:nowrap; }
      .normalize-track-row.empty { opacity:.5; }
      .normalize-track-label { font-weight:900; color:#fff4d6; }
      .normalize-clip-count { color:rgba(245,240,219,.66); font-size:.82rem; }
      .normalize-db, .normalize-gain { font:800 .82rem var(--font-mono); color:#dff5ff; }
      .normalize-peak.warning { color:#ffb68e; }
      .normalize-target-cell { display:flex; gap:6px; align-items:center; }
      .normalize-target-cell input { width:82px; border:1px solid rgba(224,163,96,.3); border-radius:9px; background:rgba(0,0,0,.26); color:#f5f0db; padding:7px 8px; font:800 .82rem var(--font-mono); }
      .normalize-mini { min-height:30px; border-radius:9px; padding:6px 8px; font:800 .72rem var(--font-mono); }
      .normalize-status { color:rgba(245,240,219,.62); font-size:.78rem; }
      .normalize-status.done { color:#baf7dc; }
      .normalize-status.error { color:#ffb68e; }
      .normalize-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; margin-top:14px; }
      @media (max-width:900px) { .normalize-track-row { grid-template-columns:28px 86px 1fr 92px 92px; } .normalize-track-row > div:nth-child(7), .normalize-track-row > div:nth-child(8), .normalize-track-row > button { grid-column:auto; } }
    `;
    document.head.appendChild(style);
  }

  function button(id, label, title) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      btn.type = "button";
      btn.className = "tool-button";
    }
    btn.textContent = label;
    btn.title = title;
    return btn;
  }

  function ensureToolbar() {
    const toolbar = document.querySelector(".phase1-timeline-toolbar");
    if (!toolbar || toolbar.querySelector(".phase2-normalize-group")) return;
    const group = document.createElement("div");
    group.className = "phase1-tool-group phase2-normalize-group";
    group.append(button("normalizeBtn", "⚖ Normalize", "Open track loudness normalize tools."));
    const divider = document.createElement("span");
    divider.className = "phase1-divider";
    divider.setAttribute("aria-hidden", "true");
    const previous = toolbar.querySelector(".phase2-fade-group") || toolbar.querySelector(".phase2-keyframes-group") || toolbar.querySelector(".phase1-edit-group");
    if (previous) {
      previous.insertAdjacentElement("afterend", divider);
      divider.insertAdjacentElement("afterend", group);
    } else {
      toolbar.append(divider, group);
    }
    ui.normalizeBtn = group.querySelector("#normalizeBtn");
    ui.normalizeBtn.addEventListener("click", openModal);
  }

  function ensureModal() {
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "normalize-backdrop";
    modal.innerHTML = `
      <div class="normalize-dialog" role="dialog" aria-modal="true" aria-labelledby="normalizeTitle">
        <div class="normalize-head">
          <div>
            <h3 id="normalizeTitle">Track Normalize</h3>
            <p>Scan each track, choose a target loudness, then apply. This changes clip volumes and volume keyframes; it does not create a new baked audio file.</p>
          </div>
          <button class="icon-button" id="normalizeCloseBtn" type="button" title="Close">✕</button>
        </div>
        <div class="normalize-controls">
          <label class="normalize-target"><span>Default target</span><input id="normalizeGlobalTarget" type="number" min="${MIN_DB}" max="${MAX_DB}" step="0.5" value="${DEFAULT_TARGET_DB}"></label>
          <button class="tool-button" id="normalizeCopyTargetBtn" type="button">Copy target to all</button>
          <button class="tool-button" id="normalizeScanBtn" type="button">Scan tracks</button>
          <button class="tool-button primary" id="normalizeApplyBtn" type="button">Apply checked</button>
        </div>
        <div class="normalize-table" id="normalizeTable"></div>
        <div class="normalize-actions">
          <button class="tool-button" id="normalizeResetTargetsBtn" type="button">Reset targets</button>
          <button class="tool-button" id="normalizeCloseBottomBtn" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    ui.normalizeModal = modal;
    ui.normalizeTable = modal.querySelector("#normalizeTable");
    ui.normalizeGlobalTarget = modal.querySelector("#normalizeGlobalTarget");
    modal.querySelector("#normalizeCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#normalizeCloseBottomBtn").addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    modal.querySelector("#normalizeCopyTargetBtn").addEventListener("click", () => copyTargetToAll(Number(ui.normalizeGlobalTarget.value)));
    modal.querySelector("#normalizeResetTargetsBtn").addEventListener("click", () => copyTargetToAll(DEFAULT_TARGET_DB));
    modal.querySelector("#normalizeScanBtn").addEventListener("click", scanTracks);
    modal.querySelector("#normalizeApplyBtn").addEventListener("click", applyChecked);
    renderRows();
  }

  function openModal() {
    ensureModal();
    renderRows();
    ui.normalizeModal.classList.add("open");
    ui.normalizeModal.querySelector("#normalizeScanBtn")?.focus();
  }

  function closeModal() {
    ui.normalizeModal?.classList.remove("open");
  }

  function renderRows() {
    if (!ui.normalizeTable) return;
    const table = ui.normalizeTable;
    const existingTargets = new Map([...table.querySelectorAll("input[data-normalize-target]")].map((input) => [Number(input.dataset.track), input.value]));
    table.innerHTML = `
      <div class="normalize-track-row header">
        <div></div><div>Track</div><div>Clips</div><div>Loudness</div><div>Peak</div><div>Target</div><div>Gain</div><div>Status</div>
      </div>
    `;
    for (let track = 0; track < trackCount(); track += 1) {
      const clips = clipsForTrack(track);
      const data = metrics.get(track);
      const target = existingTargets.get(track) || String(data?.targetDb ?? DEFAULT_TARGET_DB);
      const row = document.createElement("div");
      row.className = `normalize-track-row${clips.length ? "" : " empty"}`;
      row.dataset.track = String(track);
      const gain = data?.rms > 0 ? dbToLinear(clamp(target, MIN_DB, MAX_DB)) / data.rms : null;
      row.innerHTML = `
        <div><input type="checkbox" data-normalize-check="${track}" ${clips.length ? "checked" : "disabled"}></div>
        <div class="normalize-track-label">Track ${track + 1}</div>
        <div class="normalize-clip-count">${clips.length} clip${clips.length === 1 ? "" : "s"}</div>
        <div class="normalize-db normalize-rms">${data ? formatDb(data.db) : "not scanned"}</div>
        <div class="normalize-db normalize-peak ${data?.peakDb > -1 ? "warning" : ""}">${data ? formatDb(data.peakDb) : "—"}</div>
        <div class="normalize-target-cell"><input data-normalize-target="${track}" type="number" min="${MIN_DB}" max="${MAX_DB}" step="0.5" value="${target}"><button class="tool-button normalize-mini" type="button" data-copy-from="${track}">Match all</button></div>
        <div class="normalize-gain">${gain ? formatGain(gain) : "—"}</div>
        <div class="normalize-status ${data?.error ? "error" : data ? "done" : ""}">${data?.error || (data ? "ready" : clips.length ? "scan first" : "empty")}</div>
      `;
      table.appendChild(row);
    }
    table.querySelectorAll("input[data-normalize-target]").forEach((input) => input.addEventListener("input", updateGainPreview));
    table.querySelectorAll("button[data-copy-from]").forEach((btn) => btn.addEventListener("click", () => copyTargetToAll(targetForTrack(Number(btn.dataset.copyFrom)))));
  }

  function targetForTrack(track) {
    const input = ui.normalizeTable?.querySelector(`input[data-normalize-target="${track}"]`);
    return clamp(input?.value ?? DEFAULT_TARGET_DB, MIN_DB, MAX_DB);
  }

  function copyTargetToAll(value) {
    const target = clamp(value, MIN_DB, MAX_DB);
    if (ui.normalizeGlobalTarget) ui.normalizeGlobalTarget.value = String(target);
    ui.normalizeTable?.querySelectorAll("input[data-normalize-target]").forEach((input) => { input.value = String(target); });
    updateGainPreview();
    showToast(`Normalize target copied to all tracks: ${target} dB.`);
  }

  function updateGainPreview() {
    ui.normalizeTable?.querySelectorAll(".normalize-track-row:not(.header)").forEach((row) => {
      const track = Number(row.dataset.track);
      const data = metrics.get(track);
      const gainCell = row.querySelector(".normalize-gain");
      if (!gainCell || !data?.rms) return;
      const gain = dbToLinear(targetForTrack(track)) / data.rms;
      gainCell.textContent = formatGain(gain);
    });
  }

  function volumeAtClipTime(clip, time) {
    const duration = Math.max(0.001, clipDuration(clip));
    const local = clamp(time, 0, duration);
    const base = clamp(clip.volume ?? 100, 0, MAX_VOLUME) / 100;
    const list = Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes
      .map((kf) => ({ time: clamp(kf.time, 0, duration), volume: clamp(kf.volume ?? clip.volume ?? 100, 0, MAX_VOLUME) }))
      .sort((a, b) => a.time - b.time) : [];
    if (!list.length) return base;
    if (local <= list[0].time) {
      if (list[0].time <= 0.001) return list[0].volume / 100;
      const p = local / list[0].time;
      return base + (list[0].volume / 100 - base) * p;
    }
    const last = list[list.length - 1];
    if (local >= last.time) return last.volume / 100;
    for (let index = 0; index < list.length - 1; index += 1) {
      const left = list[index];
      const right = list[index + 1];
      if (local >= left.time && local <= right.time) {
        const p = (local - left.time) / Math.max(0.001, right.time - left.time);
        return left.volume / 100 + (right.volume / 100 - left.volume / 100) * p;
      }
    }
    return base;
  }

  function fadeAtClipTime(clip, time) {
    const duration = Math.max(0.001, clipDuration(clip));
    const local = clamp(time, 0, duration);
    const fadeIn = clamp(clip.fadeIn || 0, 0, duration);
    const fadeOut = clamp(clip.fadeOut || 0, 0, duration);
    let gain = 1;
    if (fadeIn > 0.001 && local < fadeIn) gain = Math.min(gain, local / fadeIn);
    if (fadeOut > 0.001 && local > duration - fadeOut) gain = Math.min(gain, (duration - local) / fadeOut);
    return clamp(gain, 0, 1);
  }

  async function analyzeTrack(track) {
    const clips = clipsForTrack(track);
    if (!clips.length) return { track, clips: 0, rms: 0, db: -Infinity, peak: 0, peakDb: -Infinity, targetDb: targetForTrack(track) };
    let sumSquares = 0;
    let count = 0;
    let peak = 0;
    for (const clip of clips) {
      const buffer = await processedClipBuffer(clip);
      if (!buffer) continue;
      const step = Math.max(1, Math.floor(buffer.length / 120000));
      for (let sample = 0; sample < buffer.length; sample += step) {
        const localTime = sample / buffer.sampleRate;
        const gain = volumeAtClipTime(clip, localTime) * fadeAtClipTime(clip, localTime);
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
          const value = buffer.getChannelData(channel)[sample] * gain;
          sumSquares += value * value;
          peak = Math.max(peak, Math.abs(value));
          count += 1;
        }
      }
    }
    const rms = count ? Math.sqrt(sumSquares / count) : 0;
    return { track, clips: clips.length, rms, db: linearToDb(rms), peak, peakDb: linearToDb(peak), targetDb: targetForTrack(track) };
  }

  async function scanTracks() {
    ensureModal();
    stopPlayback();
    setStatus("Scanning track loudness…");
    for (let track = 0; track < trackCount(); track += 1) {
      const row = ui.normalizeTable?.querySelector(`.normalize-track-row[data-track="${track}"]`);
      const status = row?.querySelector(".normalize-status");
      if (status) status.textContent = clipsForTrack(track).length ? "scanning…" : "empty";
      try {
        const data = await analyzeTrack(track);
        metrics.set(track, data);
      } catch (error) {
        console.error(error);
        metrics.set(track, { track, clips: clipsForTrack(track).length, rms: 0, db: -Infinity, peak: 0, peakDb: -Infinity, targetDb: targetForTrack(track), error: "scan failed" });
      }
      renderRows();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setStatus("Ready — normalize scan complete");
  }

  function applyGainToClip(clip, gain) {
    const applyValue = (value) => clamp(Math.round((Number(value) || 0) * gain), MIN_VOLUME, MAX_VOLUME);
    clip.volume = applyValue(clip.volume ?? 100);
    if (Array.isArray(clip.volumeKeyframes)) {
      clip.volumeKeyframes.forEach((kf) => { kf.volume = applyValue(kf.volume ?? clip.volume ?? 100); });
    }
    clip.normalized = { gain, at: Date.now() };
  }

  async function applyChecked() {
    ensureModal();
    const checked = [...ui.normalizeTable.querySelectorAll("input[data-normalize-check]:checked")].map((input) => Number(input.dataset.normalizeCheck));
    if (!checked.length) {
      showToast("Choose at least one track to normalize.");
      return;
    }
    if (!checked.every((track) => metrics.has(track))) await scanTracks();
    stopPlayback();
    let changed = 0;
    checked.forEach((track) => {
      const data = metrics.get(track);
      const clips = clipsForTrack(track);
      if (!data?.rms || !clips.length) return;
      const gain = dbToLinear(targetForTrack(track)) / data.rms;
      clips.forEach((clip) => {
        applyGainToClip(clip, gain);
        changed += 1;
      });
      metrics.delete(track);
    });
    syncSelectedControls();
    renderTimeline();
    renderRows();
    setStatus("Ready — normalize applied");
    showToast(changed ? `Normalize applied to ${changed} clip${changed === 1 ? "" : "s"}.` : "Nothing changed.");
  }

  function addNormalizeBadge(clip) {
    if (!clip.normalized) return;
    const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
    const badges = element?.querySelector(".clip-effect-badges");
    if (!element || !badges || badges.querySelector(".normalize-badge")) return;
    element.classList.add("normalized");
    const badge = document.createElement("span");
    badge.className = "normalize-badge";
    badge.textContent = "NORM";
    badge.title = `Normalized: ${formatGain(clip.normalized.gain)}`;
    badges.appendChild(badge);
  }

  function updateNormalizeButton() {
    if (ui.normalizeBtn) ui.normalizeBtn.disabled = !state.clips.length;
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function normalizeRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach(addNormalizeBadge);
    updateNormalizeButton();
  };

  const previousSyncSelectedControls = syncSelectedControls;
  syncSelectedControls = function normalizeSyncSelectedControls() {
    previousSyncSelectedControls();
    updateNormalizeButton();
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  installStyles();
  setVersion();
  ensureToolbar();
  ensureModal();
  updateNormalizeButton();
  renderTimeline();
  setStatus("Ready — track normalize active");
})();
