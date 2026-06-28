(() => {
  'use strict';

  const advanced = new URLSearchParams(window.location.search).get('mode') === 'advanced';
  const title = document.querySelector('.title-left span');
  const button = document.getElementById('btn-animation-mode');

  document.body.classList.toggle('is-advanced-mode', advanced);
  document.body.dataset.animationMakerMode = advanced ? 'advanced' : 'standard';
  document.title = advanced ? 'Organon - Animation Maker Advanced' : 'Organon - Animation Maker';

  if (title) title.textContent = advanced ? 'ANIMATION MAKER — ADVANCED' : 'ANIMATION MAKER';

  if (button) {
    button.textContent = advanced ? 'STANDARD MODE' : 'ADVANCED MODE';
    button.title = advanced ? 'Return to the compact Animation Maker workspace' : 'Open the wide desktop Animation Maker workspace';
    button.addEventListener('click', () => {
      window.location.assign(advanced ? './index.html' : '../animation-maker-advanced/index.html');
    });
  }

  if (!advanced) return;

  const skin = document.createElement('style');
  skin.textContent = `
    body.is-advanced-mode .advanced-editor-card{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}
    body.is-advanced-mode .advanced-editor-card>.advanced-card-heading{margin:0 2px 10px;padding-bottom:8px}
    body.is-advanced-mode .advanced-inline-editor-host{min-height:0}
    body.is-advanced-mode .editor-modal.advanced-inline-editor-host-modal{position:static;z-index:auto;inset:auto;display:contents;padding:0;background:transparent}
    body.is-advanced-mode .advanced-editor-card .editor-window{width:100%!important;max-width:none!important;height:min(820px,72vh)!important;min-width:0;min-height:520px;resize:none;border-radius:14px}
    body.is-advanced-mode .advanced-editor-card .editor-header{cursor:default}
    body.is-advanced-mode .advanced-editor-card .editor-close,body.is-advanced-mode .advanced-editor-card .editor-footer [data-close="frame-editor-modal"]{display:none!important}
    body.is-advanced-mode #adjust-card #open-editor-btn{display:none}
    body.is-advanced-mode .advanced-editor-menu{display:inline-flex;align-items:center;gap:5px;margin-left:16px}
    body.is-advanced-mode .advanced-editor-menu-divider{width:1px;height:27px;margin-right:8px;background:rgba(137,107,73,.7)}
    body.is-advanced-mode .advanced-editor-menu button,body.is-advanced-mode .advanced-editor-actions button,body.is-advanced-mode .advanced-grid-controls>button,body.is-advanced-mode #advanced-selection-controls>button,body.is-advanced-mode .advanced-transform-panel button{min-height:30px;padding:6px 10px;border:1px solid rgba(137,107,73,.75);border-radius:7px;background:#34352f;color:var(--alabaster-paper);font:700 .62rem var(--font-headers);letter-spacing:.03em;white-space:nowrap}
    body.is-advanced-mode .advanced-editor-menu button.active,body.is-advanced-mode .advanced-editor-menu button:hover,body.is-advanced-mode .advanced-editor-actions button:hover,body.is-advanced-mode .advanced-grid-controls>button.active,body.is-advanced-mode .advanced-grid-controls>button:hover,body.is-advanced-mode #advanced-selection-controls>button.active,body.is-advanced-mode #advanced-selection-controls>button:hover{border-color:var(--water-spray);background:var(--water-blue);color:#fff}
    body.is-advanced-mode .advanced-editor-actions,body.is-advanced-mode .advanced-tool-strip,body.is-advanced-mode .advanced-grid-controls,body.is-advanced-mode .advanced-transform-panel{display:flex;align-items:center;gap:7px;min-width:0;margin-left:8px;padding-left:10px;border-left:1px solid rgba(137,107,73,.52)}
    body.is-advanced-mode .advanced-editor-actions[hidden],body.is-advanced-mode .advanced-tool-strip[hidden],body.is-advanced-mode .advanced-transform-panel[hidden]{display:none!important}
    body.is-advanced-mode .advanced-tool-strip #tool-grid{display:flex;align-items:center;gap:6px;width:auto}
    body.is-advanced-mode .advanced-tool-strip #tool-grid button{min-height:34px;padding:5px 9px;white-space:nowrap}
    body.is-advanced-mode .advanced-transform-panel{padding:7px 10px;border:1px solid rgba(137,107,73,.65);border-radius:9px;background:#20211d}
    body.is-advanced-mode .advanced-transform-panel span{color:var(--water-spray);font:700 .59rem var(--font-mono)}
    body.is-advanced-mode .advanced-transform-panel input{width:130px}
    body.is-advanced-mode .advanced-transform-panel b{min-width:40px;color:var(--stone-ochre);font:.68rem var(--font-mono);text-align:center}
    body.is-advanced-mode .advanced-grid-controls{position:relative}
    body.is-advanced-mode #advanced-grid-size-popover{position:absolute;z-index:20;right:0;top:38px;width:190px;padding:10px;border:1px solid var(--chiseled-bronze);border-radius:9px;background:#20211d;box-shadow:0 8px 20px rgba(0,0,0,.6)}
    body.is-advanced-mode #advanced-grid-size-popover span{display:flex;justify-content:space-between;margin-bottom:7px;color:var(--water-spray);font:.62rem var(--font-mono)}
    body.is-advanced-mode #advanced-grid-overlay{position:absolute;z-index:5;pointer-events:none;border:1px solid rgba(117,178,222,.72);background-image:linear-gradient(to right,rgba(117,178,222,.34) 1px,transparent 1px),linear-gradient(to bottom,rgba(117,178,222,.34) 1px,transparent 1px)}
    body.is-advanced-mode .advanced-grid-diagonal{position:absolute;left:50%;top:50%;width:142%;height:1px;background:rgba(117,178,222,.88);transform-origin:center}
    body.is-advanced-mode .advanced-grid-diagonal-a{transform:translate(-50%,-50%) rotate(45deg)}
    body.is-advanced-mode .advanced-grid-diagonal-b{transform:translate(-50%,-50%) rotate(-45deg)}
    body.is-advanced-mode .advanced-grid-centre{position:absolute;left:50%;top:50%;width:9px;height:9px;border:1px solid var(--water-spray);border-radius:50%;background:#101111;transform:translate(-50%,-50%)}
    body.is-advanced-mode #advanced-selection-box{position:absolute;z-index:7;pointer-events:none;border:2px dashed var(--water-spray);background:rgba(75,132,191,.16);box-shadow:0 0 0 1px rgba(0,0,0,.75) inset}
    body.is-advanced-mode #advanced-selection-box span{position:absolute;left:-1px;top:-21px;padding:3px 7px;border:1px solid var(--water-spray);border-radius:5px 5px 0 0;background:#152321;color:var(--water-spray);font:700 .55rem var(--font-mono);letter-spacing:.06em}
    body.is-advanced-mode #advanced-selection-controls{display:grid;gap:7px}
    body.is-advanced-mode #advanced-selection-controls>button{text-align:left}
    body.is-advanced-mode .advanced-clear-all{margin-left:6px!important;border:1px solid var(--brand-red)!important;background:transparent!important;color:var(--terracotta-peach)!important}
    body.is-advanced-mode .advanced-workspace-lock{display:inline-grid;place-items:center;width:26px;height:26px;margin-left:8px;padding:0;border:1px solid var(--chiseled-bronze);border-radius:50%;background:#171916;color:var(--alabaster-paper);font-size:.82rem;line-height:1}
    body.is-advanced-mode .advanced-workspace-lock:hover,body.is-advanced-mode.advanced-workspace-locked .advanced-workspace-lock{border-color:var(--water-spray);background:var(--forest-teal)}
    body.is-advanced-mode.advanced-workspace-locked .bottom-sticky-panel.advanced-auto-panel{transform:translate(-50%,calc(100% + 36px));opacity:0;pointer-events:none}
    @media(max-width:1180px){body.is-advanced-mode .advanced-editor-card .editor-nav{align-items:flex-start}body.is-advanced-mode .advanced-editor-actions,body.is-advanced-mode .advanced-tool-strip,body.is-advanced-mode .advanced-grid-controls,body.is-advanced-mode .advanced-transform-panel{order:4;width:100%;margin:4px 0 0;padding:8px 0 0;border-left:0;border-top:1px solid rgba(137,107,73,.45);overflow-x:auto}}
  `;
  document.head.appendChild(skin);

  const workspace = document.createElement('script');
  workspace.src = '../animation-maker-mode/advanced-workspace.js';
  document.head.appendChild(workspace);
})();
