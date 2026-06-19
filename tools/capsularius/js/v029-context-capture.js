const META_KEY = 'organon-capsularius-file-metadata-v029';

function getMeta() { try { const value = JSON.parse(localStorage.getItem(META_KEY) || ''); return value && typeof value === 'object' ? value : {}; } catch (_) { return {}; } }
function saveMeta(value) { try { localStorage.setItem(META_KEY, JSON.stringify(value)); } catch (_) { /* no-op */ } }
function text(node, selector) { return node.querySelector(selector)?.textContent?.trim() || '—'; }
function element(tag, className, value) { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; }

function capture(target) {
  const file = target.closest('.file-item');
  const windowNode = target.closest('.folder-window');
  if (!windowNode) return null;
  const location = windowNode.querySelector('.window-title')?.textContent?.trim() || 'Capsularius';
  return file ? {
    windowNode, name: text(file, '.file-name'), location,
    type: text(file, '.caps-list-cell.type'), size: text(file, '.file-meta'),
    modified: text(file, '.caps-list-cell.modified'), created: text(file, '.caps-list-cell.created'), details: text(file, '.caps-list-cell.info')
  } : null;
}

function properties(info) {
  document.querySelector('.caps-v029-properties')?.remove();
  const panel = element('section', 'caps-v029-properties');
  const drag = element('div', 'caps-v029-drag', 'Capsularius · Properties');
  panel.append(drag, element('h2', '', info.name));
  const grid = element('dl', 'caps-v029-grid');
  [['Location', info.location], ['Type', info.type], ['Size', info.size], ['Date modified', info.modified], ['Date created', info.created], ['Length / dimensions', info.details]].forEach(([label, value]) => grid.append(element('dt', '', label), element('dd', '', value)));
  panel.append(grid);
  const all = getMeta(); const key = `${info.location}|${info.name}`; const existing = all[key] || {};
  const fields = element('div', 'caps-v029-fields');
  [['Title','title',false],['Tags','tags',false],['Rating (0–5)','rating',false],['Description','description',true],['Notes','notes',true]].forEach(([label, name, multiline]) => {
    const wrap = element('label'); wrap.append(element('span', '', label));
    const input = document.createElement(multiline ? 'textarea' : 'input'); if (!multiline) input.type = name === 'rating' ? 'number' : 'text'; input.value = existing[name] || ''; input.dataset.meta = name;
    wrap.append(input); fields.append(wrap);
  });
  panel.append(fields);
  const actions = element('div', 'caps-v029-actions'); const save = element('button', 'primary', 'Save Capsularius metadata'); const close = element('button', '', 'Close');
  save.addEventListener('click', () => { const next = {}; fields.querySelectorAll('[data-meta]').forEach((input) => { next[input.dataset.meta] = input.value.trim(); }); all[key] = next; saveMeta(all); });
  close.addEventListener('click', () => panel.remove()); actions.append(save, close); panel.append(actions); document.body.append(panel);
  requestAnimationFrame(() => { const box = panel.getBoundingClientRect(); panel.style.left = `${Math.max(16, (window.innerWidth - box.width) / 2)}px`; panel.style.top = `${Math.max(16, (window.innerHeight - box.height) / 2)}px`; });
  let move = null;
  drag.addEventListener('pointerdown', (event) => { if (event.button !== 0) return; const box = panel.getBoundingClientRect(); move = { id: event.pointerId, x: event.clientX - box.left, y: event.clientY - box.top }; drag.setPointerCapture(event.pointerId); });
  drag.addEventListener('pointermove', (event) => { if (!move || event.pointerId !== move.id) return; const box = panel.getBoundingClientRect(); panel.style.left = `${Math.max(8, Math.min(window.innerWidth - box.width - 8, event.clientX - move.x))}px`; panel.style.top = `${Math.max(8, Math.min(window.innerHeight - box.height - 8, event.clientY - move.y))}px`; });
  drag.addEventListener('pointerup', () => { move = null; }); drag.addEventListener('pointercancel', () => { move = null; });
}

function augment(info) {
  const menu = document.getElementById('context-menu');
  if (!menu || menu.hidden) return;
  if (!menu.querySelector('[data-v029-refresh]')) {
    const refresh = element('button', 'context-item', '🔄 Refresh'); refresh.type = 'button'; refresh.dataset.v029Refresh = 'true';
    refresh.addEventListener('click', () => info.windowNode.querySelector('[data-action="refresh"]')?.click()); menu.insertBefore(refresh, menu.firstChild);
  }
  if (!menu.querySelector('[data-v029-properties]')) {
    const button = element('button', 'context-item', 'ℹ️ Properties…'); button.type = 'button'; button.dataset.v029Properties = 'true';
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); menu.hidden = true; properties(info); });
    const before = [...menu.querySelectorAll('button')].find((item) => item.textContent.includes('Permanently delete')) || null; menu.insertBefore(button, before);
  }
}

document.addEventListener('contextmenu', (event) => {
  if (!event.target.closest('.window-content') || event.target.closest('.caps-list-header,.caps-column-filter-menu')) return;
  const info = capture(event.target);
  if (info) window.setTimeout(() => augment(info), 0);
}, true);
