const COLUMN_KEY = 'capsularius.columnWidths.v1';
const COLUMN_KEYS = ['name', 'size', 'modified', 'type', 'info', 'created'];
const DEFAULT_WIDTHS = { name:260, size:92, modified:132, type:178, info:168, created:126 };
const MIN_WIDTH = 64;
const MAX_WIDTH = 560;

function readWidths() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(COLUMN_KEY) || '{}');
    return Object.fromEntries(COLUMN_KEYS.map((key) => [key, Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved?.[key]) || DEFAULT_WIDTHS[key]))]));
  } catch (_) {
    return { ...DEFAULT_WIDTHS };
  }
}

function columnTemplate(widths) {
  return COLUMN_KEYS.map((key) => `${widths[key]}px`).join(' ');
}

function applyLiveTemplate(template) {
  document.querySelectorAll('.caps-list-header, .file-item.list.caps-list-row').forEach((node) => {
    node.style.setProperty('--caps-columns', template);
  });
}

function saveWidths(widths) {
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify(widths));
}

function columnKeyFor(resizer) {
  const header = resizer.closest('.caps-list-header');
  const cell = resizer.closest('.caps-list-header-cell');
  if (!header || !cell) return null;
  const index = [...header.children].indexOf(cell);
  return COLUMN_KEYS[index] || null;
}

function stopResize(move, stop) {
  window.removeEventListener('pointermove', move, true);
  window.removeEventListener('pointerup', stop, true);
  window.removeEventListener('pointercancel', stop, true);
  document.body.classList.remove('caps-column-resizing');
}

/*
 * Workspace UI originally attached pointer movement only to the tiny resize handle.
 * Electron can lose those events once the pointer leaves the header, so this capture
 * listener owns the drag for both Desktop and Browser mode.
 */
document.addEventListener('pointerdown', (event) => {
  const resizer = event.target.closest?.('.caps-column-resizer');
  if (!resizer || event.button !== 0) return;

  const key = columnKeyFor(resizer);
  if (!key) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();

  const widths = readWidths();
  const startX = event.clientX;
  const initialWidth = widths[key];
  resizer.classList.add('dragging');
  document.body.classList.add('caps-column-resizing');

  const move = (pointer) => {
    widths[key] = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(initialWidth + pointer.clientX - startX)));
    const template = columnTemplate(widths);
    applyLiveTemplate(template);
  };

  const stop = () => {
    resizer.classList.remove('dragging');
    saveWidths(widths);
    stopResize(move, stop);
  };

  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);
}, true);
