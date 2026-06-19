function removeAndResolve(node, resolve, value) {
  node.remove();
  resolve(value);
}

function invalidName(value) {
  return !value || value === '.' || value === '..' || /[\/:*?"<>|]/.test(value);
}

function ensureOperationPanelStyles() {
  if (document.getElementById('capsularius-operation-panel-styles')) return;

  const style = document.createElement('style');
  style.id = 'capsularius-operation-panel-styles';
  style.textContent = `
    #capsularius-operation-layer {
      position: fixed;
      inset: 0;
      z-index: 220;
      pointer-events: none;
    }

    .operation-panel {
      position: fixed;
      z-index: 221;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      min-width: min(440px, calc(100vw - 32px));
      max-width: min(620px, calc(100vw - 32px));
      padding: 0 14px 14px;
      border: 1px solid #75b2de !important;
      border-radius: 11px !important;
      color: #f5f0db;
      background: linear-gradient(145deg, rgba(26, 66, 103, .98), rgba(18, 38, 61, .99)) !important;
      box-shadow: 0 20px 56px rgba(0, 0, 0, .78), 0 0 0 1px rgba(117, 178, 222, .15) inset;
      pointer-events: auto;
      animation: capsularius-operation-enter .16s ease-out both;
    }

    .operation-panel .operation-drag-handle {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      min-height: 31px;
      margin: 0 -14px 0;
      padding: 7px 12px;
      border-bottom: 1px solid rgba(117, 178, 222, .33);
      border-radius: 10px 10px 0 0;
      color: #d8edff;
      background: rgba(8, 21, 35, .34);
      cursor: grab;
      font: 700 .65rem var(--mono, monospace);
      letter-spacing: .08em;
      text-transform: uppercase;
      user-select: none;
      touch-action: none;
    }

    .operation-panel .operation-drag-handle:active {
      cursor: grabbing;
    }

    .operation-panel .operation-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .operation-panel .operation-badge,
    .operation-panel .toast-symbol {
      color: #b7e1ff;
      font: 700 .66rem var(--mono, monospace);
      letter-spacing: .07em;
      text-transform: uppercase;
    }

    .operation-panel .toast-message {
      color: #fff;
      font-size: .82rem;
      line-height: 1.35;
    }

    .operation-panel .operation-detail {
      color: rgba(224, 239, 252, .76);
      font: .67rem var(--mono, monospace);
      line-height: 1.35;
    }

    .operation-panel .toast-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
    }

    .operation-panel .action-button {
      border-color: rgba(183, 225, 255, .54);
      background: rgba(8, 21, 35, .6);
    }

    .operation-panel .action-button.primary {
      border-color: #a5d8ff;
      background: #397cb7;
    }

    .operation-panel .action-button.primary:hover {
      background: #4b91cb;
    }

    .operation-panel .spinner {
      border-color: rgba(220, 241, 255, .3);
      border-top-color: #d4edff;
    }

    @keyframes capsularius-operation-enter {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 560px) {
      .operation-panel {
        grid-template-columns: 1fr;
      }

      .operation-panel .toast-actions {
        justify-content: flex-start;
      }
    }
  `;
  document.head.append(style);
}

function operationLayer() {
  let layer = document.getElementById('capsularius-operation-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'capsularius-operation-layer';
  document.body.append(layer);
  return layer;
}

function centrePanel(panel) {
  window.requestAnimationFrame(() => {
    if (!panel.isConnected) return;
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(16, Math.round((window.innerWidth - bounds.width) / 2))}px`;
    panel.style.top = `${Math.max(16, Math.round((window.innerHeight - bounds.height) / 2))}px`;
  });
}

function makeDraggable(panel) {
  const handle = document.createElement('div');
  handle.className = 'operation-drag-handle';
  handle.textContent = 'Capsularius · File Operation';
  panel.prepend(handle);

  let drag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const bounds = panel.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top
    };
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const bounds = panel.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - bounds.width - 8, event.clientX - drag.offsetX));
    const top = Math.max(8, Math.min(window.innerHeight - bounds.height - 8, event.clientY - drag.offsetY));
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  });

  const finishDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    try { handle.releasePointerCapture(event.pointerId); } catch (_) { /* no-op */ }
    drag = null;
  };

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
}

function mountOperationPanel(node) {
  ensureOperationPanelStyles();
  node.classList.add('operation-panel');
  operationLayer().append(node);
  makeDraggable(node);
  centrePanel(node);
  return node;
}

export function createOperationUi() {
  return {
    confirm({ badge, message, detail, confirmLabel, destructive = false }) {
      return new Promise((resolve) => {
        const template = document.getElementById('operation-confirm-template');
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector('[data-operation-badge]').textContent = badge;
        node.querySelector('[data-operation-message]').textContent = message;
        const detailNode = node.querySelector('[data-operation-detail]');
        detailNode.textContent = detail || '';
        detailNode.hidden = !detail;
        const confirm = node.querySelector('[data-operation-confirm]');
        const cancel = node.querySelector('[data-operation-cancel]');
        confirm.textContent = confirmLabel;
        confirm.classList.toggle('destructive', destructive);
        const finish = (value) => removeAndResolve(node, resolve, value);
        confirm.addEventListener('click', () => finish(true));
        cancel.addEventListener('click', () => finish(false));
        node.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') finish(false);
        });
        mountOperationPanel(node);
        window.setTimeout(() => confirm.focus(), 0);
      });
    },

    progress(initialMessage) {
      const template = document.getElementById('operation-progress-template');
      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector('[data-progress-message]').textContent = initialMessage;
      mountOperationPanel(node);
      let cancel = () => {};
      const cancelButton = node.querySelector('[data-progress-cancel]');
      cancelButton.addEventListener('click', () => {
        cancelButton.disabled = true;
        cancelButton.textContent = 'Cancelling…';
        cancel();
      });
      return {
        update(message) { node.querySelector('[data-progress-message]').textContent = message; },
        onCancel(handler) { cancel = handler; },
        close() { node.remove(); }
      };
    },

    rename({ title, oldName, suggestedName, confirmLabel }) {
      return new Promise((resolve) => {
        const template = document.getElementById('rename-dialog-template');
        const node = template.content.firstElementChild.cloneNode(true);
        const input = node.querySelector('[data-rename-input]');
        const error = node.querySelector('[data-rename-error]');
        node.querySelector('[data-rename-title]').textContent = title;
        node.querySelector('[data-rename-old-name]').textContent = oldName || 'New folder';
        input.value = suggestedName || '';
        const finish = (value) => removeAndResolve(node, resolve, value);
        const submit = () => {
          const value = input.value.trim();
          if (invalidName(value)) {
            error.hidden = false;
            error.textContent = 'Use a name without / \\ : * ? " < > or |.';
            input.focus();
            return;
          }
          finish(value);
        };
        const confirm = node.querySelector('[data-rename-confirm]');
        confirm.textContent = confirmLabel;
        confirm.addEventListener('click', submit);
        node.querySelector('[data-rename-cancel]').addEventListener('click', () => finish(null));
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') submit();
          if (event.key === 'Escape') finish(null);
        });
        document.getElementById('dialog-layer').append(node);
        window.setTimeout(() => { input.focus(); input.select(); }, 0);
      });
    },

    conflict({ name, sourceKind, targetKind }) {
      return new Promise((resolve) => {
        const template = document.getElementById('conflict-dialog-template');
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector('[data-conflict-name]').textContent = name;
        node.querySelector('[data-conflict-detail]').textContent = sourceKind === 'directory' && targetKind === 'directory'
          ? 'The folders will merge. Conflicting files inside will still ask what to do.'
          : 'Choose whether to replace the existing item or use a different name.';
        node.querySelector('[data-conflict-replace]').addEventListener('click', () => removeAndResolve(node, resolve, 'replace'));
        node.querySelector('[data-conflict-rename]').addEventListener('click', () => removeAndResolve(node, resolve, 'rename'));
        node.querySelector('[data-conflict-cancel]').addEventListener('click', () => removeAndResolve(node, resolve, 'cancel'));
        document.getElementById('dialog-layer').append(node);
        window.setTimeout(() => node.querySelector('[data-conflict-replace]').focus(), 0);
      });
    }
  };
}
