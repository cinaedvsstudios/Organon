const VERSION = 'Capsularius · v0.29.0 — Workspace Controls';
const SIDEBAR_KEY = 'organon-capsularius-sidebar-width-v029';
const COLUMN_KEY = 'organon-capsularius-column-widths-v029';
const TYPE_KEY = 'organon-capsularius-type-labels-v029';
const META_KEY = 'organon-capsularius-file-metadata-v029';
const ORDER = ['name', 'size', 'modified', 'type', 'info', 'created'];
const DEFAULTS = { name: 260, size: 96, modified: 132, type: 145, info: 162, created: 126 };
let queued = false;

function read(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || ''); return value && typeof value === 'object' ? value : fallback; } catch (_) { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* no-op */ } }
function widths() { const saved = read(COLUMN_KEY, {}); return Object.fromEntries(ORDER.map((key) => [key, Math.max(64, Math.min(560, Number(saved[key]) || DEFAULTS[key]))])); }
function columnTemplate() { const values = widths(); return ORDER.map((key) => `${values[key]}px`).join(' '); }
function node(tag, className, text) { const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; }
function fileText(item, selector) { return item.querySelector(selector)?.textContent?.trim() || '—'; }

function addStyles() {
  if (document.getElementById('caps-v029-style')) return;
  const css = node('style'); css.id = 'caps-v029-style'; css.textContent = `
    .drive-add-button{display:none!important}.folder-window{--caps-v029-sidebar:186px}.window-main{display:grid!important;grid-template-columns:var(--caps-v029-sidebar) 7px minmax(0,1fr)!important;min-width:0}.window-sidebar{width:auto!important;min-width:0;overflow:auto}.window-content{grid-column:3;min-width:0}.caps-v029-sidebar-handle{grid-column:2;grid-row:1;z-index:9;cursor:col-resize;background:linear-gradient(90deg,transparent,rgba(224,163,96,.2),transparent);touch-action:none}.caps-v029-sidebar-handle:hover,.caps-v029-sidebar-handle.dragging{background:rgba(117,178,222,.55)}
    .caps-list-header,.file-item.list.caps-list-row{grid-template-columns:var(--caps-v029-columns)!important;min-width:max-content!important}.caps-list-header{display:grid!important;align-items:center;column-gap:10px}.caps-v029-head{position:relative;min-width:0;height:30px}.caps-v029-head>button{width:100%;min-width:0}.caps-v029-col-handle{position:absolute;top:4px;right:-6px;z-index:10;width:12px;height:23px;cursor:col-resize;touch-action:none}.caps-v029-col-handle:after{content:'';position:absolute;top:3px;bottom:3px;left:5px;border-left:1px solid rgba(224,163,96,.45)}.caps-v029-col-handle:hover:after,.caps-v029-col-handle.dragging:after{border-color:#75b2de;border-left-width:2px}.file-item.list.caps-list-row>.file-item-main{grid-column:1!important;min-width:0}.file-item.list.caps-list-row>.file-meta{grid-column:2!important;justify-self:start}.file-item.list.caps-list-row>.caps-list-cell.modified{grid-column:3!important}.file-item.list.caps-list-row>.caps-list-cell.type{grid-column:4!important}.file-item.list.caps-list-row>.caps-list-cell.info{grid-column:5!important}.file-item.list.caps-list-row>.caps-list-cell.created{grid-column:6!important}.file-item.list.caps-list-row.caps-v029-stripe{background:rgba(255,255,255,.06)!important}
    .caps-v029-properties{position:fixed;z-index:10230;width:min(510px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;padding:0 18px 17px;border:1px solid #75b2de;border-radius:11px;color:#f2f7fb;background:linear-gradient(145deg,#1d2b39,#101923);box-shadow:0 24px 68px rgba(0,0,0,.74)}.caps-v029-drag{margin:0 -18px 15px;padding:10px 14px;border-bottom:1px solid rgba(117,178,222,.32);border-radius:10px 10px 0 0;color:#c9e7ff;background:rgba(0,0,0,.18);cursor:grab;font:700 10px var(--mono,monospace);letter-spacing:.09em;text-transform:uppercase;user-select:none;touch-action:none}.caps-v029-drag:active{cursor:grabbing}.caps-v029-properties h2{margin:0 0 12px;font-size:18px}.caps-v029-grid{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px 12px;font-size:12px}.caps-v029-grid dt{color:#a8c7df}.caps-v029-grid dd{min-width:0;margin:0;overflow-wrap:anywhere}.caps-v029-fields{display:grid;gap:9px;margin-top:17px}.caps-v029-fields label{display:grid;gap:4px;color:#b9d4e9;font-size:11px}.caps-v029-fields input,.caps-v029-fields textarea,.caps-v029-type-row input,.caps-v029-type-add input{width:100%;box-sizing:border-box;border:1px solid rgba(117,178,222,.45);border-radius:6px;padding:7px 8px;color:#eef7ff;background:#0d1721;font:inherit;font-size:12px}.caps-v029-fields textarea{min-height:62px;resize:vertical}.caps-v029-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.caps-v029-actions button,.caps-v029-type-add button{border:1px solid rgba(117,178,222,.55);border-radius:6px;padding:7px 10px;color:#eef7ff;background:#162b3b;font:inherit;font-size:12px;cursor:pointer}.caps-v029-actions button.primary,.caps-v029-type-add button.primary{color:#07131e;background:#75b2de;font-weight:800}.caps-v029-type-list{display:grid;gap:8px;max-height:390px;overflow:auto;margin:13px 0}.caps-v029-type-row{display:grid;grid-template-columns:90px minmax(0,1fr);gap:9px;align-items:center}.caps-v029-type-row code{color:#d2ebff;font:12px var(--mono,monospace)}.caps-v029-type-add{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:8px}.caps-v029-type-button{margin-right:auto}
  `; document.head.append(css);
}

