function removeAndResolve(node, resolve, value) {
  node.remove();
  resolve(value);
}

function invalidName(value) {
  return !value || value === '.' || value === '..' || /[\\/:*?"<>|]/.test(value);
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
        confirm.textContent = confirmLabel;
        confirm.classList.toggle('destructive', destructive);
        confirm.addEventListener('click', () => removeAndResolve(node, resolve, true));
        node.querySelector('[data-operation-cancel]').addEventListener('click', () => removeAndResolve(node, resolve, false));
        document.getElementById('toast-layer').append(node);
        window.setTimeout(() => confirm.focus(), 0);
      });
    },

    progress(initialMessage) {
      const template = document.getElementById('operation-progress-template');
      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector('[data-progress-message]').textContent = initialMessage;
      document.getElementById('toast-layer').append(node);
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
