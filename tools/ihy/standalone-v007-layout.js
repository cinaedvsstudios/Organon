(() => {
  'use strict';

  const frame = document.getElementById('ihy');
  const pianoHelp = 'Double-click an empty cell to add a note. Drag notes to move them, pull their right edge to resize, or right-click for an instrument override, velocity or deletion.';
  const keyboardHelp = 'Computer keys: A W S E D F T G Y H U J K. Hold Space for a longer note. Keyboard input plays the armed track; Record writes notes to the grid.';

  const css = `
    .app{max-width:none!important;margin:0!important;padding-bottom:18px!important;min-height:100vh!important}
    .top{padding:10px 20px!important;border-radius:0 0 18px 18px!important}
    .title-row{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;width:100%!important;margin:0!important;flex-wrap:nowrap!important}
    .icon-slot{width:42px!important;height:42px!important;flex:0 0 42px!important;border:0!important;border-radius:0!important;background:transparent!important;overflow:visible!important}
    .icon-slot img{display:block;width:42px!important;height:42px!important;object-fit:contain!important}
    .title-copy{flex:0 0 auto!important;min-width:0!important}
    .title{color:#fff4e3!important;text-shadow:0 1px 2px rgb(0 0 0/.72)!important;font-size:1.62rem!important;line-height:1!important;letter-spacing:.07em!important;white-space:nowrap!important;overflow:visible!important}
    .sub{display:none!important}
    .ver{flex:0 0 auto!important;margin:0!important;padding:7px 10px!important}
    .header-divider{width:1px!important;height:34px!important;flex:0 0 1px!important;background:#9a805f!important;opacity:.8!important;margin:0 2px!important}
    .top-fields{display:grid!important;grid-template-columns:minmax(260px,1.35fr) 105px 150px!important;gap:8px!important;flex:0 1 730px!important;width:auto!important;margin:0!important}
    main{padding:12px 20px 24px!important}
    .compose{display:grid!important;grid-template-columns:292px minmax(0,1fr)!important;grid-template-areas:"controls roll" "tracks keyboard"!important;gap:14px!important;align-items:start!important}
    .compose-controls{grid-area:controls!important;margin-top:0!important}.compose-tracks{grid-area:tracks!important}.compose-roll{grid-area:roll!important;min-width:0!important}.compose-keys{grid-area:keyboard!important;min-width:0!important}.compose-sections{display:none!important}
    .tabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;overflow:visible!important;padding:0!important;margin:0 0 12px!important}.tab{width:100%!important}.tab:last-child:nth-child(odd){grid-column:1/-1!important}
    .compose-roll .row,.compose-keys .row{align-items:center!important;gap:9px!important}.compose-roll h3.grow,.compose-keys h3.grow{flex:0 0 auto!important;white-space:nowrap!important;margin:0!important}.inline-help{flex:1 1 auto!important;min-width:120px!important;margin:0!important;color:#b9b4a9!important;font-size:.61rem!important;line-height:1.35!important}.compose-roll > p.micro,.compose-keys > p.micro{display:none!important}
    .roll-wrap{height:min(300px,calc(100vh - 550px))!important;min-height:250px!important;max-height:330px!important}
    .section-inline{display:block!important;margin:0!important;padding:0!important;border:0!important;border-top:1px solid #5d4c39!important;border-radius:0!important;background:#121310!important;overflow:auto!important}.section-inline .section-wrap{border:0!important;border-radius:0!important;background:#121310!important}.section-inline .sections{height:50px!important}.section-inline .section{top:8px!important;height:34px!important;border-radius:999px!important;padding:0 12px!important}
    .bottom{position:static!important;left:auto!important;bottom:auto!important;transform:none!important;max-width:none!important;width:auto!important;margin-top:10px!important;padding:0!important;background:transparent!important;border:0!important;border-radius:0!important}.bottom-inner{width:100%!important}.bottom-actions{grid-template-columns:1fr 1fr 1fr!important}.status{color:#b9b4a9!important;text-align:left!important}
    @media(max-width:899px){.app{max-width:540px!important;margin:auto!important}.top{padding:12px!important}.title-row{flex-wrap:wrap!important}.title{font-size:1.28rem!important}.header-divider{display:none!important}.top-fields{flex:1 0 100%!important;grid-template-columns:1.4fr .62fr .8fr!important;margin-top:10px!important}.compose{display:flex!important;flex-direction:column!important}.roll-wrap{height:400px!important;min-height:0!important}.bottom-actions{grid-template-columns:1fr 1fr 1.15fr!important}.status{text-align:center!important}.inline-help{font-size:.59rem!important}.compose-roll .row,.compose-keys .row{flex-wrap:wrap!important}}
  `;

  function moveHelp(card, text) {
    if (!card) return;
    const row = card.querySelector('.row');
    const paragraph = card.querySelector(':scope > p.micro');
    if (!row || !paragraph) return;
    paragraph.classList.add('inline-help');
    paragraph.textContent = text;
    const heading = row.querySelector('h3');
    if (heading) heading.after(paragraph);
  }

  function arrange(doc) {
    if (doc.getElementById('ihy-v007-layout')) return;

    const style = doc.createElement('style');
    style.id = 'ihy-v007-layout';
    style.textContent = css;
    doc.head.append(style);
    doc.title = 'Ihy v0.07 — Sound & Music Workshop';

    const icon = doc.querySelector('.icon-slot');
    if (icon) {
      icon.replaceChildren();
      const image = doc.createElement('img');
      image.src = './icon.png';
      image.alt = 'Ihy';
      icon.append(image);
    }

    const title = doc.querySelector('.title');
    if (title) title.textContent = 'Ihy';
    const subtitle = doc.querySelector('.sub');
    if (subtitle) subtitle.remove();
    const version = doc.querySelector('.ver');
    if (version) version.textContent = 'v0.07';

    const titleRow = doc.querySelector('.title-row');
    const projectFields = doc.querySelector('.top-fields');
    if (titleRow && projectFields) {
      const divider = doc.createElement('span');
      divider.className = 'header-divider';
      titleRow.append(divider, projectFields);
    }

    const tabs = doc.querySelector('.tabs');
    const controlCard = doc.querySelector('.compose-controls');
    if (tabs && controlCard) controlCard.prepend(tabs);

    const sectionCard = doc.querySelector('.compose-sections');
    const rollCard = doc.querySelector('.compose-roll');
    if (sectionCard && rollCard) {
      const sectionWrap = sectionCard.querySelector('.section-wrap');
      const rollWrap = rollCard.querySelector('.roll-wrap');
      if (sectionWrap && rollWrap) {
        sectionWrap.classList.add('section-inline');
        rollWrap.after(sectionWrap);
      }
      sectionCard.remove();
    }

    const footer = doc.querySelector('.bottom');
    if (footer && controlCard) controlCard.append(footer);
    moveHelp(rollCard, pianoHelp);
    moveHelp(doc.querySelector('.compose-keys'), keyboardHelp);

    const status = doc.getElementById('status');
    if (status) status.textContent = 'v0.07 — aligned standalone editor.';
  }

  frame.addEventListener('load', () => {
    try { arrange(frame.contentDocument); } catch (_) {}
  });
})();
