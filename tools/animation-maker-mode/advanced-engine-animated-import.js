(() => {
  'use strict';
  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const input = document.getElementById('ag-import');
  if (input) input.accept = 'image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp';

  const isAnimated = (file) => /image\/(gif|webp)/i.test(file.type || '') || /\.(gif|webp)$/i.test(file.name || '');
  const typeFor = (file) => /\.gif$/i.test(file.name || '') || /image\/gif/i.test(file.type || '') ? 'image/gif' : 'image/webp';
  const baseName = (name) => String(name || 'imported-animation').replace(/\.(gif|webp)$/i, '');
  const median = (values) => {
    const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
    return ordered.length ? ordered[Math.floor(ordered.length / 2)] : 100;
  };

  const canDecode = async (type) => {
    if (typeof window.ImageDecoder !== 'function') return false;
    return typeof window.ImageDecoder.isTypeSupported !== 'function' || window.ImageDecoder.isTypeSupported(type);
  };

  const decodeAnimation = async (file) => {
    const type = typeFor(file);
    if (!(await canDecode(type))) throw new Error('This browser cannot extract animated GIF/WebP frames. Use a current Chrome or Edge browser.');
    const decoder = new ImageDecoder({ data: new Uint8Array(await file.arrayBuffer()), type, preferAnimation: true });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const count = Math.max(1, Number(track?.frameCount) || 1);
    const frames = [];
    const delays = [];
    const stem = baseName(file.name);

    try {
      for (let index = 0; index < count; index += 1) {
        E.status(`Extracting ${file.name}: frame ${index + 1} of ${count}...`);
        const result = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
        const bitmap = result.image;
        const width = bitmap.displayWidth || bitmap.codedWidth;
        const height = bitmap.displayHeight || bitmap.codedHeight;
        const canvas = E.makeCanvas(width, height);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
        const working = canvas.toDataURL('image/png');
        frames.push({
          id: E.uid('frame'),
          name: `${stem}-frame-${String(index + 1).padStart(4, '0')}.png`,
          source: working,
          working,
          width,
          height,
          offsetX: 0,
          offsetY: 0
        });
        delays.push(bitmap.duration ? Math.max(40, Math.round(bitmap.duration / 1000)) : 100);
        bitmap.close();
      }
    } finally {
      if (typeof decoder.close === 'function') decoder.close();
    }

    return { frames, delays };
  };

  E.importImages = async (files, groupId = E.state.activeGroupId) => {
    const items = [...files].filter((file) => file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name || ''));
    if (!items.length) return E.status('No image files were found.');

    let group = E.group(groupId);
    if (!group) group = E.addGroup('Group 1');
    const wasEmpty = E.totalFrames() === 0;
    const added = [];
    const importedDelays = [];

    try {
      for (const file of items) {
        if (isAnimated(file)) {
          const decoded = await decodeAnimation(file);
          added.push(...decoded.frames);
          importedDelays.push(...decoded.delays);
        } else {
          added.push(...await E.framesFrom([file]));
        }
      }
    } catch (error) {
      E.status(`Image import failed: ${error.message}`);
      return;
    }

    group.frames.push(...added);
    E.state.activeGroupId = group.id;
    E.state.activeFrameId = added[0]?.id || E.state.activeFrameId;
    E.state.effectTargets.add(group.id);
    E.state.animationTargets.add(group.id);

    if (wasEmpty && importedDelays.length) {
      const delay = Math.max(40, Math.min(1000, median(importedDelays)));
      const slider = document.getElementById('ag-delay');
      slider.value = String(delay);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    E.status(`${added.length} editable frame${added.length === 1 ? '' : 's'} added to ${group.name}.`);
    E.renderAll();
  };
})();