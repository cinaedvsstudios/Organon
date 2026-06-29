(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const topPanel = document.getElementById('top-panel');
  const bottomBar = document.querySelector('.bottom-sticky-panel');
  const title = document.querySelector('.title-left');
  if (!topPanel || !bottomBar || !title) return;

  const style = document.createElement('style');
  style.textContent = `
    body.is-advanced-mode .bottom-sticky-panel.ag-auto-bottom {
      transform: translate(-50%, 0);
      transition: transform .28s ease, opacity .28s ease;
      will-change: transform;
    }
    body.is-advanced-mode .bottom-sticky-panel.ag-auto-bottom::before {
      content: 'ACTIONS';
      position: absolute;
      left: 50%;
      top: -21px;
      padding: 4px 14px 5px;
      border: 1px solid var(--chiseled-bronze);
      border-bottom: 0;
      border-radius: 10px 10px 0 0;
      background: rgba(196,139,75,.96);
      color: var(--bg-nightsky);
      font: 700 .55rem var(--font-mono);
      letter-spacing: .09em;
      transform: translateX(-50%);
    }
    body.is-advanced-mode .bottom-sticky-panel.ag-auto-bottom.ag-hidden-bottom {
      transform: translate(-50%, calc(100% - 14px));
      opacity: .96;
    }
    body.is-advanced-mode.ag-workspace-locked .bottom-sticky-panel.ag-auto-bottom {
      transform: translate(-50%, calc(100% + 36px));
      opacity: 0;
      pointer-events: none;
    }
    body.is-advanced-mode .ag-workspace-lock {
      display: inline-grid;
      place-items: center;
      width: 26px;
      height: 26px;
      margin-left: 8px;
      padding: 0;
      border: 1px solid var(--chiseled-bronze);
      border-radius: 50%;
      background: #171916;
      color: var(--alabaster-paper);
      font-size: .82rem;
      line-height: 1;
    }
    body.is-advanced-mode .ag-workspace-lock:hover,
    body.is-advanced-mode .ag-workspace-lock[aria-pressed="true"] {
      border-color: var(--water-spray);
      background: var(--forest-teal);
    }
    body.is-advanced-mode.ag-workspace-locked .top-sticky-panel {
      padding: 8px 26px !important;
    }
    body.is-advanced-mode.ag-workspace-locked .top-sticky-panel .panel-content-hide {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  bottomBar.classList.add('ag-auto-bottom');

  let hideTimer = null;
  const showBottom = () => {
    if (document.body.classList.contains('ag-workspace-locked')) return;
    window.clearTimeout(hideTimer);
    bottomBar.classList.remove('ag-hidden-bottom');
  };
  const hideBottom = () => {
    if (document.body.classList.contains('ag-workspace-locked')) return;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => bottomBar.classList.add('ag-hidden-bottom'), 2200);
  };

  bottomBar.addEventListener('mouseenter', showBottom);
  bottomBar.addEventListener('mouseleave', hideBottom);
  document.addEventListener('pointermove', (event) => {
    if (event.clientY >= window.innerHeight - 34) showBottom();
  }, { passive: true });

  let lock = document.getElementById('ag-workspace-lock');
  if (!lock) {
    lock = document.createElement('button');
    lock.type = 'button';
    lock.id = 'ag-workspace-lock';
    lock.className = 'ag-workspace-lock';
    lock.title = 'Lock the workspace controls out of the way';
    lock.setAttribute('aria-pressed', 'false');
    lock.textContent = '🔓';
    title.appendChild(lock);
  }

  lock.addEventListener('click', () => {
    const locked = !document.body.classList.contains('ag-workspace-locked');
    document.body.classList.toggle('ag-workspace-locked', locked);
    lock.textContent = locked ? '🔒' : '🔓';
    lock.setAttribute('aria-pressed', String(locked));
    if (locked) {
      window.clearTimeout(hideTimer);
      bottomBar.classList.remove('ag-hidden-bottom');
      topPanel.classList.add('minimized');
    } else {
      bottomBar.classList.add('ag-hidden-bottom');
    }
  });

  hideBottom();
})();
