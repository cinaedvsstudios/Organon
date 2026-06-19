export const UI_ZOOM_MIN = 60;
export const UI_ZOOM_MAX = 140;
export const UI_ZOOM_DEFAULT = 100;

function modeName() {
  return document.documentElement.dataset.capsulariusMode === 'desktop' ? 'desktop' : 'browser';
}

function zoomKey() {
  return `capsularius.uiZoom.${modeName()}.v1`;
}

function normaliseZoom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return UI_ZOOM_DEFAULT;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, Math.round(number)));
}

export function currentUiZoom() {
  try {
    return normaliseZoom(localStorage.getItem(zoomKey()));
  } catch (_) {
    return UI_ZOOM_DEFAULT;
  }
}

export async function applyUiZoom(value, { save = true } = {}) {
  const percent = normaliseZoom(value);
  const factor = percent / 100;

  if (window.capsulariusDesktop?.setZoomFactor) {
    document.documentElement.style.zoom = '';
    await window.capsulariusDesktop.setZoomFactor(factor);
  } else {
    document.documentElement.style.zoom = String(factor);
  }

  if (save) {
    try { localStorage.setItem(zoomKey(), String(percent)); } catch (_) { /* Visual zoom still works for this session. */ }
  }

  return percent;
}

export function restoreUiZoom() {
  return applyUiZoom(currentUiZoom(), { save:false });
}
