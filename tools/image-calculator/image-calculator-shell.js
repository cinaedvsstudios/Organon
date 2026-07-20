(() => {
  'use strict';
  const frame = document.getElementById('legacyApp');
  const mode = document.body.dataset.mode || 'compact';
  const DB_NAME = 'organon-image-calculator-shell';
  const STORE = 'workspace';
  const SETTINGS_KEY = 'organon-image-calculator-shell-settings';
  let saveTimer = 0;

  function status(text) { try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {} }
  function clearStatus() { setTimeout(() => { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }, 2800); }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeFile(file) {
    if (!file) return;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(file, 'source-file');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) { console.warn('Image transfer storage failed', error); }
  }

  async function readFile() {
    try {
      const db = await openDb();
      const file = await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('source-file');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return file;
    } catch (error) { return null; }
  }

  function collectSettings(doc) {
    const values = {};
    doc.querySelectorAll('input[id]:not([type=file]),select[id],textarea[id]').forEach((element) => {
      values[element.id] = element.type === 'checkbox' ? element.checked : element.value;
    });
    const active = doc.querySelector('.selector-card.active');
    return { values, activePanel: active?.dataset.target || 'filters' };
  }

  function saveSettings(doc) {
    try { sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(collectSettings(doc))); } catch (error) {}
  }

  async function saveWorkspace() {
    const doc = frame.contentDocument;
    if (!doc) return;
    saveSettings(doc);
    const file = doc.getElementById('file-input')?.files?.[0];
    if (file) await storeFile(file);
  }

  function restoreSettings(doc) {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(SETTINGS_KEY) || 'null'); } catch (error) { return; }
    if (!saved?.values) return;
    Object.entries(saved.values).forEach(([id, value]) => {
      const element = doc.getElementById(id);
      if (!element || element.type === 'file') return;
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (saved.activePanel) doc.querySelector(`.selector-card[data-target="${saved.activePanel}"]`)?.click();
  }

  async function restoreFile(doc) {
    const input = doc.getElementById('file-input');
    if (!input || input.files?.length) return;
    const file = await readFile();
    if (!file) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) { console.warn('Stored image could not be restored', error); }
  }

  function installAspectGuard(doc) {
    const canvas = doc.getElementById('main-canvas');
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || context.__organonAspectSafe) return;
    const nativeDrawImage = context.drawImage.bind(context);
    context.drawImage = function(image, ...args) {
      if (args.length === 4 && image && Number(image.naturalWidth) > 0 && Number(image.naturalHeight) > 0) {
        let [dx, dy, dw, dh] = args;
        const fullCanvasDraw = Math.abs(Math.abs(dw) - canvas.width) < 2 && Math.abs(Math.abs(dh) - canvas.height) < 2;
        const stretchActive = doc.getElementById('stretch-action-btn')?.classList.contains('active');
        if (fullCanvasDraw && !stretchActive) {
          const cropActive = doc.getElementById('crop-action-btn')?.classList.contains('active');
          const sourceRatio = image.naturalWidth / image.naturalHeight;
          const boxRatio = Math.abs(dw / dh);
          let nextWidth;
          let nextHeight;
          if ((sourceRatio > boxRatio) !== cropActive) {
            nextWidth = Math.abs(dw);
            nextHeight = nextWidth / sourceRatio;
          } else {
            nextHeight = Math.abs(dh);
            nextWidth = nextHeight * sourceRatio;
          }
          const signX = Math.sign(dw) || 1;
          const signY = Math.sign(dh) || 1;
          dx += (dw - nextWidth * signX) / 2;
          dy += (dh - nextHeight * signY) / 2;
          dw = nextWidth * signX;
          dh = nextHeight * signY;
        }
        return nativeDrawImage(image, dx, dy, dw, dh);
      }
      return nativeDrawImage(image, ...args);
    };
    context.__organonAspectSafe = true;
    setTimeout(() => doc.getElementById('filter-brightness')?.dispatchEvent(new Event('input', { bubbles: true })), 80);
  }

  function injectLayout(doc) {
    doc.getElementById('desktop-expand-btn')?.remove();
    const style = doc.createElement('style');
    style.id = 'organon-calculator-shell-layout';
    style.textContent = mode === 'wide' ? `
      html,body{overflow:hidden!important}.app-wrapper{max-width:none!important;width:100%!important;margin:0!important}
      .middle-scroll-panel{display:grid!important;grid-template-columns:minmax(0,1.55fr) 96px minmax(330px,.82fr)!important;grid-template-rows:minmax(0,1fr)!important;gap:12px!important;padding:12px 12px 92px!important;overflow:hidden!important}
      #card-preview-holder{grid-column:1!important;grid-row:1!important;min-height:0!important;margin:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      #preview-collapsible{display:flex!important;flex-direction:column!important;flex:1!important;min-height:0!important;max-height:none!important;opacity:1!important}
      #preview-collapsible .canvas-workspace-wrapper{flex:1!important;min-height:0!important}.canvas-workspace-wrapper canvas{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important}
      #selector-carousel{grid-column:2!important;grid-row:1!important;display:flex!important;flex-direction:column!important;gap:7px!important;margin:0!important;padding:8px!important;overflow:auto!important;border:1px solid var(--chiseled-bronze)!important;border-radius:16px!important;background:#1b1d19!important}
      #selector-carousel .selector-card{flex:0 0 auto!important;width:100%!important;min-height:62px!important;padding:7px 3px!important}
      #display-card{grid-column:3!important;grid-row:1!important;min-height:0!important;margin:0!important;overflow:auto!important}
      .top-sticky-panel{border-radius:0 0 16px 16px!important}
    ` : `.app-wrapper{max-width:540px!important}.expand-toggle-btn{display:none!important}`;
    doc.head.appendChild(style);
  }

  async function onFrameLoad() {
    const doc = frame.contentDocument;
    if (!doc) return;
    injectLayout(doc);
    installAspectGuard(doc);
    window.OrganonImagePalette?.install(doc, { mode });
    await restoreFile(doc);
    setTimeout(() => {
      restoreSettings(doc);
      installAspectGuard(doc);
      doc.getElementById('filter-brightness')?.dispatchEvent(new Event('input', { bubbles: true }));
    }, 220);
    doc.addEventListener('change', (event) => {
      if (event.target?.id === 'file-input') storeFile(event.target.files?.[0]);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveSettings(doc), 120);
    }, true);
    doc.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveSettings(doc), 120);
    }, true);
    status(mode === 'wide' ? 'Image Calculator fullscreen workspace ready.' : 'Image Calculator preview now preserves aspect ratio.');
    clearStatus();
  }

  frame.addEventListener('load', onFrameLoad);
  document.getElementById('openWide')?.addEventListener('click', async () => { await saveWorkspace(); location.href = './fullscreen.html?v=0.02'; });
  document.getElementById('returnCompact')?.addEventListener('click', async () => { await saveWorkspace(); location.href = './index-v2.html?v=0.02'; });
  document.getElementById('browserFullscreen')?.addEventListener('click', async () => {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
    catch (error) { status('Browser fullscreen was blocked.'); clearStatus(); }
  });
  window.addEventListener('beforeunload', () => { const doc = frame.contentDocument; if (doc) saveSettings(doc); });
})();