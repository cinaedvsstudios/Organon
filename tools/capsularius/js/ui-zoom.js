export const UI_ZOOM_MIN = 60;
export const UI_ZOOM_MAX = 140;
export const UI_ZOOM_DEFAULT = 100;

let desktopZoom = UI_ZOOM_DEFAULT;

function desktopRuntime() {
  return window.capsulariusDesktop?.isDesktop ? window.capsulariusDesktop : null;
}

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
  if (modeName() === 'desktop' && desktopRuntime()) return desktopZoom;
  try {
    return normaliseZoom(localStorage.getItem(zoomKey()));
  } catch (_) {
    return UI_ZOOM_DEFAULT;
  }
}

async function applyVisualZoom(percent) {
  const factor = percent / 100;
  const desktop = desktopRuntime();
  if (desktop?.setZoomFactor) {
    document.documentElement.style.zoom = '';
    await desktop.setZoomFactor(factor);
  } else {
    document.documentElement.style.zoom = String(factor);
  }
}

export async function applyUiZoom(value, { save = true } = {}) {
  const percent = normaliseZoom(value);
  await applyVisualZoom(percent);

  if (!save) return percent;

  const desktop = desktopRuntime();
  if (modeName() === 'desktop' && desktop?.setDesktopPreference) {
    desktopZoom = percent;
    await desktop.setDesktopPreference('uiZoom', percent);
    return percent;
  }

  try { localStorage.setItem(zoomKey(), String(percent)); } catch (_) { /* Visual zoom still works for this session. */ }
  return percent;
}

export async function restoreUiZoom() {
  const desktop = desktopRuntime();
  if (modeName() === 'desktop' && desktop?.getDesktopPreference) {
    try { desktopZoom = normaliseZoom(await desktop.getDesktopPreference('uiZoom')); }
    catch (_) { desktopZoom = UI_ZOOM_DEFAULT; }
    return applyUiZoom(desktopZoom, { save:false });
  }
  return applyUiZoom(currentUiZoom(), { save:false });
}
