"use strict";

(function installOrgavoxAdvancedTools() {
  const STYLE_ID = "orgavoxAdvancedToolsStyles";
  const MODAL_ID = "orgavoxAdvancedModal";
  let lastScan = null;

  const h = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[ch]));
  const A = () => window.orgavoxAdvancedAnalysis;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-advanced-backdrop{position:fixed!important;inset:0!important;z-index:999997!important;display:grid!important;place-items:center!important;padding:22px!important;background:rgba(0,0,0,.68)!important;color:#f5f0db!important}
      .orgavox-advanced-backdrop[hidden]{display:none!important}
      .orgavox-advanced-dialog{width:min(860px,calc(100vw - 40px))!important;max-height:min(780px,calc(100vh - 40px))!important;overflow:auto!important;display:grid!important;gap:14px!important;padding:16px!important;border:1px solid rgba(117,178,222,.68)!important;border-radius:20px!important;background:linear-gradient(180deg,rgba(24,26,26,.98),rgba(8,10,10,.99))!important;box-shadow:0 24px 70px rgba(0,0,0,.76)!important}
      .orgavox-advanced-head{display:flex!important;justify-content:space-between!important;gap:14px!important;align-items:flex-start!important}.orgavox-advanced-head h3{margin:4px 0 2px!important;font-family:var(--font-headers,serif)!important}.orgavox-advanced-head p{margin:0!important;color:rgba(245,240,219,.65)!important;line-height:1.35!important}
      .orgavox-advanced-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}.orgavox-advanced-field{display:grid!important;gap:6px!important;font:800 .72rem var(--font-mono,monospace)!important;color:#f8d792!important;text-transform:uppercase!important;letter-spacing:.08em!important}.orgavox-advanced-field input,.orgavox-advanced-field select{min-height:38px!important;border:1px solid rgba(117,178,222,.56)!important;border-radius:10px!important;background:#050707!important;color:#f5f0db!important;padding:8px 10px!important;font:700 .86rem var(--font-body,system-ui)!important;text-transform:none!important;letter-spacing:0!important}
      .orgavox-advanced-results{min-height:92px!important;display:grid!important;gap:8px!important;padding:12px!important;border:1px solid rgba(224,163,96,.32)!important;border-radius:14px!important;background:rgba(224,163,96,.07)!important;color:#ffe6b5!important;font:700 .82rem var(--font-mono,monospace)!important;white-space:pre-wrap!important}.orgavox-advanced-results strong{color:#fff4d6!important}.orgavox-advanced-warn{color:#ffcf9a!important}.orgavox-advanced-actions{display:flex!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:wrap!important}
      @media(max-width:760px){.orgavox-advanced-grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function clipOptions(selectedId) {
    return state.clips.map((clip, index) => `<option value="${h(clip.id)}" ${clip.id === selectedId ? "selected" : ""}>${index + 1}. ${h(clip.name)} · Track ${clip.track + 1} · ${formatTime(clip.start)}</option>`).join("");
  }

  function chosenClip(selectId) {
    const id = document.getElementById(selectId)?.value;
    return state.clips.find((clip) => clip.id === id) || selectedClip?.() || state.clips[0] || null;
  }

  function twoSelected() {
    const ids = (state.selectedClipIds || []).filter(Boolean);
    const clips = ids.map((id) => state.clips.find((clip) => clip.id === id)).filter(Boolean);
    if (clips.length >= 2) return [clips[0], clips[1]];
    const selected = selectedClip?.();
    if (selected) return [selected, state.clips.find((clip) => clip.id !== selected.id) || selected];
    return [state.clips[0] || null, state.clips[1] || state.clips[0] || null];
  }

  function ensureModal() {
    installStyles();
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-advanced-backdrop";
    modal.hidden = true;
    document.body.appendChild(modal);
    modal.addEventListener("pointerdown", (event) => { if (event.target === modal) closeModal(); });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") modal.querySelector("[data-primary]")?.click();
    });
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.hidden = true;
  }

  function openModal(title, subtitle, body, actions = "") {
    const modal = ensureModal();
    modal.innerHTML = `<section class="orgavox-advanced-dialog" role="dialog" aria-modal="true" aria-labelledby="orgavoxAdvancedTitle" tabindex="-1"><div class="orgavox-advanced-head"><div><span class="eyebrow">Advanced audio</span><h3 id="orgavoxAdvancedTitle">${h(title)}</h3><p>${h(subtitle)}</p></div><button class="icon-button" type="button" data-close>×</button></div>${body}<div class="orgavox-advanced-actions">${actions}<button class="tool-button" type="button" data-close>Close</button></div></section>`;
    modal.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.hidden = false;
    modal.querySelector(".orgavox-advanced-dialog")?.focus();
    return modal;
  }

  function noClips() {
    if (state.clips.length) return false;
    showToast?.("Add clips before using Advanced tools.");
    return true;
  }

  function setResults(text) {
    const target = document.getElementById("orgavoxAdvancedResults");
    if (target) target.textContent = text;
  }

  async function scanBeat(selectId, label) {
    const clip = chosenClip(selectId);
    if (!clip) throw new Error("Choose a clip.");
    setResults(`Scanning ${label || clip.name}…`);
    const result = await A().analyzeBeats(clip);
    return result;
  }

  function openAlignFirstBeat() {
    if (noClips()) return;
    const [master, toAlign] = twoSelected();
    lastScan = null;
    const modal = openModal("Align First Beat", "Move the second clip so its first detected beat lines up with the master clip.", `<div class="orgavox-advanced-grid"><label class="orgavox-advanced-field">Master clip<select id="advMasterClip">${clipOptions(master?.id)}</select></label><label class="orgavox-advanced-field">To align<select id="advAlignClip">${clipOptions(toAlign?.id)}</select></label></div><div class="orgavox-advanced-results" id="orgavoxAdvancedResults">Scan both clips before aligning.</div>`, `<button class="tool-button" id="advScanAlignBtn" type="button">Scan beats</button><button class="tool-button primary" id="advApplyAlignBtn" data-primary type="button">Align</button>`);
    modal.querySelector("#advScanAlignBtn")?.addEventListener("click", async () => {
      try {
        const masterResult = await scanBeat("advMasterClip", "master");
        const alignResult = await scanBeat("advAlignClip", "to align");
        lastScan = { masterResult, alignResult };
        setResults(`Master: ${masterResult.clip.name}\nBPM: ${masterResult.bpm || "unknown"} · first beat ${formatTime(masterResult.firstBeat)} · ${masterResult.source}\n\nTo Align: ${alignResult.clip.name}\nBPM: ${alignResult.bpm || "unknown"} · first beat ${formatTime(alignResult.firstBeat)} · ${alignResult.source}`);
      } catch (error) { console.error(error); setResults(error.message || "Beat scan failed."); }
    });
    modal.querySelector("#advApplyAlignBtn")?.addEventListener("click", async () => {
      try {
        if (!lastScan) modal.querySelector("#advScanAlignBtn")?.click();
        setTimeout(() => {
          if (!lastScan) return;
          const { masterResult, alignResult } = lastScan;
          if (masterResult.clip.id === alignResult.clip.id) { setResults("Choose two different clips."); return; }
          const newStart = Math.max(0, masterResult.clip.start + masterResult.firstBeat - alignResult.firstBeat);
          alignResult.clip.start = newStart;
          selectClip?.(alignResult.clip.id, false);
          renderTimeline?.();
          window.orgavoxRecordHistory?.("Align first beat");
          setResults(`Aligned ${alignResult.clip.name}.\nNew start: ${formatTime(newStart)}.`);
          showToast?.("First beats aligned.");
        }, 150);
      } catch (error) { console.error(error); setResults(error.message || "Align failed."); }
    });
  }

  function openRemoveSilence() {
    if (noClips()) return;
    const clip = selectedClip?.() || state.clips[0];
    lastScan = null;
    const modal = openModal("Remove Silence", "Find silence at the start, end, or both sides of the selected clip. Apply trims the clip non-destructively.", `<div class="orgavox-advanced-grid"><label class="orgavox-advanced-field">Clip<select id="advSilenceClip">${clipOptions(clip?.id)}</select></label><label class="orgavox-advanced-field">Mode<select id="advSilenceMode"><option value="both">Start and end</option><option value="start">Start only</option><option value="end">End only</option></select></label><label class="orgavox-advanced-field">Threshold dB<input id="advSilenceThreshold" type="number" min="-80" max="-10" step="1" value="-45"></label></div><div class="orgavox-advanced-results" id="orgavoxAdvancedResults">Scan before applying.</div>`, `<button class="tool-button" id="advScanSilenceBtn" type="button">Scan silence</button><button class="tool-button primary" id="advApplySilenceBtn" data-primary type="button">Apply trim</button>`);
    modal.querySelector("#advScanSilenceBtn")?.addEventListener("click", () => {
      try {
        const result = A().findSilenceTrim(chosenClip("advSilenceClip"), Number(document.getElementById("advSilenceThreshold")?.value) || -45);
        lastScan = result;
        setResults(`Clip: ${result.clip.name}\nStart silence: ${formatTime(result.start)}\nEnd silence: ${formatTime(result.end)}\nRemaining: ${formatTime(result.remaining)}\nThreshold: ${result.thresholdDb} dB`);
      } catch (error) { console.error(error); setResults(error.message || "Silence scan failed."); }
    });
    modal.querySelector("#advApplySilenceBtn")?.addEventListener("click", () => {
      try {
        if (!lastScan) modal.querySelector("#advScanSilenceBtn")?.click();
        if (!lastScan) return;
        const mode = document.getElementById("advSilenceMode")?.value || "both";
        const clip = lastScan.clip;
        const startTrim = mode !== "end" ? lastScan.start : 0;
        const endTrim = mode !== "start" ? lastScan.end : 0;
        if (startTrim + endTrim >= (clip.sourceEnd - clip.sourceStart) - 0.02) { setResults("Trim would remove the whole clip. Raise the threshold or choose a side only."); return; }
        clip.sourceStart += startTrim;
        clip.sourceEnd -= endTrim;
        clip.stretchDuration = null;
        invalidateClip?.(clip);
        selectClip?.(clip.id, false);
        syncSelectedControls?.();
        renderTimeline?.();
        window.orgavoxRecordHistory?.("Remove silence");
        setResults(`Applied trim.\nRemoved start: ${formatTime(startTrim)}\nRemoved end: ${formatTime(endTrim)}`);
        showToast?.("Silence removed from clip edges.");
      } catch (error) { console.error(error); setResults(error.message || "Trim failed."); }
    });
  }

  function openMeasureNote() {
    if (noClips()) return;
    const clip = selectedClip?.() || state.clips[0];
    const local = clip ? Math.max(0, Math.min(clipDuration(clip), (state.playhead || clip.start) - clip.start)) : 0;
    const modal = openModal("Measure Note", "Analyze the dominant pitch at one time index in a clip.", `<div class="orgavox-advanced-grid"><label class="orgavox-advanced-field">Clip<select id="advNoteClip">${clipOptions(clip?.id)}</select></label><label class="orgavox-advanced-field">Time in clip<input id="advNoteTime" type="text" value="${h(formatTime(local))}"></label></div><div class="orgavox-advanced-results" id="orgavoxAdvancedResults">Place the playhead, choose a clip, then Analyze.</div>`, `<button class="tool-button" id="advUsePlayheadBtn" type="button">Use playhead</button><button class="tool-button primary" id="advMeasureNoteBtn" data-primary type="button">Analyze</button>`);
    modal.querySelector("#advUsePlayheadBtn")?.addEventListener("click", () => {
      const clip = chosenClip("advNoteClip");
      const t = Math.max(0, Math.min(clipDuration(clip), (state.playhead || clip.start) - clip.start));
      document.getElementById("advNoteTime").value = formatTime(t);
    });
    modal.querySelector("#advMeasureNoteBtn")?.addEventListener("click", () => {
      try {
        const clip = chosenClip("advNoteClip");
        const time = parseTimeLike(document.getElementById("advNoteTime")?.value);
        const result = A().measurePitchAtTime(clip, time);
        setResults(result.note ? `Clip: ${clip.name}\nTime: ${formatTime(result.time)}\nNote: ${result.note.note}\nFrequency: ${result.note.frequency} Hz\nTuning: ${result.note.cents > 0 ? "+" : ""}${result.note.cents} cents\nSource: ${result.source}` : `Clip: ${clip.name}\nTime: ${formatTime(result.time)}\nNo stable note detected at that point.`);
      } catch (error) { console.error(error); setResults(error.message || "Note analysis failed."); }
    });
  }

  function parseTimeLike(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (raw.includes(":")) return raw.split(":").map(Number).reduce((sum, part) => sum * 60 + (Number.isFinite(part) ? part : 0), 0);
    return Math.max(0, Number(raw.replace(/s$/i, "")) || 0);
  }

  function openMatchKey() {
    if (noClips()) return;
    const [master, toAlign] = twoSelected();
    lastScan = null;
    const modal = openModal("Match Key", "Scan two clips, then transpose the second clip to the detected master key.", `<div class="orgavox-advanced-grid"><label class="orgavox-advanced-field">Master clip<select id="advKeyMasterClip">${clipOptions(master?.id)}</select></label><label class="orgavox-advanced-field">To align<select id="advKeyAlignClip">${clipOptions(toAlign?.id)}</select></label></div><div class="orgavox-advanced-results" id="orgavoxAdvancedResults">Scan keys before matching.</div>`, `<button class="tool-button" id="advScanKeyBtn" type="button">Scan keys</button><button class="tool-button primary" id="advApplyKeyBtn" data-primary type="button">Match key</button>`);
    modal.querySelector("#advScanKeyBtn")?.addEventListener("click", async () => {
      try {
        setResults("Scanning keys…");
        const masterResult = await A().estimateKey(chosenClip("advKeyMasterClip"));
        const alignResult = await A().estimateKey(chosenClip("advKeyAlignClip"));
        lastScan = { masterResult, alignResult };
        const delta = A().keySemitoneDelta(alignResult.keyIndex, masterResult.keyIndex);
        setResults(`Master: ${masterResult.clip.name}\nKey: ${masterResult.key} · ${masterResult.source}\n\nTo Align: ${alignResult.clip.name}\nKey: ${alignResult.key} · ${alignResult.source}\n\nSuggested transpose: ${delta > 0 ? "+" : ""}${delta} semitone(s)`);
      } catch (error) { console.error(error); setResults(error.message || "Key scan failed."); }
    });
    modal.querySelector("#advApplyKeyBtn")?.addEventListener("click", () => {
      try {
        if (!lastScan) { setResults("Scan keys first."); return; }
        const { masterResult, alignResult } = lastScan;
        if (masterResult.clip.id === alignResult.clip.id) { setResults("Choose two different clips."); return; }
        const delta = A().keySemitoneDelta(alignResult.keyIndex, masterResult.keyIndex);
        alignResult.clip.transposeSemitones = Math.max(-24, Math.min(24, (Number(alignResult.clip.transposeSemitones) || 0) + delta));
        invalidateClip?.(alignResult.clip);
        selectClip?.(alignResult.clip.id, false);
        syncSelectedControls?.();
        renderTimeline?.();
        window.orgavoxRecordHistory?.("Match key");
        setResults(`Applied ${delta > 0 ? "+" : ""}${delta} semitone(s) to ${alignResult.clip.name}.`);
        showToast?.("Clip key matched by transpose.");
      } catch (error) { console.error(error); setResults(error.message || "Key match failed."); }
    });
  }

  function openBpmDrift() {
    if (noClips()) return;
    const clip = selectedClip?.() || state.clips[0];
    lastScan = null;
    const modal = openModal("Split BPM Drift", "Scan a clip for local BPM changes and propose split points at low-energy moments before beat changes. This pass marks proposals; it does not destructively split automatically.", `<div class="orgavox-advanced-grid"><label class="orgavox-advanced-field">Clip<select id="advDriftClip">${clipOptions(clip?.id)}</select></label></div><div class="orgavox-advanced-results" id="orgavoxAdvancedResults">Scan drift to preview proposed split markers.</div>`, `<button class="tool-button primary" id="advScanDriftBtn" data-primary type="button">Scan drift</button><button class="tool-button" id="advMarkDriftBtn" type="button">Add split markers</button>`);
    modal.querySelector("#advScanDriftBtn")?.addEventListener("click", async () => {
      try {
        setResults("Scanning BPM drift…");
        const result = await A().analyzeBpmDrift(chosenClip("advDriftClip"));
        lastScan = result;
        const lines = [`Clip: ${result.clip.name}`, `Base BPM: ${result.bpm || "unknown"}`, `Source: ${result.source}`, "", "Local windows:", ...(result.windows.slice(0, 8).map((w) => `${formatTime(w.start)}–${formatTime(w.end)} · ${w.bpm} BPM`)), "", "Proposed split markers:", ...(result.driftPoints.length ? result.driftPoints.map((p) => `${formatTime(p.time)} · ${p.reason}`) : ["No strong BPM drift found."])];
        setResults(lines.join("\n"));
      } catch (error) { console.error(error); setResults(error.message || "Drift scan failed."); }
    });
    modal.querySelector("#advMarkDriftBtn")?.addEventListener("click", () => {
      try {
        if (!lastScan?.driftPoints?.length) { setResults("Scan drift first. No proposed split markers are available yet."); return; }
        const list = (window.orgavoxMarkers ||= []);
        lastScan.driftPoints.forEach((point, index) => list.push({ id: `marker-${Date.now()}-${Math.random().toString(36).slice(2)}`, time: lastScan.clip.start + point.time, label: `BPM drift split ${index + 1}`, color: "purple" }));
        window.orgavoxRenderMarkers?.();
        window.orgavoxRecordHistory?.("Add BPM drift split markers");
        showToast?.("BPM drift split markers added.");
      } catch (error) { console.error(error); setResults(error.message || "Could not add split markers."); }
    });
  }

  window.orgavoxOpenAdvancedAlignFirstBeat = openAlignFirstBeat;
  window.orgavoxOpenAdvancedRemoveSilence = openRemoveSilence;
  window.orgavoxOpenAdvancedMeasureNote = openMeasureNote;
  window.orgavoxOpenAdvancedMatchKey = openMatchKey;
  window.orgavoxOpenAdvancedBpmDrift = openBpmDrift;
})();
