"use strict";

(function installOrgavoxAnalysisTools() {
  const STYLE_ID = "orgavox-analysis-style";
  const MODAL_ID = "analysisModal";
  let busy = false;
  let lastReport = "";

  function selectedClipForAnalysis() {
    return state.clips.find((clip) => clip.id === state.selectedClipId) || null;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-analysis-button{border-color:rgba(117,178,222,.78)!important;background:linear-gradient(180deg,rgba(28,77,117,.82),rgba(12,33,54,.94))!important;color:#dff5ff!important}
      .orgavox-analysis-modal{position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-analysis-modal[hidden]{display:none}
      .orgavox-analysis-dialog{width:min(900px,calc(100vw - 42px));max-height:min(780px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-analysis-summary{margin-top:12px;padding:12px;border-radius:14px;border:1px solid rgba(117,178,222,.32);background:rgba(117,178,222,.08);color:rgba(245,240,219,.78);font-size:.72rem;line-height:1.45}
      .orgavox-analysis-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .orgavox-analysis-stat{padding:12px;border:1px solid rgba(137,107,73,.52);border-radius:14px;background:rgba(0,0,0,.2)}
      .orgavox-analysis-stat span{display:block;color:rgba(245,240,219,.56);font:700 .64rem var(--font-body);text-transform:uppercase;letter-spacing:.055em}
      .orgavox-analysis-stat strong{display:block;margin-top:5px;color:#f8d792;font:800 .92rem var(--font-mono)}
      .orgavox-analysis-warnings{display:grid;gap:8px;margin-top:14px}.orgavox-analysis-warning{padding:10px 12px;border-radius:12px;background:rgba(220,72,64,.12);border:1px solid rgba(220,72,64,.32);color:#ffd8d2;font-size:.72rem;line-height:1.35}.orgavox-analysis-ok{background:rgba(74,190,117,.1);border-color:rgba(74,190,117,.28);color:#d6ffe4}
      .orgavox-analysis-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      @media(max-width:860px){.orgavox-analysis-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.orgavox-analysis-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    const button = document.getElementById("analysisBtn");
    if (button) ui.analysisBtn = button;
    return button;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-analysis-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-analysis-dialog" role="dialog" aria-modal="true" aria-labelledby="analysisTitle">
        <div class="popover-head"><div><span class="eyebrow">Clip inspection</span><h3 id="analysisTitle">Analyze selected clip</h3></div><button class="icon-button" data-analysis-close type="button">×</button></div>
        <p class="export-note">Scans the selected clip after trimming, stretch, reverse, transpose and current effects where the render chain allows it.</p>
        <div class="orgavox-analysis-summary" data-analysis-summary>Select a clip and press Scan.</div>
        <div class="orgavox-analysis-grid" data-analysis-grid></div>
        <div class="orgavox-analysis-warnings" data-analysis-warnings></div>
        <div class="orgavox-analysis-actions"><button class="tool-button" data-analysis-copy type="button">Copy stats</button><button class="tool-button primary" data-analysis-scan type="button">Scan clip</button><button class="tool-button" data-analysis-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-analysis-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-analysis-scan]")?.addEventListener("click", scanSelectedClip);
    modal.querySelector("[data-analysis-copy]")?.addEventListener("click", copyStats);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function dbfs(value) {
    return value > 0 ? `${(20 * Math.log10(value)).toFixed(1)} dBFS` : "-∞ dBFS";
  }

  function pct(value) {
    return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
  }

  function fmtNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return "—";
    return Number(value).toFixed(digits);
  }

  function rmsToLufsEstimate(rms) {
    return rms > 0 ? `${(20 * Math.log10(rms) - 0.7).toFixed(1)} LUFS est.` : "-∞ LUFS est.";
  }

  function estimatePulse(buffer) {
    const sampleRate = buffer.sampleRate;
    const hop = 1024;
    const frames = Math.floor(buffer.length / hop);
    if (frames < 48) return null;
    const channelCount = buffer.numberOfChannels;
    const envelope = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame += 1) {
      let sum = 0;
      const start = frame * hop;
      const end = Math.min(buffer.length, start + hop);
      for (let channel = 0; channel < channelCount; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let index = start; index < end; index += 1) sum += Math.abs(data[index] || 0);
      }
      envelope[frame] = sum / Math.max(1, (end - start) * channelCount);
    }
    let mean = 0;
    for (const value of envelope) mean += value;
    mean /= envelope.length;
    for (let index = 0; index < envelope.length; index += 1) envelope[index] = Math.max(0, envelope[index] - mean);
    const frameRate = sampleRate / hop;
    let bestLag = 0;
    let bestScore = 0;
    const minLag = Math.max(1, Math.floor(frameRate * 60 / 200));
    const maxLag = Math.min(envelope.length - 2, Math.ceil(frameRate * 60 / 60));
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let score = 0;
      for (let index = lag; index < envelope.length; index += 1) score += envelope[index] * envelope[index - lag];
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    if (!bestLag || bestScore <= 0) return null;
    const bpm = 60 * frameRate / bestLag;
    return bpm >= 55 && bpm <= 205 ? Math.round(bpm) : null;
  }

  function analyzeBuffer(buffer) {
    const channels = buffer.numberOfChannels;
    let peak = 0;
    let sumSquares = 0;
    let sumAbs = 0;
    let dcSum = 0;
    let sampleCount = 0;
    let clipped = 0;
    let silent = 0;
    let zeroCrossings = 0;
    const silenceThreshold = 0.001;
    for (let channel = 0; channel < channels; channel += 1) {
      const data = buffer.getChannelData(channel);
      let previous = data[0] || 0;
      for (let index = 0; index < data.length; index += 1) {
        const value = data[index] || 0;
        const abs = Math.abs(value);
        peak = Math.max(peak, abs);
        sumSquares += value * value;
        sumAbs += abs;
        dcSum += value;
        if (abs >= 0.999) clipped += 1;
        if (abs < silenceThreshold) silent += 1;
        if ((previous < 0 && value >= 0) || (previous > 0 && value <= 0)) zeroCrossings += 1;
        previous = value;
        sampleCount += 1;
      }
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
    const crest = rms > 0 ? peak / rms : 0;
    const pulse = estimatePulse(buffer);
    return {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels,
      peak,
      rms,
      crest,
      average: sumAbs / Math.max(1, sampleCount),
      dc: dcSum / Math.max(1, sampleCount),
      clippedPct: clipped / Math.max(1, sampleCount) * 100,
      silentPct: silent / Math.max(1, sampleCount) * 100,
      zcr: zeroCrossings / Math.max(1, sampleCount),
      pulse
    };
  }

  function renderStats(clip, stats) {
    const modal = ensureModal();
    const grid = modal.querySelector("[data-analysis-grid]");
    const warnings = modal.querySelector("[data-analysis-warnings]");
    const summary = modal.querySelector("[data-analysis-summary]");
    const rows = [
      ["Duration", formatTime(stats.duration)],
      ["Channels", String(stats.channels)],
      ["Sample rate", `${Math.round(stats.sampleRate)} Hz`],
      ["Peak", `${fmtNumber(stats.peak, 3)} · ${dbfs(stats.peak)}`],
      ["RMS", `${fmtNumber(stats.rms, 3)} · ${dbfs(stats.rms)}`],
      ["Loudness", rmsToLufsEstimate(stats.rms)],
      ["Crest", `${fmtNumber(stats.crest, 2)}×`],
      ["Silence", pct(stats.silentPct)],
      ["Clipping", pct(stats.clippedPct)],
      ["DC offset", fmtNumber(stats.dc, 4)],
      ["Zero crossings", fmtNumber(stats.zcr * 100, 2) + "%"],
      ["Rough pulse", stats.pulse ? `${stats.pulse} BPM` : "Not detected"]
    ];
    grid.innerHTML = rows.map(([label, value]) => `<div class="orgavox-analysis-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
    const alerts = [];
    if (stats.peak > 0.985) alerts.push(["Possible clipping or near-clipping detected.", false]);
    if (stats.rms < 0.018) alerts.push(["Very quiet clip. Normalize or gain may help.", false]);
    if (stats.silentPct > 55) alerts.push(["Large silent sections detected.", false]);
    if (Math.abs(stats.dc) > 0.02) alerts.push(["Noticeable DC offset detected.", false]);
    if (!alerts.length) alerts.push(["No obvious technical warnings found.", true]);
    warnings.innerHTML = alerts.map(([text, ok]) => `<div class="orgavox-analysis-warning${ok ? " orgavox-analysis-ok" : ""}">${text}</div>`).join("");
    summary.textContent = `${clip.name} · analyzed rendered selected-clip audio`;
    lastReport = [`ORGAVOX analysis: ${clip.name}`, ...rows.map(([label, value]) => `${label}: ${value}`), ...alerts.map(([text]) => `Note: ${text}`)].join("\n");
  }

  async function renderClipForAnalysis(clip) {
    if (typeof window.orgavoxRenderClipToBuffer === "function") return window.orgavoxRenderClipToBuffer(clip);
    return processedClipBuffer(clip);
  }

  async function scanSelectedClip() {
    const clip = selectedClipForAnalysis();
    if (!clip || busy) return;
    busy = true;
    updateAnalysisButtonState();
    const modal = ensureModal();
    modal.querySelector("[data-analysis-summary]").textContent = "Scanning selected clip…";
    modal.querySelector("[data-analysis-grid]").innerHTML = "";
    modal.querySelector("[data-analysis-warnings]").innerHTML = "";
    setStatus("Analyzing selected clip…");
    try {
      const buffer = await renderClipForAnalysis(clip);
      if (!buffer) throw new Error("The selected clip could not be analyzed.");
      renderStats(clip, analyzeBuffer(buffer));
      setStatus("Ready");
    } catch (error) {
      console.error(error);
      modal.querySelector("[data-analysis-summary]").textContent = error.message || "Analysis failed.";
      setStatus("Analysis failed");
    } finally {
      busy = false;
      updateAnalysisButtonState();
    }
  }

  async function copyStats() {
    if (!lastReport) return showToast("Scan a clip first.");
    try {
      await navigator.clipboard.writeText(lastReport);
      showToast("Analysis copied.");
    } catch {
      showToast("Clipboard copy failed.");
    }
  }

  function openModal() {
    const clip = selectedClipForAnalysis();
    if (!clip) return showToast("Select a clip before opening Analyze.");
    const modal = ensureModal();
    modal.hidden = false;
    modal.querySelector("[data-analysis-summary]").textContent = `${clip.name} · press Scan clip.`;
    modal.querySelector("[data-analysis-grid]").innerHTML = "";
    modal.querySelector("[data-analysis-warnings]").innerHTML = "";
    lastReport = "";
  }

  function closeModal() {
    ensureModal().hidden = true;
  }

  function updateAnalysisButtonState() {
    const button = ensureButton();
    if (!button) return;
    button.disabled = busy || !selectedClipForAnalysis();
    button.textContent = busy ? "📈 Scanning" : "📈 Analyze";
  }

  function patchRender() {
    if (window.__orgavoxAnalysisRenderPatched) return;
    window.__orgavoxAnalysisRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxAnalysisRenderTimeline() {
      previousRenderTimeline();
      updateAnalysisButtonState();
    };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxAnalysisSyncSelectedControls() {
      previousSyncSelectedControls();
      updateAnalysisButtonState();
    };
  }

  window.orgavoxOpenAnalysis = openModal;
  window.orgavoxUpdateAnalysisButton = updateAnalysisButtonState;

  installStyles();
  ensureButton();
  ensureModal();
  patchRender();
  updateAnalysisButtonState();
  renderTimeline();
  setTimeout(updateAnalysisButtonState, 150);
})();
