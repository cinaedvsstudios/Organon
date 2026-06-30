(() => {
  'use strict';
  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const { state } = E;
  const frameCount = () => Math.max(0, ...state.groups.map((group) => group.frames.length));
  const originalRender = E.renderCanvas;
  const originalStepButtons = [document.getElementById('ag-prev'), document.getElementById('ag-next')];

  originalStepButtons.forEach((button) => button.replaceWith(button.cloneNode(true)));
  const previous = document.getElementById('ag-prev');
  const next = document.getElementById('ag-next');
  const play = document.getElementById('ag-play');
  const replacementPlay = play.cloneNode(true);
  play.replaceWith(replacementPlay);

  const setTimelineFrame = (amount) => {
    const group = E.group();
    if (!group?.frames.length) return;

    if (state.view === 'final') {
      const total = frameCount();
      if (!total) return;
      state.timelineIndex = (state.timelineIndex + amount + total) % total;
      const activeFrame = group.frames[state.timelineIndex % group.frames.length];
      state.activeFrameId = activeFrame.id;
    } else {
      const index = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
      const nextIndex = (index + amount + group.frames.length) % group.frames.length;
      state.activeFrameId = group.frames[nextIndex].id;
      state.timelineIndex = nextIndex;
    }

    state.editCache = null;
    E.renderAll();
  };

  previous.addEventListener('click', () => setTimelineFrame(-1));
  next.addEventListener('click', () => setTimelineFrame(1));
  replacementPlay.addEventListener('click', () => {
    if (state.playTimer) {
      window.clearInterval(state.playTimer);
      state.playTimer = null;
      replacementPlay.textContent = '▶ PLAY';
      return;
    }
    replacementPlay.textContent = '❚❚ PAUSE';
    state.playTimer = window.setInterval(() => setTimelineFrame(1), Number(document.getElementById('ag-delay').value));
  });

  E.renderCanvas = async () => {
    await originalRender();
    if (state.view !== 'final') return;
    const group = E.group();
    const total = frameCount();
    const label = document.getElementById('ag-frame-label');
    const status = document.getElementById('ag-editor-status');
    if (!group || !total || !label || !status) return;
    label.textContent = `TIMELINE FRAME ${state.timelineIndex + 1} / ${total}`;
    status.textContent = `ACTIVE: ${group.name.toUpperCase()} · LAYER ${group.layer} · ${group.blend.toUpperCase()}`;
  };
})();