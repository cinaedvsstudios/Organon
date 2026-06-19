(() => {
  'use strict';

  const EXAMPLE_MIDI_BASE64 = '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';
  const HIDDEN_TRACKS_KEY = 'ihy-v026-hidden-track-names';
  const $ = selector => document.querySelector(selector);
  const hiddenTrackNames = new Set(JSON.parse(localStorage.getItem(HIDDEN_TRACKS_KEY) || '[]'));
  let centreC4AfterRender = true;
  let updateQueued = false;

  function persistHiddenTracks() {
    localStorage.setItem(HIDDEN_TRACKS_KEY, JSON.stringify([...hiddenTrackNames]));
  }

  function exactExampleBuffer() {
    const raw = atob(EXAMPLE_MIDI_BASE64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes.buffer;
  }

  function queueDecoration() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(() => {
      updateQueued = false;
      decorateRoll();
      decorateTracks();
    });
  }

  function decorateRoll() {
    const roll = $('#roll');
    const labels = $('#labels');
    const scroll = $('#rollScroll');
    if (!roll || !labels || !scroll) return;

    [...labels.children].forEach((label, index) => {
      const pitch = 84 - index;
      if (pitch % 12 !== 0) return;
      label.style.background = 'rgba(66,215,230,.105)';
      label.style.color = '#9af8ff';
      label.style.fontWeight = pitch === 60 ? '1000' : '800';
    });

    for (let pitch = 84; pitch >= 48; pitch -= 12) {
      const key = `guide-${pitch}`;
      if (roll.querySelector(`[data-c-guide="${key}"]`)) continue;
      const guide = document.createElement('div');
      guide.dataset.cGuide = key;
      guide.style.cssText = `position:absolute;z-index:1;left:0;right:0;top:${(84 - pitch) * 24}px;height:24px;background:rgba(66,215,230,.105);border-top:1px solid rgba(66,215,230,.42);border-bottom:1px solid rgba(66,215,230,.18);pointer-events:none;`;
      roll.append(guide);
    }

    [...roll.querySelectorAll('.note')].forEach(note => {
      const trackName = note.title.split(' · ')[0];
      note.style.display = hiddenTrackNames.has(trackName) ? 'none' : '';
    });

    if (centreC4AfterRender) {
      const c4Center = (84 - 60) * 24 + 12;
      scroll.scrollTop = Math.max(0, c4Center - scroll.clientHeight / 2);
      centreC4AfterRender = false;
    }
  }

  function decorateTracks() {
    const tracks = $('#tracks');
    if (!tracks) return;

    [...tracks.querySelectorAll('.track')].forEach(row => {
      row.style.gridTemplateColumns = '12px minmax(0,1fr) auto';
      row.querySelector('.instrument')?.remove();
      const trackButton = row.querySelector('.track-arm');
      const trackName = trackButton?.textContent.trim();
      if (!trackName) return;
      const actions = row.querySelector('.track-actions');
      if (!actions) return;

      const mute = actions.querySelector('[data-mute]');
      const solo = actions.querySelector('[data-solo]');
      if (mute?.getAttribute('aria-pressed') === 'true') mute.classList.add('on');
      if (solo?.getAttribute('aria-pressed') === 'true') {
        solo.style.background = '#137b91';
        solo.style.borderColor = '#36cfe1';
        solo.style.color = '#ecffff';
      }

      let hide = actions.querySelector('[data-ihy-hide]');
      if (!hide) {
        hide = document.createElement('button');
        hide.className = 'btn';
        hide.dataset.ihyHide = trackName;
        hide.textContent = 'H';
        hide.title = 'Hide this track in the piano roll';
        hide.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          if (hiddenTrackNames.has(trackName)) hiddenTrackNames.delete(trackName);
          else hiddenTrackNames.add(trackName);
          persistHiddenTracks();
          centreC4AfterRender = false;
          queueDecoration();
        }, true);
        actions.append(hide);
      }
      const isHidden = hiddenTrackNames.has(trackName);
      hide.setAttribute('aria-pressed', String(isHidden));
      hide.style.background = isHidden ? '#595b52' : '';
      hide.style.borderColor = isHidden ? '#c5c9bc' : '';
      hide.style.color = isHidden ? '#ffffff' : '';
    });
  }

  function loadExactExample(event) {
    const button = event.target.closest('#loadExample');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const fileInput = $('#file');
    const file = new File([exactExampleBuffer()], 'potion_song_all_piano_v7.mid', { type: 'audio/midi' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    centreC4AfterRender = true;
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(queueDecoration, 300);
  }

  document.addEventListener('click', loadExactExample, true);
  $('#file')?.addEventListener('change', () => {
    centreC4AfterRender = true;
    setTimeout(queueDecoration, 300);
  }, true);

  const observer = new MutationObserver(queueDecoration);
  observer.observe($('#roll'), { childList: true });
  observer.observe($('#labels'), { childList: true });
  observer.observe($('#tracks'), { childList: true, subtree: true });
  $('#tracks')?.addEventListener('click', () => setTimeout(queueDecoration, 0));

  queueDecoration();
})();