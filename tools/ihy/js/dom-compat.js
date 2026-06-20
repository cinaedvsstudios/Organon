(() => {
  'use strict';
  const create = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'hidden') node.hidden = true;
      else node.setAttribute(key, value);
    });
    if (text) node.textContent = text;
    return node;
  };
  const makeModal = ({ id, title, wide = false, body = [], footer = [] }) => {
    const layer = document.querySelector(`#${id}`);
    if (!layer) return;
    layer.className = 'modal-layer';
    layer.hidden = true;
    layer.replaceChildren();
    const card = create('section', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true' });
    const header = create('header', { class: 'modal-header' });
    header.append(create('h3', { id: `${id}-heading` }, title));
    header.append(create('button', { type: 'button', 'data-close': id }, 'Close'));
    const content = create('div', { class: 'modal-body' });
    body.forEach(node => content.append(node));
    card.append(header, content);
    if (footer.length) {
      const actions = create('footer', { class: 'modal-footer' });
      footer.forEach(node => actions.append(node));
      card.append(actions);
    }
    layer.append(card);
  };
  const quickTitle = create('h3', { id: 'quickTitle' }, 'Quick action');
  const quickText = create('p', { id: 'quickText' });
  makeModal({ id: 'quickModal', title: 'Quick action', body: [quickText] });
  const quickHeading = document.querySelector('#quickModal-heading');
  if (quickHeading) quickHeading.replaceWith(quickTitle);

  const renameField = create('label', { class: 'modal-field' }, 'Name');
  renameField.append(create('input', { id: 'renameInput', type: 'text' }));
  makeModal({ id: 'renameModal', title: 'Rename track', body: [renameField],
    footer: [create('button', { id: 'renameConfirm', type: 'button', class: 'button primary' }, 'Apply')] });

  makeModal({ id: 'analysisModal', title: 'Open project analysis', wide: true,
    body: [create('textarea', { id: 'analysisText', class: 'analysis-text', spellcheck: 'false' })],
    footer: [create('button', { id: 'copyAnalysis', type: 'button', class: 'button' }, 'Copy analysis')] });

  const formats = create('div', { id: 'exportFormats', class: 'format-grid' });
  [['json', 'Ihy JSON'], ['midi', 'MIDI'], ['wav', 'WAV'], ['mp3', 'MP3']].forEach(([value,label], index) => {
    const choice = create('label', { class: 'format-choice' });
    const input = create('input', { type: 'radio', name: 'exportFormat', value });
    input.checked = index === 0;
    choice.append(input, create('span', {}, label));
    formats.append(choice);
  });
  const description = create('p', { id: 'exportDescription', class: 'export-description' });
  const rateField = create('label', { class: 'modal-field' }, 'Reference mix sample rate');
  const rate = create('select', { id: 'exportSampleRate' });
  [['44100', '44.1 kHz'], ['48000', '48 kHz']].forEach(([value,label], index) => {
    const option=create('option', {value}, label); option.selected=index===0; rate.append(option);
  });
  rateField.append(rate);
  const bitrateField = create('label', { id: 'bitrateOption', class: 'modal-field', hidden: '' }, 'MP3 bitrate');
  const bitrate = create('select', { id: 'exportBitrate' });
  [['128','128 kbps'],['192','192 kbps'],['256','256 kbps'],['320','320 kbps']].forEach(([value,label]) => {
    const option=create('option',{value},label); option.selected=value==='192'; bitrate.append(option);
  });
  bitrateField.append(bitrate);
  const include = create('label', { class: 'export-check' });
  include.append(create('input', { id: 'includeMuted', type: 'checkbox' }), document.createTextNode('Include muted tracks in MIDI/reference export'));
  const exportStatus = create('p', { id: 'exportStatus', class: 'export-description' });
  makeModal({ id: 'exportModal', title: 'Export composition', body: [formats, description, rateField, bitrateField, include, exportStatus],
    footer: [create('button', { id: 'doExport', type: 'button', class: 'button primary' }, 'Export file')] });

  const bass = document.querySelector('#bassModal');
  if (bass) {
    bass.dataset.modalOwner='bass-generator';
    bass.querySelector('#bassModalHeader')?.classList.add('bass-modal-header');
    bass.querySelector('#bassResizeGrip')?.classList.add('bass-modal-resize-grip');
    bass.querySelectorAll('.bass-phrase').forEach(button => button.classList.add('bass-choice'));
    ['bassSustain','bassEcho','bassChords'].forEach(id => bass.querySelector(`#${id}`)?.classList.add('bass-transform'));
    bass.querySelectorAll('button').forEach(button => button.type='button');
  }
})();