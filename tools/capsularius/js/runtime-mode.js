export function desktopRuntimeAvailable() {
  return Boolean(window.capsulariusDesktop?.isDesktop);
}

function applyModeBadge() {
  const badge = document.querySelector('.app-badge');
  if (badge) badge.textContent = 'v0.37.0 — Dual Filesystem';
}

export function chooseFilesystemMode() {
  return new Promise((resolve) => {
    const template = document.getElementById('runtime-mode-template');
    const dialog = template.content.firstElementChild.cloneNode(true);
    const browserButton = dialog.querySelector('[data-runtime-mode="browser"]');
    const desktopButton = dialog.querySelector('[data-runtime-mode="desktop"]');
    const desktopAvailable = desktopRuntimeAvailable();

    desktopButton.disabled = !desktopAvailable;
    desktopButton.title = desktopAvailable ? 'Desktop mode' : 'Open Capsularius through the desktop launcher to use Desktop mode.';
    desktopButton.setAttribute('aria-label', desktopButton.title);
    dialog.querySelector('[data-desktop-unavailable]').hidden = desktopAvailable;

    const choose = (mode) => {
      dialog.remove();
      document.documentElement.dataset.capsulariusMode = mode;
      applyModeBadge();
      resolve(mode);
    };

    browserButton.addEventListener('click', () => choose('browser'));
    desktopButton.addEventListener('click', () => choose('desktop'));
    document.getElementById('dialog-layer').append(dialog);
    (desktopAvailable ? desktopButton : browserButton).focus();
  });
}
