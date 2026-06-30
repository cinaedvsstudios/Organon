(() => {
  'use strict';
  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const { state } = E;
  const previewButton = document.getElementById('ag-preview');
  const outputHost = document.getElementById('ag-output-preview');

  E.stopPreview = () => {
    if (state.previewTimer) window.clearTimeout(state.previewTimer);
    state.previewTimer = null;
    outputHost.innerHTML = '<span>OUTPUT PREVIEW</span>';
    previewButton.textContent = 'PLAY PREVIEW';
  };

  E.preview = async () => {
    if (state.previewTimer) {
      E.stopPreview();
      E.status('Preview stopped.');
      return;
    }

    const frames = await E.outputFrames();
    if (!frames.length) return E.status('Import frames before previewing.');
    outputHost.innerHTML = '';
    const image = document.createElement('img');
    outputHost.appendChild(image);
    previewButton.textContent = 'STOP PREVIEW';

    let index = 0;
    const delay = E.frameDelay(frames.length);
    const tick = () => {
      if (!state.previewTimer || !outputHost.isConnected) return;
      image.src = frames[index].toDataURL('image/png');
      index = (index + 1) % frames.length;
      state.previewTimer = window.setTimeout(tick, delay);
    };

    state.previewTimer = -1;
    tick();
    E.status(`Previewing ${frames.length} composited frames.`);
  };
})();