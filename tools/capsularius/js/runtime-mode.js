import { restoreUiZoom } from './ui-zoom.js';

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

    const choose = async (mode) => {
      document.documentElement.dataset.capsulariusMode = mode;
      applyModeBadge();
      try { await restoreUiZoom(); } catch (_) { /* The current session can continue at the default zoom. */ }
      dialog.remove();
      resolve(mode);
    };

    browserButton.addEventListener('click', () => { void choose('browser'); });
    desktopButton.addEventListener('click', () => { void choose('desktop'); });
    document.getElementById('dialog-layer').append(dialog);
    (desktopAvailable ? desktopButton : browserButton).focus();
  });
}
