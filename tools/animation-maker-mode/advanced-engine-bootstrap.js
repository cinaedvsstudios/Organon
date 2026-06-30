(() => {
  'use strict';

  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const { state, $, makeCanvas, uid } = E;

  const name = document.createElement('input');
  name.id = 'ag-export-name';
  name.className = 'ag-input';
  name.value = 'animation-export';
  name.placeholder = 'EXPORT NAME';
  name.setAttribute('aria-label', 'Export filename');
  $('ag-export-name-slot')?.appendChild(name);

  E.exportName = () => (
    (name.value || 'animation-export')
      .trim()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/-+/g, '-') || 'animation-export'
  );

  const importImages = E.importImages;
  E.importImages = async (files, ...args) => {
    const empty = E.totalFrames() === 0;
    const first = [...files][0];
    const result = await importImages(files, ...args);
    if (empty && first) name.value = (first.name || 'animation-export').replace(/\.[^.]+$/, '') || 'animation-export';
    return result;
  };

  const drawFrame = E.canvasFor;
  E.canvasFor = async (frame, group, options = {}) => (
    options.ignoreOffset
      ? drawFrame({ ...frame, offsetX: 0, offsetY: 0 }, group, options)
      : drawFrame(frame, group, options)
  );

  E.editable = async () => {
    const group = E.group();
    const frame = E.frame(group);
    if (!group || !frame) return null;
    const key = `${group.id}:${frame.id}`;
    if (state.editCache?.key === key) return state.editCache.canvas;
    const image = await E.image(frame.working);
    const width = image.naturalWidth || image.width || frame.width || 1;
    const height = image.naturalHeight || image.height || frame.height || 1;
    const canvas = makeCanvas(width, height);
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    state.editCache = { key, canvas };
    return canvas;
  };

  E.renderAll = () => {
    E.renderGroups();
    if (state.mode === 'effects') E.renderEffects();
    if (state.mode === 'animations') E.renderAnimationTargets?.();
    E.renderCanvas();
  };

  E.importVideo = async (file, groupId = state.activeGroupId) => {
    if (!file) return;

    const group = E.group(groupId) || E.addGroup('Group 1');
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('The video could not be opened.'));
        video.load();
      });

      const fps = 12;
      const count = Math.max(1, Math.min(240, Math.floor(video.duration * fps)));
      const canvas = makeCanvas(video.videoWidth, video.videoHeight);
      const context = canvas.getContext('2d');
      const frames = [];
      const seek = (time) => new Promise((resolve) => {
        if (Math.abs(video.currentTime - time) < 0.0001) {
          requestAnimationFrame(resolve);
          return;
        }
        video.addEventListener('seeked', resolve, { once: true });
        video.currentTime = time;
      });

      if (E.totalFrames() === 0) name.value = file.name.replace(/\.[^.]+$/, '') || 'animation-export';
      E.status(`Extracting ${count} video frames...`);

      for (let index = 0; index < count; index += 1) {
        const time = Math.min(index / fps, Math.max(0, video.duration - 0.001));
        await seek(time);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0);
        const working = canvas.toDataURL('image/png');
        frames.push({
          id: uid('frame'),
          name: `${file.name} ${index + 1}`,
          source: working,
          working,
          width: canvas.width,
          height: canvas.height,
          offsetX: 0,
          offsetY: 0
        });
      }

      group.frames.push(...frames);
      state.activeGroupId = group.id;
      state.activeFrameId = frames[0]?.id || state.activeFrameId;
      state.effectTargets.add(group.id);
      state.animationTargets.add(group.id);
      E.status(`${frames.length} video frame${frames.length === 1 ? '' : 's'} added to ${group.name}.`);
      E.renderAll();
    } catch (error) {
      E.status(`Video extraction failed: ${error.message || 'Unknown error.'}`);
    } finally {
      URL.revokeObjectURL(url);
      video.remove();
    }
  };

  E.importMedia = async (files, groupId = state.importTargetId || state.activeGroupId) => {
    const items = [...files];
    const imageFiles = items.filter(E.isImageFile);
    const videoFiles = items.filter(E.isVideoFile);

    if (!imageFiles.length && !videoFiles.length) {
      E.status('Choose an image, animated GIF/WebP, or supported video file.');
      return;
    }

    try {
      if (imageFiles.length) await E.importImages(imageFiles, groupId);
      for (const file of videoFiles) await E.importVideo(file, groupId);
    } finally {
      state.importTargetId = null;
    }
  };

  const importInput = $('ag-import');
  importInput.addEventListener('change', async (event) => {
    const groupId = state.importTargetId || state.activeGroupId;
    try {
      await E.importMedia(event.target.files, groupId);
    } finally {
      event.target.value = '';
    }
  });

  document.addEventListener('paste', (event) => {
    if (document.activeElement?.matches('input,textarea,select')) return;
    if (E.frame() && ['edit', 'paint', 'select'].includes(state.mode)) return;
    const files = [...(event.clipboardData?.files || [])].filter(E.isImageFile);
    if (!files.length) return;
    event.preventDefault();
    E.importImages(files, state.activeGroupId);
  });

  E.renderAll();
})();
