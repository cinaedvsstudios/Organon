(() => {
  'use strict';
  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const settings = document.querySelector('.ag-settings');
  const preview = document.getElementById('ag-output-preview');
  if (!settings || !preview) return;

  const panel = document.createElement('div');
  panel.className = 'ag-wide ag-panel';
  panel.id = 'ag-sequence-controls';
  panel.innerHTML = '<h3>Sequence Sampling &amp; Direction</h3><div class="ag-effect-grid"><label class="ag-control">Frame Skip <output id="ag-sequence-skip-output">KEEP ALL</output><input id="ag-sequence-skip" type="range" min="1" max="10" value="1"></label><label><input id="ag-sequence-reverse" type="checkbox"> Reverse Sequence</label><label><input id="ag-sequence-forverse" type="checkbox"> Forward Then Backward</label></div>';
  preview.insertAdjacentElement('beforebegin', panel);

  const oldOutputFrames = E.outputFrames;
  E.outputFrames = async () => {
    const maximum = Math.max(0, ...E.state.groups.map((group) => group.frames.length));
    if (!maximum) return [];

    const skip = Number(document.getElementById('ag-sequence-skip').value);
    let indices = Array.from({ length: maximum }, (_, index) => index).filter((_, index) => index % skip === 0);
    if (document.getElementById('ag-sequence-reverse').checked) indices = indices.reverse();
    if (document.getElementById('ag-sequence-forverse').checked) indices = indices.concat([...indices].reverse());

    const frames = [];
    for (const index of indices) {
      const frame = await E.composite(index);
      if (frame) frames.push(frame);
    }
    return E.applyOutputEffects(frames);
  };

  const slider = document.getElementById('ag-sequence-skip');
  const label = document.getElementById('ag-sequence-skip-output');
  slider.addEventListener('input', () => {
    label.textContent = slider.value === '1' ? 'KEEP ALL' : `KEEP EVERY ${slider.value}TH`;
    E.renderCanvas();
  });
  ['ag-sequence-reverse', 'ag-sequence-forverse'].forEach((id) => document.getElementById(id).addEventListener('input', () => E.renderCanvas()));
})();