function toolbar(windowNode) {
  const glyphs = { '[data-action="back"]':'⬅️', '[data-action="forward"]':'➡️', '[data-action="up"]':'⬆️', '[data-action="refresh"]':'🔄', '[data-command="new-folder"]':'📁➕' };
  Object.entries(glyphs).forEach(([selector, emoji]) => { const button = windowNode.querySelector(selector); if (button && button.dataset.capsV029 !== emoji) { button.textContent = emoji; button.dataset.capsV029 = emoji; } });
}

function sidebar(windowNode) {
  const main = windowNode.querySelector('.window-main'); const content = windowNode.querySelector('.window-content');
  if (!main || !content || main.querySelector('.caps-v029-sidebar-handle')) return;
  const width = Math.max(140, Math.min(420, Number(localStorage.getItem(SIDEBAR_KEY)) || 186)); main.style.setProperty('--caps-v029-sidebar', `${width}px`);
  const handle = node('div', 'caps-v029-sidebar-handle'); handle.title = 'Drag to resize navigation pane'; main.insertBefore(handle, content);
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return; event.preventDefault(); const startX = event.clientX; const startWidth = Number.parseFloat(getComputedStyle(main).getPropertyValue('--caps-v029-sidebar')) || width;
    handle.classList.add('dragging'); handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => { const max = Math.max(180, windowNode.getBoundingClientRect().width - 190); const next = Math.max(140, Math.min(max, Math.round(startWidth + moveEvent.clientX - startX))); main.style.setProperty('--caps-v029-sidebar', `${next}px`); localStorage.setItem(SIDEBAR_KEY, String(next)); };
    const end = () => { handle.classList.remove('dragging'); handle.removeEventListener('pointermove', move); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end, { once:true }); handle.addEventListener('pointercancel', end, { once:true });
  });
}

function columnKey(button) {
  const text = button.textContent.trim();
  if (text.startsWith('Name')) return 'name'; if (text.startsWith('Size')) return 'size'; if (text.startsWith('Date modified')) return 'modified'; if (text.startsWith('Type')) return 'type'; if (text.startsWith('Length')) return 'info'; if (text.startsWith('Date created')) return 'created'; return '';
}

function typeExtension(cell) { return (cell?.dataset.capsV029Default || cell?.textContent || '').match(/\.([A-Za-z0-9]+)\s*$/)?.[1]?.toLowerCase() || ''; }
function typeLabel(cell) { if (!cell) return; if (!cell.dataset.capsV029Default) cell.dataset.capsV029Default = cell.textContent.trim(); const extension = typeExtension(cell); const custom = String(read(TYPE_KEY, {})[extension] || '').trim(); cell.textContent = custom || cell.dataset.capsV029Default; }

