import { restoreUiZoom } from './ui-zoom.js';

const BROWSER_MODE_KEY = 'capsularius.filesystemMode.browser.v1';
const DESKTOP_MODE_PREFERENCE = 'filesystemMode';

export function desktopRuntimeAvailable() {
  return Boolean(window.capsulariusDesktop?.isDesktop);
}

function applyModeBadge() {
  const badge = document.querySelector('.app-badge');
  if (badge) badge.textContent = 'v0.37.0 — Dual Filesystem';
}

function validMode(mode) {
  return mode === 'browser' || mode === 'desktop';
}

async function rememberedMode() {
  if (desktopRuntimeAvailable()) {
    try {
      const mode = await window.capsulariusDesktop.getDesktopPreference(DESKTOP_MODE_PREFERENCE);
      return validMode(mode) ? mode : null;
    } catch (_) {
      return null;
    }
  }

  try {
    const mode = window.localStorage.getItem(BROWSER_MODE_KEY);
    return validMode(mode) ? mode : null;
  } catch (_) {
    return null;
  }
}

async function saveRememberedMode(mode) {
  if (desktopRuntimeAvailable()) {
    await window.capsulariusDesktop.setDesktopPreference(DESKTOP_MODE_PREFERENCE, mode);
    return;
  }
  window.localStorage.setItem(BROWSER_MODE_KEY, mode);
}

export async function chooseFilesystemMode() {
  const desktopAvailable = desktopRuntimeAvailable();
  const remembered = await rememberedMode();
  if (remembered && (remembered !== 'desktop' || desktopAvailable)) {
    document.documentElement.dataset.capsulariusMode = remembered;
    applyModeBadge();
    try { await restoreUiZoom(); } catch (_) { /* The current session can continue at the default zoom. */ }
    return remembered;
  }

  return new Promise((resolve) => {
    const template = document.getElementById('runtime-mode-template');
    const dialog = template.content.firstElementChild.cloneNode(true);
    const browserButton = dialog.querySelector('[data-runtime-mode="browser"]');
    const desktopButton = dialog.querySelector('[data-runtime-mode="desktop"]');
    const remember = dialog.querySelector('[data-runtime-mode-remember]');

    desktopButton.disabled = !desktopAvailable;
    desktopButton.title = desktopAvailable ? 'Desktop mode' : 'Open Capsularius through the desktop launcher to use Desktop mode.';
    desktopButton.setAttribute('aria-label', desktopButton.title);
    dialog.querySelector('[data-desktop-unavailable]').hidden = desktopAvailable;

    const choose = async (mode) => {
      document.documentElement.dataset.capsulariusMode = mode;
      applyModeBadge();
      if (remember?.checked) {
        try { await saveRememberedMode(mode); } catch (_) { /* Mode selection still works for this launch. */ }
      }
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
