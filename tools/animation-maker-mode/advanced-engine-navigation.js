(() => {
  'use strict';

  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const { state, $ } = E;

  const step = (amount) => {
    const group = E.group();
    if (!group?.frames.length) return;
    const index = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
    const next = (index + amount + group.frames.length) % group.frames.length;
    state.activeFrameId = group.frames[next].id;
    state.timelineIndex = next;
    state.editCache = null;
    E.renderAll();
  };

  $('ag-prev').addEventListener('click', () => step(-1));
  $('ag-next').addEventListener('click', () => step(1));

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
      E.renderCanvas();
    });
  });

  $('ag-play').addEventListener('click', () => {
    if (state.playTimer) {
      window.clearInterval(state.playTimer);
      state.playTimer = null;
      $('ag-play').textContent = '▶ PLAY';
      return;
    }

    $('ag-play').textContent = '❚❚ PAUSE';
    state.playTimer = window.setInterval(() => step(1), Number($('ag-delay').value));
  });
})();