function columns(windowNode) {
  const template = columnTemplate(); const content = windowNode.querySelector('.window-content'); if (content) content.style.setProperty('--caps-v029-columns', template);
  const header = windowNode.querySelector('.caps-list-header');
  if (header && !header.dataset.capsV029) {
    const buttons = [...header.querySelectorAll(':scope > button')]; const lookup = new Map(buttons.map((button) => [columnKey(button), button])); header.replaceChildren();
    ORDER.forEach((key, index) => {
      const cell = node('div', 'caps-v029-head'); const button = lookup.get(key); if (button) cell.append(button);
      if (index < ORDER.length - 1) { const drag = node('span', 'caps-v029-col-handle'); drag.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return; event.preventDefault(); const all = widths(); const initial = all[key]; const start = event.clientX; drag.classList.add('dragging'); drag.setPointerCapture(event.pointerId);
        const move = (moveEvent) => { all[key] = Math.max(64, Math.min(560, Math.round(initial + moveEvent.clientX - start))); write(COLUMN_KEY, all); document.querySelectorAll('.window-content').forEach((pane) => pane.style.setProperty('--caps-v029-columns', columnTemplate())); };
        const end = () => { drag.classList.remove('dragging'); drag.removeEventListener('pointermove', move); }; drag.addEventListener('pointermove', move); drag.addEventListener('pointerup', end, { once:true }); drag.addEventListener('pointercancel', end, { once:true });
      }); cell.append(drag); }
      header.append(cell);
    }); header.dataset.capsV029 = 'true';
  }
  [...windowNode.querySelectorAll('.file-item.list.caps-list-row')].forEach((row, index) => { row.classList.toggle('caps-v029-stripe', index % 2 === 1); row.style.setProperty('--caps-v029-columns', columnTemplate()); typeLabel(row.querySelector('.caps-list-cell.type')); });
}

function dragPanel(panel, handle) {
  let drag = null; handle.addEventListener('pointerdown', (event) => { if (event.button !== 0) return; event.preventDefault(); const rect = panel.getBoundingClientRect(); drag = { id:event.pointerId, x:event.clientX - rect.left, y:event.clientY - rect.top }; handle.setPointerCapture(event.pointerId); });
  handle.addEventListener('pointermove', (event) => { if (!drag || event.pointerId !== drag.id) return; const rect = panel.getBoundingClientRect(); panel.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.x))}px`; panel.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - drag.y))}px`; });
  handle.addEventListener('pointerup', () => { drag = null; }); handle.addEventListener('pointercancel', () => { drag = null; });
}

function properties(info) {
  document.querySelector('.caps-v029-properties')?.remove(); const panel = node('section', 'caps-v029-properties'); const drag = node('div', 'caps-v029-drag', 'Capsularius · Properties'); panel.append(drag, node('h2', '', info.name));
  const dl = node('dl', 'caps-v029-grid'); [['Location',info.location],['Type',info.type],['Size',info.size],['Date modified',info.modified],['Date created',info.created],['Length / dimensions',info.details]].forEach(([label,value]) => { dl.append(node('dt','',label),node('dd','',value)); }); panel.append(dl);
  const key = `${info.location}|${info.name}`, all = read(META_KEY, {}), previous = all[key] || {}, fields = node('div','caps-v029-fields');
  [['Title','title',false],['Tags','tags',false],['Rating (0–5)','rating',false],['Description','description',true],['Notes','notes',true]].forEach(([label,name,multiline]) => { const wrap=node('label'); wrap.append(node('span','',label)); const input=document.createElement(multiline?'textarea':'input'); if(!multiline) input.type=name==='rating'?'number':'text'; input.value=previous[name]||''; input.dataset.meta=name; wrap.append(input); fields.append(wrap); }); panel.append(fields);
  const actions=node('div','caps-v029-actions'), saveButton=node('button','primary','Save Capsularius metadata'), close=node('button','', 'Close'); saveButton.addEventListener('click',()=>{ const values={}; fields.querySelectorAll('[data-meta]').forEach((input)=>{values[input.dataset.meta]=input.value.trim();}); all[key]=values; write(META_KEY,all); }); close.addEventListener('click',()=>panel.remove()); actions.append(saveButton,close); panel.append(actions); document.body.append(panel);
  requestAnimationFrame(()=>{const rect=panel.getBoundingClientRect();panel.style.left=`${Math.max(16,(window.innerWidth-rect.width)/2)}px`;panel.style.top=`${Math.max(16,(window.innerHeight-rect.height)/2)}px`;}); dragPanel(panel,drag);
}

function currentInfo(target) {
  const file = target.closest('.file-item'); const windowNode = target.closest('.folder-window'); if (!windowNode) return null; const location = windowNode.querySelector('.window-title')?.textContent.trim() || 'Capsularius';
  return file ? { file, windowNode, name:fileText(file,'.file-name'), location, type:fileText(file,'.caps-list-cell.type'), size:fileText(file,'.file-meta'), modified:fileText(file,'.caps-list-cell.modified'), created:fileText(file,'.caps-list-cell.created'), details:fileText(file,'.caps-list-cell.info') } : { file:null, windowNode, name:'Current folder', location, type:'Folder', size:'—', modified:'—', created:'—', details:'—' };
}

