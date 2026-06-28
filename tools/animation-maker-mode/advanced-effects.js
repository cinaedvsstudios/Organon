(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const effectsCardId = 'animation-effects-card';
  let previewTimer = null;
  let previewRun = 0;

  const effectState = {
    inbetweens: 0,
    fadeIn: false,
    fadeOut: false,
    fadeLevel: 3,
    loopBlend: 0,
    holdFirst: 0,
    holdLast: 0,
    speedCurve: 'linear',
    pulse: 0,
    shake: 0,
    bob: 0,
    trail: 0,
    strobe: 0
  };

  function setStatus(text) {
    try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    window.setTimeout(() => {
      try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {}
    }, 4200);
  }

  function showCard() {
    let card = $(effectsCardId);
    if (card) return card;

    const adjustCard = $('adjust-card');
    if (!adjustCard) return null;

    card = document.createElement('section');
    card.id = effectsCardId;
    card.className = 'config-card animation-effects-card';
    card.innerHTML = `
      <h3>4. Animation Effects</h3>
      <p class="help-text">Non-destructive effects are applied to preview, GIF output and the processed frames ZIP. They do not alter the frame queue.</p>
      <div class="effects-section">
        <div class="effects-section-heading"><h4>Motion &amp; Loop</h4><span id="effects-frame-estimate">Generated frames: —</span></div>
        <div class="effects-control-row">
          <label>In-Between Frames
            <select id="effect-inbetweens"><option value="0">OFF</option><option value="1">1 BLEND</option><option value="2">2 BLENDS</option><option value="3">3 BLENDS</option></select>
          </label>
          <label>Loop Blend
            <select id="effect-loop-blend"><option value="0">OFF</option><option value="1">1 FRAME</option><option value="2">2 FRAMES</option><option value="3">3 FRAMES</option></select>
          </label>
          <label>Speed Curve
            <select id="effect-speed-curve"><option value="linear">LINEAR</option><option value="ease-in">EASE IN</option><option value="ease-out">EASE OUT</option><option value="ease-in-out">EASE IN / OUT</option></select>
          </label>
        </div>
        <div class="effects-control-row effects-hold-row">
          <label>Hold First <input id="effect-hold-first" type="number" min="0" max="20" value="0"></label>
          <label>Hold Last <input id="effect-hold-last" type="number" min="0" max="20" value="0"></label>
          <span class="effects-note">Holds use normal frame duration.</span>
        </div>
      </div>
      <div class="effects-section">
        <div class="effects-section-heading"><h4>Transparency Fade</h4><span id="effects-fade-summary">No fade</span></div>
        <div class="effects-control-row effects-fade-row">
          <label class="effects-toggle"><input id="effect-fade-in" type="checkbox"> FADE IN</label>
          <label class="effects-toggle"><input id="effect-fade-out" type="checkbox"> FADE OUT</label>
          <label class="effects-range">Fade Level <input id="effect-fade-level" type="range" min="1" max="10" value="3"><b id="effect-fade-level-value">3</b></label>
        </div>
      </div>
      <div class="effects-section">
        <div class="effects-section-heading"><h4>Stylisation</h4><button type="button" class="mini-action" id="effects-reset">RESET EFFECTS</button></div>
        <div class="effects-sliders">
          <label>Opacity Pulse <input id="effect-pulse" type="range" min="0" max="10" value="0"><b>0</b></label>
          <label>Shake / Jitter <input id="effect-shake" type="range" min="0" max="10" value="0"><b>0</b></label>
          <label>Float / Bob <input id="effect-bob" type="range" min="0" max="10" value="0"><b>0</b></label>
          <label>Motion Trail <input id="effect-trail" type="range" min="0" max="10" value="0"><b>0</b></label>
          <label>Strobe <input id="effect-strobe" type="range" min="0" max="10" value="0"><b>0</b></label>
        </div>
      </div>
      <div class="effects-bottom-row"><button type="button" id="effects-preview" class="mini-action">PREVIEW EFFECTS</button><span id="effects-output-note">GIF uses a timing approximation when generated frames are added.</span></div>
    `;

    adjustCard.insertAdjacentElement('afterend', card);
    return card;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function readEffects() {
    effectState.inbetweens = Number($('effect-inbetweens')?.value || 0);
    effectState.fadeIn = Boolean($('effect-fade-in')?.checked);
    effectState.fadeOut = Boolean($('effect-fade-out')?.checked);
    effectState.fadeLevel = Number($('effect-fade-level')?.value || 1);
    effectState.loopBlend = Number($('effect-loop-blend')?.value || 0);
    effectState.holdFirst = clamp(Number($('effect-hold-first')?.value || 0), 0, 20);
    effectState.holdLast = clamp(Number($('effect-hold-last')?.value || 0), 0, 20);
    effectState.speedCurve = $('effect-speed-curve')?.value || 'linear';
    ['pulse', 'shake', 'bob', 'trail', 'strobe'].forEach((name) => {
      effectState[name] = Number($(`effect-${name}`)?.value || 0);
    });
  }

  function effectsActive() {
    readEffects();
    return effectState.inbetweens > 0 || effectState.fadeIn || effectState.fadeOut || effectState.loopBlend > 0 || effectState.holdFirst > 0 || effectState.holdLast > 0 || effectState.speedCurve !== 'linear' || effectState.pulse > 0 || effectState.shake > 0 || effectState.bob > 0 || effectState.trail > 0 || effectState.strobe > 0;
  }

  function outputIndices() {
    const count = document.querySelectorAll('#frame-grid .frame-thumb-wrapper').length;
    const skip = Number($('adj-skip')?.value || 1);
    let indices = Array.from({ length: count }, (_, index) => index).filter((_, index) => index % skip === 0);
    if ($('chk-reverse')?.checked) indices = indices.reverse();
    if ($('chk-forverse')?.checked) indices = indices.concat([...indices].reverse());
    return indices;
  }

  function duplicateCanvas(source) {
    const result = document.createElement('canvas');
    result.width = source.width;
    result.height = source.height;
    result.getContext('2d').drawImage(source, 0, 0);
    return result;
  }

  function canvasWithAlpha(source, alpha) {
    const result = document.createElement('canvas');
    result.width = source.width;
    result.height = source.height;
    const context = result.getContext('2d');
    context.globalAlpha = alpha;
    context.drawImage(source, 0, 0);
    return result;
  }

  function blendCanvases(first, second, amount) {
    const result = document.createElement('canvas');
    result.width = Math.max(first.width, second.width);
    result.height = Math.max(first.height, second.height);
    const context = result.getContext('2d');
    context.globalAlpha = 1 - amount;
    context.drawImage(first, 0, 0, result.width, result.height);
    context.globalAlpha = amount;
    context.drawImage(second, 0, 0, result.width, result.height);
    return result;
  }

  function styliseFrames(frames) {
    const total = Math.max(1, frames.length);
    return frames.map((frame, index) => {
      const result = document.createElement('canvas');
      result.width = frame.width;
      result.height = frame.height;
      const context = result.getContext('2d');
      const phase = total === 1 ? 0 : index / (total - 1);
      const pulse = effectState.pulse ? 1 - (effectState.pulse / 22) + Math.sin(phase * Math.PI * 2) * (effectState.pulse / 22) : 1;
      const bob = effectState.bob ? Math.sin(phase * Math.PI * 2) * effectState.bob : 0;
      const shakeX = effectState.shake ? Math.sin((index + 1) * 12.9898) * effectState.shake : 0;
      const shakeY = effectState.shake ? Math.cos((index + 1) * 78.233) * effectState.shake : 0;
      const strobe = effectState.strobe && index % Math.max(2, 12 - effectState.strobe) === 0 ? .4 + effectState.strobe / 20 : 1;

      if (effectState.trail && index > 0) {
        context.globalAlpha = effectState.trail / 28;
        context.drawImage(frames[index - 1], 0, 0);
      }

      context.globalAlpha = clamp(pulse * strobe, 0, 1);
      context.drawImage(frame, shakeX, shakeY + bob);
      return result;
    });
  }

  function applyTimingCurve(frames) {
    if (effectState.speedCurve === 'linear' || frames.length < 3) return frames;
    const output = [];
    frames.forEach((frame, index) => {
      const t = index / (frames.length - 1);
      let duplicates = 1;
      if (effectState.speedCurve === 'ease-in') duplicates = t < .42 ? 2 : 1;
      if (effectState.speedCurve === 'ease-out') duplicates = t > .58 ? 2 : 1;
      if (effectState.speedCurve === 'ease-in-out') duplicates = t < .25 || t > .75 ? 2 : 1;
      for (let count = 0; count < duplicates; count += 1) output.push(frame);
    });
    return output;
  }

  function applyEffects(baseFrames) {
    let frames = styliseFrames(baseFrames.map(duplicateCanvas));

    if (effectState.inbetweens > 0 && frames.length > 1) {
      const smoothed = [];
      for (let index = 0; index < frames.length - 1; index += 1) {
        smoothed.push(frames[index]);
        for (let step = 1; step <= effectState.inbetweens; step += 1) {
          smoothed.push(blendCanvases(frames[index], frames[index + 1], step / (effectState.inbetweens + 1)));
        }
      }
      smoothed.push(frames[frames.length - 1]);
      frames = smoothed;
    }

    if (effectState.loopBlend > 0 && frames.length > 1) {
      const last = frames[frames.length - 1];
      const first = frames[0];
      for (let step = 1; step <= effectState.loopBlend; step += 1) {
        frames.push(blendCanvases(last, first, step / (effectState.loopBlend + 1)));
      }
    }

    if (effectState.holdFirst > 0 && frames.length) {
      frames = [...Array(effectState.holdFirst).fill(frames[0]), ...frames];
    }
    if (effectState.holdLast > 0 && frames.length) {
      frames = [...frames, ...Array(effectState.holdLast).fill(frames[frames.length - 1])];
    }

    if (effectState.fadeIn && frames.length) {
      const first = frames[0];
      const fade = Array.from({ length: effectState.fadeLevel }, (_, index) => canvasWithAlpha(first, (index + 1) / effectState.fadeLevel));
      frames = [...fade, ...frames.slice(1)];
    }
    if (effectState.fadeOut && frames.length) {
      const last = frames[frames.length - 1];
      const fade = Array.from({ length: effectState.fadeLevel }, (_, index) => canvasWithAlpha(last, 1 - index / Math.max(1, effectState.fadeLevel - 1)));
      frames = [...frames.slice(0, -1), ...fade];
    }

    return applyTimingCurve(frames);
  }

  async function waitForFrame(index) {
    const label = $('editor-frame-number');
    const expected = `FRAME ${index + 1}`;
    const started = Date.now();
    while (Date.now() - started < 3000) {
      if (label?.textContent?.startsWith(expected)) break;
      await wait(30);
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await wait(70);
  }

  async function captureOutputFrames() {
    const output = outputIndices();
    if (!output.length) throw new Error('Load at least one frame first.');

    const unique = [...new Set(output)].sort((a, b) => a - b);
    const captured = new Map();
    const viewFinal = $('view-final');
    const editorNext = $('editor-next');
    const openEditor = $('open-editor-btn');
    const canvas = $('frame-editor-canvas');

    openEditor?.click();
    viewFinal?.click();
    await waitForFrame(0);

    let current = 0;
    for (const target of unique) {
      while (current < target) {
        editorNext?.click();
        current += 1;
      }
      await waitForFrame(target);
      captured.set(target, duplicateCanvas(canvas));
    }

    return output.map((index) => captured.get(index)).filter(Boolean);
  }

  function estimatedFrameCount() {
    const base = outputIndices().length;
    if (!base) return 0;
    readEffects();
    let total = base;
    total += Math.max(0, base - 1) * effectState.inbetweens;
    total += effectState.loopBlend + effectState.holdFirst + effectState.holdLast;
    if (effectState.fadeIn) total += Math.max(0, effectState.fadeLevel - 1);
    if (effectState.fadeOut) total += Math.max(0, effectState.fadeLevel - 1);
    if (effectState.speedCurve !== 'linear') total += Math.ceil(base / 2);
    return total;
  }

  function refreshReadout() {
    readEffects();
    const estimate = estimatedFrameCount();
    const estimateNode = $('effects-frame-estimate');
    const fadeSummary = $('effects-fade-summary');
    const fadeValue = $('effect-fade-level-value');
    if (estimateNode) estimateNode.textContent = `Generated frames: ${estimate || '—'}`;
    if (fadeValue) fadeValue.textContent = effectState.fadeLevel;
    if (fadeSummary) {
      const parts = [];
      if (effectState.fadeIn) parts.push('IN');
      if (effectState.fadeOut) parts.push('OUT');
      fadeSummary.textContent = parts.length ? `${parts.join(' + ')} · LEVEL ${effectState.fadeLevel}` : 'No fade';
    }
    ['pulse', 'shake', 'bob', 'trail', 'strobe'].forEach((name) => {
      const slider = $(`effect-${name}`);
      const value = slider?.parentElement?.querySelector('b');
      if (slider && value) value.textContent = slider.value;
    });
  }

  async function previewEffects() {
    const modal = $('anim-preview-modal');
    const image = $('anim-modal-img');
    const loading = $('anim-loading');
    if (!modal || !image || !loading) return;

    const run = ++previewRun;
    clearTimeout(previewTimer);
    modal.hidden = false;
    loading.hidden = false;
    image.hidden = true;

    try {
      const baseFrames = await captureOutputFrames();
      if (run !== previewRun) return;
      const frames = applyEffects(baseFrames);
      if (!frames.length) throw new Error('No renderable frames.');

      loading.hidden = true;
      image.hidden = false;
      let cursor = 0;
      const baseDelay = Number($('frame-delay')?.value || 100);
      const approximateDelay = Math.max(20, Math.round(baseDelay * baseFrames.length / frames.length));
      const tick = () => {
        if (run !== previewRun || modal.hidden) return;
        image.src = frames[cursor].toDataURL('image/png');
        cursor = (cursor + 1) % frames.length;
        previewTimer = window.setTimeout(tick, approximateDelay);
      };
      tick();
    } catch (error) {
      loading.hidden = false;
      loading.textContent = `PREVIEW ERROR: ${error.message}`;
    }
  }

  async function compileEffects() {
    const compile = $('compile-btn');
    const outputCard = $('output-card');
    const viewport = $('compiled-viewport');
    const download = $('download-anchor');
    const canvas = $('frame-editor-canvas');
    if (!compile || !outputCard || !viewport || !download || !canvas || typeof gifshot === 'undefined') return;

    compile.disabled = true;
    compile.textContent = 'PROCESSING EFFECTS...';
    outputCard.hidden = false;
    viewport.innerHTML = '<div class="loader"></div>';

    try {
      const baseFrames = await captureOutputFrames();
      const frames = applyEffects(baseFrames);
      if (frames.length < 2) throw new Error('At least two frames are needed.');
      const dim = Number($('max-dimension')?.value || canvas.width || 480);
      const baseDelay = Number($('frame-delay')?.value || 100);
      const interval = Math.max(.02, baseDelay * baseFrames.length / frames.length / 1000);
      const lossy = $('opt-lossy')?.value;
      const sampleInterval = lossy === 'high' ? 30 : lossy === 'low' ? 20 : 10;
      const images = frames.map((frame) => frame.toDataURL('image/png'));

      gifshot.createGIF({ images, interval, gifWidth: dim, gifHeight: dim, sampleInterval, numWorkers: 2 }, (result) => {
        compile.disabled = false;
        compile.textContent = 'MAKE & SAVE ANIMATION';
        if (result.error) {
          viewport.innerHTML = '<p class="help-text">ENGINE FAILURE: Unable to compile effects.</p>';
          return;
        }
        viewport.innerHTML = `<img src="${result.image}" alt="Compiled animation with effects">`;
        download.href = result.image;
        download.download = `${($('seq-name')?.value || 'animation-export').trim() || 'animation-export'}-effects.gif`;
        download.click();
      });
    } catch (error) {
      compile.disabled = false;
      compile.textContent = 'MAKE & SAVE ANIMATION';
      viewport.innerHTML = `<p class="help-text">ERROR: ${error.message}</p>`;
    }
  }

  async function zipEffects() {
    const zipButton = $('zip-btn');
    if (!zipButton || typeof JSZip === 'undefined') return;

    zipButton.disabled = true;
    zipButton.textContent = 'PACKAGING EFFECTS...';
    try {
      const baseFrames = await captureOutputFrames();
      const frames = applyEffects(baseFrames);
      const zip = new JSZip();
      const safeName = ($('seq-name')?.value || 'animation-export').trim() || 'animation-export';
      const folder = zip.folder(`${safeName}-effects`);
      const digits = Math.max(3, String(frames.length).length);
      for (let index = 0; index < frames.length; index += 1) {
        const blob = await new Promise((resolve) => frames[index].toBlob(resolve, 'image/png'));
        folder.file(`frame-${String(index + 1).padStart(digits, '0')}.png`, blob);
      }
      const result = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(result);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeName}-effects-frames.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      setStatus('Effect-processed PNG frames downloaded as ZIP.');
    } catch (error) {
      setStatus(`Effect ZIP failed: ${error.message}`);
    }
    zipButton.disabled = false;
    zipButton.textContent = 'DOWNLOAD FRAMES ZIP';
  }

  function bindEvents() {
    const card = $(effectsCardId);
    if (!card) return;

    card.querySelectorAll('select, input').forEach((control) => {
      control.addEventListener('input', refreshReadout);
      control.addEventListener('change', refreshReadout);
    });

    $('effects-preview')?.addEventListener('click', previewEffects);
    $('effects-reset')?.addEventListener('click', () => {
      $('effect-inbetweens').value = '0';
      $('effect-loop-blend').value = '0';
      $('effect-speed-curve').value = 'linear';
      $('effect-fade-in').checked = false;
      $('effect-fade-out').checked = false;
      $('effect-fade-level').value = '3';
      $('effect-hold-first').value = '0';
      $('effect-hold-last').value = '0';
      ['pulse', 'shake', 'bob', 'trail', 'strobe'].forEach((name) => { $(`effect-${name}`).value = '0'; });
      refreshReadout();
    });

    document.addEventListener('click', (event) => {
      const button = event.target.closest('#btn-play-preview, #compile-btn, #zip-btn');
      if (!button || !effectsActive()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.id === 'btn-play-preview') previewEffects();
      if (button.id === 'compile-btn') compileEffects();
      if (button.id === 'zip-btn') zipEffects();
    }, true);

    document.querySelectorAll('#anim-preview-modal [data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        previewRun += 1;
        clearTimeout(previewTimer);
      }, true);
    });
  }

  const card = showCard();
  if (!card) return;
  bindEvents();
  refreshReadout();
})();
