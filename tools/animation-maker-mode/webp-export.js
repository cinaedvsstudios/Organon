(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const encoder = new TextEncoder();
  let previewUrl = null;
  let previewToken = 0;

  const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const fourCC = (name) => encoder.encode(name);
  const readFourCC = (bytes, offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  const readU32 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24 >>> 0);
  const u16 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255]);
  const u24 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255]);
  const u32 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);

  function concat(parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function riffChunk(name, payload) {
    return concat([fourCC(name), u32(payload.length), payload, payload.length % 2 ? new Uint8Array([0]) : new Uint8Array()]);
  }

  function parseWebP(bytes) {
    if (readFourCC(bytes, 0) !== 'RIFF' || readFourCC(bytes, 8) !== 'WEBP') {
      throw new Error('The browser did not produce a WebP frame.');
    }

    const chunks = [];
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const name = readFourCC(bytes, offset);
      const size = readU32(bytes, offset + 4) >>> 0;
      const end = offset + 8 + size;
      if (end > bytes.length) throw new Error('Invalid WebP frame data.');
      chunks.push({
        name,
        payload: bytes.slice(offset + 8, end),
        raw: bytes.slice(offset, end + (size % 2))
      });
      offset = end + (size % 2);
    }
    return chunks;
  }

  async function canvasToFramePayload(canvas, quality) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP.');
    const chunks = parseWebP(new Uint8Array(await blob.arrayBuffer()));
    const frameChunks = chunks.filter((chunk) => ['ALPH', 'VP8 ', 'VP8L'].includes(chunk.name));
    if (!frameChunks.some((chunk) => chunk.name === 'VP8 ' || chunk.name === 'VP8L')) throw new Error('The WebP frame has no image data.');
    return {
      payload: concat(frameChunks.map((chunk) => chunk.raw)),
      alpha: frameChunks.some((chunk) => chunk.name === 'ALPH' || chunk.name === 'VP8L')
    };
  }

  async function createAnimatedWebP(frames, options = {}) {
    if (!frames?.length) throw new Error('No frames are available for WebP export.');

    const width = frames[0].width;
    const height = frames[0].height;
    if (!width || !height || width > 0x1000000 || height > 0x1000000) throw new Error('Unsupported WebP canvas dimensions.');
    if (frames.some((frame) => frame.width !== width || frame.height !== height)) throw new Error('All WebP frames must use the same dimensions.');

    const quality = Math.max(0, Math.min(1, Number(options.quality ?? .8)));
    const duration = Math.max(11, Math.min(0xFFFFFF, Math.round(Number(options.duration ?? 200))));
    const loop = Math.max(0, Math.min(65535, Math.round(Number(options.loop ?? 0))));
    const encodedFrames = [];
    let hasAlpha = false;

    for (const frame of frames) {
      const encoded = await canvasToFramePayload(frame, quality);
      encodedFrames.push(encoded);
      hasAlpha ||= encoded.alpha;
    }

    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x02 | (hasAlpha ? 0x10 : 0x00);
    vp8x.set(u24(width - 1), 4);
    vp8x.set(u24(height - 1), 7);

    const anim = concat([new Uint8Array([0, 0, 0, 0]), u16(loop)]);
    const frameChunks = encodedFrames.map((frame) => {
      const header = concat([
        u24(0),
        u24(0),
        u24(width - 1),
        u24(height - 1),
        u24(duration),
        new Uint8Array([0x02])
      ]);
      return riffChunk('ANMF', concat([header, frame.payload]));
    });

    const riffPayload = concat([fourCC('WEBP'), riffChunk('VP8X', vp8x), riffChunk('ANIM', anim), ...frameChunks]);
    return new Blob([concat([fourCC('RIFF'), u32(riffPayload.length), riffPayload])], { type: 'image/webp' });
  }

  function outputIndices() {
    const count = document.querySelectorAll('#frame-grid .frame-thumb-wrapper').length;
    const skip = Number($('adj-skip')?.value || 1);
    let indices = Array.from({ length: count }, (_, index) => index).filter((_, index) => index % skip === 0);
    if ($('chk-reverse')?.checked) indices = indices.reverse();
    if ($('chk-forverse')?.checked) indices = indices.concat([...indices].reverse());
    return indices;
  }

  function cloneCanvas(canvas) {
    const clone = document.createElement('canvas');
    clone.width = canvas.width;
    clone.height = canvas.height;
    clone.getContext('2d').drawImage(canvas, 0, 0);
    return clone;
  }

  async function waitForFrame(index) {
    const label = $('editor-frame-number');
    const target = `FRAME ${index + 1}`;
    const started = Date.now();
    while (Date.now() - started < 3500) {
      if (label?.textContent?.startsWith(target)) break;
      await delay(30);
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await delay(70);
  }

  async function captureProcessedFrames() {
    const sequence = outputIndices();
    if (!sequence.length) throw new Error('Load at least one frame first.');

    const editorButton = $('open-editor-btn');
    const next = $('editor-next');
    const finalView = $('view-final');
    const canvas = $('frame-editor-canvas');
    if (!editorButton || !next || !finalView || !canvas) throw new Error('The frame renderer is unavailable.');

    editorButton.click();
    finalView.click();
    await waitForFrame(0);

    const targets = [...new Set(sequence)].sort((a, b) => a - b);
    const captured = new Map();
    let current = 0;
    for (const target of targets) {
      while (current < target) {
        next.click();
        current += 1;
      }
      await waitForFrame(target);
      captured.set(target, cloneCanvas(canvas));
    }

    return sequence.map((index) => captured.get(index)).filter(Boolean);
  }

  function getQuality() {
    if ($('chk-webp-lossless')?.checked) return 1;
    return Math.max(0, Math.min(1, Number($('adj-webp-q')?.value || 80) / 100));
  }

  function getLoopCount() {
    return Math.max(0, Math.min(65535, Number($('play-count')?.value || 0)));
  }

  function safeName() {
    return ($('seq-name')?.value || 'animation-export').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-') || 'animation-export';
  }

  function activeEffects() {
    const card = $('animation-effects-card');
    if (!card) return false;
    return Number($('effect-inbetweens')?.value || 0) > 0 ||
      Boolean($('effect-fade-in')?.checked) ||
      Boolean($('effect-fade-out')?.checked) ||
      Number($('effect-loop-blend')?.value || 0) > 0 ||
      Number($('effect-hold-first')?.value || 0) > 0 ||
      Number($('effect-hold-last')?.value || 0) > 0 ||
      ($('effect-speed-curve')?.value || 'linear') !== 'linear' ||
      ['pulse', 'shake', 'bob', 'trail', 'strobe'].some((name) => Number($(`effect-${name}`)?.value || 0) > 0);
  }

  function ensureWebPOption() {
    const format = $('opt-format');
    if (!format || format.querySelector('option[value="webp"]')) return;
    const option = document.createElement('option');
    option.value = 'webp';
    option.textContent = 'WebP (Animated)';
    format.appendChild(option);
  }

  async function exportWebP() {
    const button = $('compile-btn');
    const outputCard = $('output-card');
    const viewport = $('compiled-viewport');
    const anchor = $('download-anchor');
    if (!button || !outputCard || !viewport || !anchor) return;

    button.disabled = true;
    button.textContent = 'ENCODING WEBP...';
    outputCard.hidden = false;
    viewport.innerHTML = '<div class="loader"></div>';

    try {
      const frames = await captureProcessedFrames();
      if (frames.length < 2) throw new Error('At least two frames are needed for an animation.');
      const blob = await createAnimatedWebP(frames, {
        duration: Number($('frame-delay')?.value || 200),
        quality: getQuality(),
        loop: getLoopCount()
      });
      const url = URL.createObjectURL(blob);
      viewport.innerHTML = '';
      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Compiled animated WebP';
      viewport.appendChild(image);
      anchor.href = url;
      anchor.download = `${safeName()}.webp`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (error) {
      viewport.innerHTML = `<p class="help-text">WEBP ERROR: ${error.message}</p>`;
    }

    button.disabled = false;
    button.textContent = 'MAKE & SAVE ANIMATION';
  }

  async function previewWebP() {
    const modal = $('anim-preview-modal');
    const image = $('anim-modal-img');
    const loading = $('anim-loading');
    if (!modal || !image || !loading) return;

    const token = ++previewToken;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    modal.hidden = false;
    loading.hidden = false;
    image.hidden = true;

    try {
      const frames = await captureProcessedFrames();
      if (token !== previewToken) return;
      const blob = await createAnimatedWebP(frames, {
        duration: Number($('frame-delay')?.value || 200),
        quality: getQuality(),
        loop: getLoopCount()
      });
      previewUrl = URL.createObjectURL(blob);
      loading.hidden = true;
      image.hidden = false;
      image.src = previewUrl;
    } catch (error) {
      loading.textContent = `WEBP PREVIEW ERROR: ${error.message}`;
    }
  }

  function initialise() {
    ensureWebPOption();

    document.addEventListener('click', (event) => {
      const button = event.target.closest('#compile-btn, #btn-play-preview');
      if (!button || $('opt-format')?.value !== 'webp' || activeEffects()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.id === 'compile-btn') exportWebP();
      else previewWebP();
    }, true);

    document.querySelectorAll('#anim-preview-modal [data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        previewToken += 1;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }, true);
    });
  }

  window.AnimationMakerWebP = {
    createAnimatedWebP,
    captureProcessedFrames,
    getQuality,
    getLoopCount,
    safeName
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise);
  else initialise();
})();