function augmentContext(info) {
  const menu = document.getElementById('context-menu'); if (!menu || menu.hidden) return;
  const add = (label, handler, before = null) => { const button = node('button','context-item',label); button.type='button'; button.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();menu.hidden=true;handler();}); if(before) menu.insertBefore(button,before); else menu.append(button); };
  if (!menu.querySelector('[data-v029-refresh]')) { const button=node('button','context-item','🔄 Refresh'); button.type='button'; button.dataset.v029Refresh='true'; button.addEventListener('click',()=>info.windowNode.querySelector('[data-action="refresh"]')?.click()); menu.insertBefore(button,menu.firstChild); }
  if (info.file && !menu.querySelector('[data-v029-properties]')) { const anchor=[...menu.querySelectorAll('button')].find((button)=>button.textContent.includes('Permanently delete')) || null; const button=node('button','context-item','ℹ️ Properties…'); button.type='button'; button.dataset.v029Properties='true'; button.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();menu.hidden=true;properties(info);}); menu.insertBefore(button,anchor); }
}

function typeSettings() {
  const backdrop=node('div','modal-backdrop'), card=node('section','modal-card'); card.append(node('p','eyebrow','Capsularius global settings'),node('h2','','File type labels'),node('p','modal-description','Set exactly what appears in the Type column for each extension. These labels are stored locally in this browser.'));
  const labels=read(TYPE_KEY,{}), extensions=new Set(Object.keys(labels)); document.querySelectorAll('.caps-list-cell.type').forEach((cell)=>{const extension=typeExtension(cell);if(extension)extensions.add(extension);}); const list=node('div','caps-v029-type-list');
  const render=()=>{list.replaceChildren();[...extensions].sort().forEach((extension)=>{const row=node('label','caps-v029-type-row');const code=node('code','',`.${extension}`);const input=document.createElement('input');input.value=labels[extension]||'';input.placeholder='Leave blank for default';input.dataset.extension=extension;row.append(code,input);list.append(row);});};render();card.append(list);
  const add=node('div','caps-v029-type-add'),ext=document.createElement('input'),value=document.createElement('input'),addButton=node('button','', 'Add');ext.placeholder='Extension, e.g. fbx';value.placeholder='Type text, e.g. 3D Model · .fbx';addButton.addEventListener('click',()=>{const key=ext.value.trim().replace(/^\./,'').toLowerCase();if(!key)return;extensions.add(key);labels[key]=value.value.trim();ext.value='';value.value='';render();});add.append(ext,value,addButton);card.append(add);
  const actions=node('div','modal-actions'),saveButton=node('button','action-button primary','Save labels'),cancel=node('button','action-button','Cancel');saveButton.addEventListener('click',()=>{list.querySelectorAll('[data-extension]').forEach((input)=>{const key=input.dataset.extension,text=input.value.trim();if(text)labels[key]=text;else delete labels[key];});write(TYPE_KEY,labels);document.querySelectorAll('.caps-list-cell.type').forEach(typeLabel);backdrop.remove();});cancel.addEventListener('click',()=>backdrop.remove());actions.append(saveButton,cancel);card.append(actions);backdrop.append(card);document.getElementById('dialog-layer').append(backdrop);
}

function settingsButton() { const footer=document.querySelector('.caps-location-dialog .caps-location-footer'); if(!footer||footer.querySelector('.caps-v029-type-button'))return;const button=node('button','caps-v029-type-button','File type labels');button.addEventListener('click',typeSettings);footer.insertBefore(button,footer.firstChild); }

function scan() { queued=false; document.querySelectorAll('.folder-window').forEach((windowNode)=>{sidebar(windowNode);toolbar(windowNode);columns(windowNode);});settingsButton();const badge=document.querySelector('.app-badge');if(badge&&badge.textContent!==VERSION)badge.textContent=VERSION; }
function schedule(){if(queued)return;queued=true;requestAnimationFrame(scan);}

addStyles();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('contextmenu',(event)=>{if(!event.target.closest('.window-content')||event.target.closest('.caps-list-header,.caps-column-filter-menu'))return;const info=currentInfo(event.target);if(info)setTimeout(()=>augmentContext(info),0);});schedule();
