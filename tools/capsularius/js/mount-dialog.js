function isInvalidLabel(value) {
  return !value || value.trim().length > 72;
}

export function promptMountLabel({ rawName, suggestedLabel }) {
  return new Promise((resolve) => {
    const template = document.getElementById('mount-label-template');
    const node = template.content.firstElementChild.cloneNode(true);
    const input = node.querySelector('[data-mount-label-input]');
    const error = node.querySelector('[data-mount-label-error]');
    const raw = node.querySelector('[data-mount-raw-name]');
    raw.textContent = rawName || 'Unnamed root folder';
    input.value = suggestedLabel || 'Mounted drive';

    const finish = (value) => {
      node.remove();
      resolve(value);
    };

    const confirm = () => {
      const value = input.value.trim();
      if (isInvalidLabel(value)) {
        error.hidden = false;
        error.textContent = 'Enter a display name up to 72 characters long.';
        input.focus();
        return;
      }
      finish(value);
    };

    node.querySelector('[data-mount-label-confirm]').addEventListener('click', confirm);
    node.querySelector('[data-mount-label-cancel]').addEventListener('click', () => finish(null));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') confirm();
      if (event.key === 'Escape') finish(null);
    });

    document.getElementById('dialog-layer').append(node);
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}
