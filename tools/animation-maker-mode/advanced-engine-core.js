(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const root = document.querySelector('.app-wrapper');
  if (!root) return;

  root.innerHTML = `
    <div class="ag-app">
      <header class="ag-top">
        <div class="ag-brand">ANIMATION MAKER — ADVANCED</div>
        <div class="ag-top-file-name" id="ag-export-name-slot"></div>
        <button class="ag-btn" id="ag-mode-switch">STANDARD MODE</button>
        <div class="ag-top-spacer"></div>
        <div class="ag-top-actions" aria-label="Animation actions">
          <button class="ag-btn" id="ag-preview">PLAY PREVIEW</button>
          <button class="ag-btn" id="ag-zip">DOWNLOAD PNG ZIP</button>
          <button class="ag-btn primary" id="ag-export">MAKE &amp; SAVE ANIMATION</button>
        </div>
      </header>

      <main class="ag-main">
        <section class="ag-card ag-card-groups">
          <div class="ag-card-head"><h2>1. Frames &amp; Groups</h2></div>
          <div class="ag-card-body">
            <div class="ag-toolbar">
              <button class="ag-btn primary" id="ag-new-group">CREATE NEW GROUP</button>
            </div>
            <input
              id="ag-import"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov"
              multiple
              hidden
            >
            <div class="ag-groups" id="ag-groups"></div>
          </div>
        </section>

        <section class="ag-card ag-card-editor">
          <div class="ag-card-head"><h2>2. Frame Editor</h2></div>
          <div class="ag-card-body">
            <div class="ag-editor-nav" aria-label="Frame editor controls">
              <button class="ag-btn" id="ag-prev" aria-label="Previous frame">◀</button>
              <span id="ag-frame-label">NO FRAME</span>
              <button class="ag-btn" id="ag-next" aria-label="Next frame">▶</button>
              <button class="ag-btn" id="ag-play">▶ PLAY</button>
              <button class="ag-btn active" data-view="final">FINAL COMPOSITE</button>
              <button class="ag-btn" data-view="original">ORIGINAL</button>
              <span class="ag-nav-divider" aria-hidden="true"></span>
              <button class="ag-btn active" data-mode="edit">EDIT</button>
              <button class="ag-btn" data-mode="paint">PAINT</button>
              <button class="ag-btn" data-mode="select">SELECT</button>
              <button class="ag-btn" data-mode="effects">EFFECTS</button>
              <button class="ag-btn" data-mode="animations">ANIMATIONS</button>
              <span class="ag-editor-status" id="ag-editor-status"></span>
            </div>

            <div class="ag-editor-panels">
              <div class="ag-panel ag-inline-panel" id="ag-edit-panel">
                <button class="ag-btn" id="ag-copy">COPY</button>
                <button class="ag-btn" id="ag-paste">PASTE INTO FRAME</button>
                <button class="ag-btn" id="ag-paste-new">PASTE AS NEW FRAME</button>
                <button class="ag-btn" id="ag-clear">CLEAR</button>
                <button class="ag-btn" id="ag-scale">SCALE</button>
                <button class="ag-btn" id="ag-rotate">ROTATE</button>
                <button class="ag-btn" id="ag-undo">UNDO</button>
                <button class="ag-btn" id="ag-realign">REALIGN</button>
              </div>

              <div class="ag-panel ag-inline-panel ag-hidden" id="ag-paint-panel">
                <label class="ag-control">Brush Colour<input id="ag-brush-colour" type="color" value="#00ff00"></label>
                <label class="ag-control"><label>Brush Size <output id="ag-brush-size-output">18 px</output></label><input id="ag-brush-size" type="range" min="1" max="100" value="18"></label>
                <label class="ag-check-control"><input id="ag-eraser" type="checkbox"> Erase instead of paint</label>
              </div>

              <div class="ag-panel ag-inline-panel ag-hidden" id="ag-select-panel">
                <button class="ag-btn" id="ag-select-toggle">DRAW / MOVE SELECTION</button>
                <button class="ag-btn" id="ag-select-clear">CLEAR SELECTION</button>
              </div>

              <div class="ag-panel ag-inline-panel ag-hidden" id="ag-effects-panel">
                <div class="ag-effect-grid" id="ag-effect-controls"></div>
                <div class="ag-check-list" id="ag-effect-targets"></div>
                <div class="ag-panel-actions">
                  <button class="ag-btn primary" id="ag-effect-apply">APPLY TO SELECTED GROUPS</button>
                  <button class="ag-btn" id="ag-effect-reset">RESET DRAFT</button>
                </div>
              </div>

              <div class="ag-panel ag-inline-panel ag-hidden" id="ag-animation-panel">
                <label class="ag-control">Animation Type<select class="ag-select" id="ag-animation-type"><option value="pulse-brightness">Pulse Brightness</option><option value="pulse-size">Pulse Size</option><option value="rotate">Rotate</option><option value="hue-shift">Hue Shift</option><option value="opacity-pulse">Opacity Pulse</option><option value="float">Float / Bob</option><option value="shake">Shake / Jitter</option><option value="breathing">Breathing</option><option value="motion-trail">Motion Trail</option><option value="overlay-layer" disabled>Overlay Layer — Coming Next</option></select></label>
                <label class="ag-control"><label>Strength <output id="ag-animation-strength-output">5</output></label><input id="ag-animation-strength" type="range" min="1" max="10" value="5"></label>
                <label class="ag-control">Direction<select class="ag-select" id="ag-animation-direction"><option value="forward">Forward</option><option value="reverse">Reverse</option><option value="clockwise">Clockwise</option><option value="counterclockwise">Counter-clockwise</option></select></label>
                <label class="ag-control"><label>Duration <output id="ag-animation-duration-output">8 frames</output></label><input id="ag-animation-duration" type="range" min="1" max="20" value="8"></label>
                <div class="ag-check-list" id="ag-animation-targets"></div>
                <button class="ag-btn primary" id="ag-animation-generate">GENERATE NEW FRAMES</button>
              </div>
            </div>

            <div class="ag-canvas-wrap" id="ag-canvas-wrap">
              <canvas class="ag-canvas" id="ag-canvas"></canvas>
              <div class="ag-select-box" id="ag-selection-box" hidden></div>
            </div>
            <div class="ag-transform" id="ag-transform" hidden>
              <b id="ag-transform-title">TRANSFORM</b>
              <input id="ag-transform-slider" type="range">
              <output id="ag-transform-output">0</output>
              <button class="ag-btn primary" id="ag-transform-apply">APPLY</button>
              <button class="ag-btn" id="ag-transform-cancel">CANCEL</button>
            </div>
          </div>
        </section>

        <section class="ag-card ag-output">
          <div class="ag-card-head"><h2>3. Visual &amp; Output Effects</h2></div>
          <div class="ag-card-body">
            <div class="ag-settings">
              <div class="ag-wide"><h3>Animation-wide effects</h3></div>
              <label class="ag-control">Output Format<select class="ag-select" id="ag-format"><option value="gif">GIF (Animated)</option><option value="webp">WebP (Animated)</option></select></label>
              <label class="ag-control"><label>Frame Duration <output id="ag-delay-output">200 ms</output></label><input id="ag-delay" type="range" min="40" max="1000" step="10" value="200"></label>
              <label class="ag-control"><label>Output Size <output id="ag-size-output">480 px</output></label><input id="ag-size" type="range" min="160" max="1600" step="10" value="480"></label>
              <label class="ag-control"><label>In-between Frames <output id="ag-between-output">0</output></label><input id="ag-between" type="range" min="0" max="3" value="0"></label>
              <label class="ag-control"><label>Loop Blend <output id="ag-loop-output">0</output></label><input id="ag-loop" type="range" min="0" max="10" value="0"></label>
              <label class="ag-control"><label>Hold First <output id="ag-hold-first-output">0</output></label><input id="ag-hold-first" type="range" min="0" max="20" value="0"></label>
              <label class="ag-control"><label>Hold Last <output id="ag-hold-last-output">0</output></label><input id="ag-hold-last" type="range" min="0" max="20" value="0"></label>
              <label class="ag-check-control"><input id="ag-fade-in" type="checkbox"> Fade In</label>
              <label class="ag-check-control"><input id="ag-fade-out" type="checkbox"> Fade Out</label>
              <label class="ag-control"><label>Fade Level <output id="ag-fade-output">3</output></label><input id="ag-fade" type="range" min="1" max="20" value="3"></label>
              <label class="ag-control">Speed Curve<select class="ag-select" id="ag-speed"><option value="linear">Linear</option><option value="ease-in">Ease In</option><option value="ease-out">Ease Out</option><option value="ease-in-out">Ease In / Out</option></select></label>
              <label class="ag-control"><label>Opacity Pulse <output id="ag-pulse-output">0</output></label><input id="ag-pulse" type="range" min="0" max="10" value="0"></label>
              <label class="ag-control"><label>Shake <output id="ag-shake-output">0</output></label><input id="ag-shake" type="range" min="0" max="10" value="0"></label>
              <label class="ag-control"><label>Float <output id="ag-float-output">0</output></label><input id="ag-float" type="range" min="0" max="20" value="0"></label>
              <label class="ag-control"><label>Motion Trail <output id="ag-trail-output">0</output></label><input id="ag-trail" type="range" min="0" max="10" value="0"></label>
              <div class="ag-wide ag-preview" id="ag-output-preview"><span>OUTPUT PREVIEW</span></div>
              <div class="ag-wide ag-status" id="ag-status"></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;

  const $ = (id) => document.getElementById(id);
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const makeCanvas = (width, height = width) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  };
  const defaults = () => ({ brightness: 100, contrast: 100, exposure: 0, hue: 0, saturation: 100, temperature: 0, tint: 0, opacity: 100, blur: 0, sharpen: 0, grayscale: 0, sepia: 0, invert: 0 });

  const E = window.OrganonAnimationAdvanced = {
    $,
    clamp,
    uid,
    copy,
    makeCanvas,
    defaults,
    state: {
      groups: [],
      activeGroupId: null,
      activeFrameId: null,
      importTargetId: null,
      timelineIndex: 0,
      view: 'final',
      mode: 'edit',
      draft: defaults(),
      effectTargets: new Set(),
      animationTargets: new Set(),
      images: new Map(),
      history: [],
      historyIndex: -1,
      selection: { enabled: false, active: false, dragging: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0, lastX: 0, lastY: 0 },
      transform: null,
      paint: null,
      renderToken: 0,
      previewTimer: null,
      playTimer: null
    }
  };

  E.status = (text) => {
    $('ag-status').textContent = text;
    window.clearTimeout(E.status.timer);
    E.status.timer = window.setTimeout(() => { $('ag-status').textContent = ''; }, 4300);
  };

  E.group = (id = E.state.activeGroupId) => E.state.groups.find((group) => group.id === id) || E.state.groups[0] || null;
  E.frame = (group = E.group()) => group?.frames.find((frame) => frame.id === E.state.activeFrameId) || group?.frames[0] || null;
  E.layers = () => [...E.state.groups].sort((left, right) => left.layer - right.layer);
  E.totalFrames = () => E.state.groups.reduce((total, group) => total + group.frames.length, 0);
  E.isImageFile = (file) => file?.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file?.name || '');
  E.isVideoFile = (file) => file?.type?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file?.name || '');

  E.addGroup = (name, options = {}) => {
    const group = {
      id: uid('group'),
      name: name || `Group ${E.state.groups.length + 1}`,
      layer: options.layer || E.state.groups.length + 1,
      blend: options.blend || 'source-over',
      effects: copy(options.effects || defaults()),
      frames: options.frames || []
    };
    E.state.groups.push(group);
    E.normalize();
    E.state.activeGroupId = group.id;
    E.state.activeFrameId = group.frames[0]?.id || null;
    return group;
  };

  E.normalize = () => {
    E.state.groups.sort((left, right) => left.layer - right.layer);
    E.state.groups.forEach((group, index) => { group.layer = index + 1; });
  };

  E.setActive = (groupId, frameId) => {
    const group = E.group(groupId);
    if (!group) return;
    E.state.activeGroupId = group.id;
    E.state.activeFrameId = frameId || group.frames.find((frame) => frame.id === E.state.activeFrameId)?.id || group.frames[0]?.id || null;
    E.state.timelineIndex = Math.max(0, group.frames.findIndex((frame) => frame.id === E.state.activeFrameId));
    E.state.draft = copy(group.effects);
    E.state.effectTargets.add(group.id);
    E.state.animationTargets.add(group.id);
    E.renderAll();
  };

  E.openImportPicker = (groupId = E.state.activeGroupId) => {
    const group = E.group(groupId);
    const input = $('ag-import');
    if (!group || !input) return E.status('The media importer is unavailable.');
    E.state.importTargetId = group.id;
    E.setActive(group.id);
    input.value = '';
    input.click();
  };

  E.image = (source) => {
    if (E.state.images.has(source)) return E.state.images.get(source);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image could not be loaded.'));
      image.src = source;
    });
    E.state.images.set(source, promise);
    return promise;
  };

  E.readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  E.framesFrom = async (files) => {
    const frames = [];
    for (const file of [...files].filter(E.isImageFile)) {
      const source = await E.readFile(file);
      const image = await E.image(source);
      frames.push({
        id: uid('frame'),
        name: file.name,
        source,
        working: source,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        offsetX: 0,
        offsetY: 0
      });
    }
    return frames;
  };

  E.importImages = async (files, groupId = E.state.activeGroupId) => {
    const items = [...files].filter(E.isImageFile);
    if (!items.length) return E.status('No image files were found.');
    let group = E.group(groupId);
    if (!group) group = E.addGroup('Group 1');
    E.status(`Importing ${items.length} frame${items.length === 1 ? '' : 's'}...`);
    const frames = await E.framesFrom(items);
    group.frames.push(...frames);
    E.state.activeGroupId = group.id;
    E.state.activeFrameId = frames[0]?.id || E.state.activeFrameId;
    E.state.effectTargets.add(group.id);
    E.state.animationTargets.add(group.id);
    E.status(`${frames.length} frame${frames.length === 1 ? '' : 's'} added to ${group.name}.`);
    E.renderAll();
  };

  E.addGroup('Group 1');
})();
