const VERSION = 'Capsularius · v0.29.0 — Workspace Controls';
const SIDEBAR_KEY = 'organon-capsularius-sidebar-width-v029';
const COLUMN_KEY = 'organon-capsularius-column-widths-v029';
const TYPE_KEY = 'organon-capsularius-type-labels-v029';
const META_KEY = 'organon-capsularius-file-metadata-v029';
const ORDER = ['name', 'size', 'modified', 'type', 'info', 'created'];
const DEFAULTS = { name: 260, size: 96, modified: 132, type: 145, info: 162, created: 126 };

function json(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value && typeof value === 'object' ? value : fallback;
  } catch (_) { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* no-op */ }
}

function widths() {
  const saved = json(COLUMN_KEY, {});
  return Object.fromEntries(ORDER.map((key) => [key, Math.max(64, Math.min(560, Number(saved[key]) || DEFAULTS[key]))]));
}

function template() {
  const values = widths();
  return ORDER.map((key) => `${values[key]}px`).join(' ');
}

function style() {
  if (document.getElementById('caps-v029-style')) return;
  const node = document.createElement('style');
  node.id = 'caps-v029-style';
  node.textContent = `
    .drive-add-button { display:none !important; }
    .folder-window { --caps-v029-sidebar: 186px; }
    .window-main { display:grid !important; grid-template-columns:var(--caps-v029-sidebar) 7px minmax(0,1fr) !important; min-width:0; }
    .window-sidebar { width:auto !important; min-width:0; overflow:auto; }
    .window-content { grid-column:3; min-width:0; }
    .caps-v029-sidebar-handle { grid-column:2; grid-row:1; z-index:9; cursor:col-resize; background:linear-gradient(90deg,transparent,rgba(224,163,96,.2),transparent); touch-action:none; }
    .caps-v029-sidebar-handle:hover,.caps-v029-sidebar-handle.dragging { background:rgba(117,178,222,.55); }
    .caps-list-header,.file-item.list.caps-list-row { grid-template-columns:var(--caps-v029-columns) !important; min-width:max-content !important; }
    .caps-list-header { display:grid !important; align-items:center; column-gap:10px; }
    .caps-v029-head-cell { position:relative; min-width:0; height:30px; }
    .caps-v029-head-cell > button { width:100%; min-width:0; }
    .caps-v029-col-handle { position:absolute; top:4px; right:-6px; z-index:10; width:12px; height:23px; cursor:col-resize; touch-action:none; }
    .caps-v029-col-handle::after { content:''; position:absolute; top:3px; bottom:3px; left:5px; border-left:1px solid rgba(224,163,96,.45); }
    .caps-v029-col-handle:hover::after,.caps-v029-col-handle.dragging::after { border-color:#75b2de; border-left-width:2px; }
    .file-item.list.caps-list-row > .file-item-main { grid-column:1 !important; min-width:0; }
    .file-item.list.caps-list-row > .file-meta { grid-column:2 !important; justify-self:start; }
    .file-item.list.caps-list-row > .caps-list-cell.modified { grid-column:3 !important; }
    .file-item.list.caps-list-row > .caps-list-cell.type { grid-column:4 !important; }
    .file-item.list.caps-list-row > .caps-list-cell.info { grid-column:5 !important; }
    .file-item.list.caps-list-row > .caps-list-cell.created { grid-column:6 !important; }
    .file-item.list.caps-list-row.caps-v029-stripe { background:rgba(255,255,255,.06) !important; }
    .caps-v029-context { position:fixed; z-index:10220; min-width:205px; padding:5px; border:1px solid rgba(224,163,96,.6); border-radius:8px; background:#211717; box-shadow:0 15px 42px rgba(0,0,0,.66); }
    .caps-v029-context button { display:block; width:100%; border:0; border-radius:5px; padding:8px 10px; color:#f3e5ce; background:transparent; text-align:left; font:inherit; font-size:12px; cursor:pointer; }
    .caps-v029-context button:hover { background:rgba(216,164,94,.18); }
    .caps-v029-context .separator { height:1px; margin:4px 2px; background:rgba(224,163,96,.25); }
    .caps-v029-properties { position:fixed; z-index:10230; width:min(510px,calc(100vw - 28px)); max-height:calc(100vh - 28px); overflow:auto; padding:0 18px 17px; border:1px solid #75b2de; border-radius:11px; color:#f2f7fb; background:linear-gradient(145deg,#1d2b39,#101923); box-shadow:0 24px 68px rgba(0,0,0,.74); }
    .caps-v029-drag { margin:0 -18px 15px; padding:10px 14px; border-bottom:1px solid rgba(117,178,222,.32); border-radius:10px 10px 0 0; color:#c9e7ff; background:rgba(0,0,0,.18); cursor:grab; font:700 10px var(--mono,monospace); letter-spacing:.09em; text-transform:uppercase; user-select:none; touch-action:none; }
    .caps-v029-drag:active { cursor:grabbing; }.caps-v029-properties h2 { margin:0 0 12px; font-size:18px; }.caps-v029-grid { display:grid; grid-template-columns:130px minmax(0,1fr); gap:8px 12px; font-size:12px; }.caps-v029-grid dt { color:#a8c7df; }.caps-v029-grid dd { min-width:0; margin:0; overflow-wrap:anywhere; }
    .caps-v029-fields { display:grid; gap:9px; margin-top:17px; }.caps-v029-fields label { display:grid; gap:4px; color:#b9d4e9; font-size:11px; }.caps-v029-fields input,.caps-v029-fields textarea,.caps-v029-type-row input,.caps-v029-type-add input { width:100%; box-sizing:border-box; border:1px solid rgba(117,178,222,.45); border-radius:6px; padding:7px 8px; color:#eef7ff; background:#0d1721; font:inherit; font-size:12px; }.caps-v029-fields textarea { min-height:62px; resize:vertical; }.caps-v029-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:15px; }.caps-v029-actions button,.caps-v029-type-add button { border:1px solid rgba(117,178,222,.55); border-radius:6px; padding:7px 10px; color:#eef7ff; background:#162b3b; font:inherit; font-size:12px; cursor:pointer; }.caps-v029-actions button.primary,.caps-v029-type-add button.primary { color:#07131e; background:#75b2de; font-weight:800; }
    .caps-v029-type-list { display:grid; gap:8px; max-height:390px; overflow:auto; margin:13px 0; }.caps-v029-type-row { display:grid; grid-template-columns:90px minmax(0,1fr); gap:9px; align-items:center; }.caps-v029-type-row code { color:#d2ebff; font:12px var(--mono,monospace); }.caps-v029-type-add { display:grid; grid-template-columns:110px minmax(0,1fr) auto; gap:8px; }.caps-v029-type-button { margin-right:auto; }
  `;
  document.head.append(node);
}

function folderWindow(node) { return node.closest('.folder-window'); }
function closeMenu() { document.querySelector('.caps-v029-context')?.remove(); }
function text(node, selector) { return node.querySelector(selector)?.textContent?.trim() || '—'; }

function applyToolbar(windowNode) {
  const glyphs = { '[data-action="back"]':'⬅️', '[data-action="forward"]':'➡️', '[data-action="up"]':'⬆️', '[data-action="refresh"]':'🔄', '[data-command="new-folder"]':'📁➕' };
  Object.entries(glyphs).forEach(([selector, value]) => {
    const button = windowNode.querySelector(selector);
    if (button && button.dataset.capsV029Emoji !== value) { button.textContent = value; button.dataset.capsV029Emoji = value; }
  });
}

function addSidebarHandle(windowNode) {
  const main = windowNode.querySelector('.window-main');
  const content = windowNode.querySelector('.window-content');
  if (!main || !content || main.querySelector('.caps-v029-sidebar-handle')) return;
  const saved = Math.max(140, Math.min(420, Number(localStorage.getItem(SIDEBAR_KEY)) || 186));
  main.style.setProperty('--caps-v029-sidebar', `${saved}px`);
  const handle = document.createElement('div');
  handle.className = 'caps-v029-sidebar-handle';
  handle.title = 'Drag to resize navigation pane';
  main.insertBefore(handle, content);
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = event.clientX;
    const startWidth = Number.parseFloat(getComputedStyle(main).getPropertyValue('--caps-v029-sidebar')) || saved;
    handle.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const max = Math.max(180, windowNode.getBoundingClientRect().width - 190);
      const width = Math.max(140, Math.min(max, Math.round(startWidth + moveEvent.clientX - start)));
      main.style.setProperty('--caps-v029-sidebar', `${width}px`);
      localStorage.setItem(SIDEBAR_KEY, String(width));
    };
    const end = () => { handle.classList.remove('dragging'); handle.removeEventListener('pointermove', move); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end, { once:true });
    handle.addEventListener('pointercancel', end, { once:true });
  });
}

function keyForHeader(button) {
  const value = button.textContent.trim();
  if (value.startsWith('Name')) return 'name';
  if (value.startsWith('Size')) return 'size';
  if (value.startsWith('Date modified')) return 'modified';
  if (value.startsWith('Type')) return 'type';
  if (value.startsWith('Length')) return 'info';
  if (value.startsWith('Date created')) return 'created';
  return '';
}

function applyColumns(windowNode) {
  const columnTemplate = template();
  const content = windowNode.querySelector('.window-content');
  if (content) content.style.setProperty('--caps-v029-columns', columnTemplate);
  const header = windowNode.querySelector('.caps-list-header');
  if (header && !header.dataset.capsV029) {
    const buttons = [...header.querySelectorAll(':scope > button')];
    const lookup = new Map(buttons.map((button) => [keyForHeader(button), button]));
    header.replaceChildren();
    ORDER.forEach((key, index) => {
      const cell = document.createElement('div');
      cell.className = 'caps-v029-head-cell';
      const button = lookup.get(key);
      if (button) cell.append(button);
      if (index < ORDER.length - 1) {
        const drag = document.createElement('span');
        drag.className = 'caps-v029-col-handle';
        drag.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          const all = widths(); const start = event.clientX; const initial = all[key];
          drag.classList.add('dragging'); drag.setPointerCapture(event.pointerId);
          const move = (moveEvent) => {
            all[key] = Math.max(64, Math.min(560, Math.round(initial + moveEvent.clientX - start)));
            save(COLUMN_KEY, all);
            document.querySelectorAll('.window-content').forEach((pane) => pane.style.setProperty('--caps-v029-columns', template()));
          };
          const end = () => { drag.classList.remove('dragging'); drag.removeEventListener('pointermove', move); };
          drag.addEventListener('pointermove', move);
          drag.addEventListener('pointerup', end, { once:true });
          drag.addEventListener('pointercancel', end, { once:true });
        });
        cell.append(drag);
      }
      header.append(cell);
    });
    header.dataset.capsV029 = 'true';
  }
  [...windowNode.querySelectorAll('.file-item.list.caps-list-row')].forEach((row, index) => {
    row.classList.toggle('caps-v029-stripe', index % 2 === 1);
    row.style.setProperty('--caps-v029-columns', columnTemplate);
    const type = row.querySelector('.caps-list-cell.type');
    if (type && !type.dataset.capsV029Default) type.dataset.capsV029Default = type.textContent.trim();
    applyTypeLabel(type);
  });
}

function extensionFromType(cell) {
  const value = cell?.dataset.capsV029Default || cell?.textContent || '';
  return value.match(/\.([A-Za-z0-9]+)\s*$/)?.[1]?.toLowerCase() || '';
}

function applyTypeLabel(cell) {
  if (!cell) return;
  const extension = extensionFromType(cell);
  const labels = json(TYPE_KEY, {});
  const custom = extension ? String(labels[extension] || '').trim() : '';
  cell.textContent = custom || cell.dataset.capsV029Default || cell.textContent;
}

function enhance(windowNode) {
  addSidebarHandle(windowNode);
  applyToolbar(windowNode);
  applyColumns(windowNode);
}

function dragPanel(panel, handle) {
  let drag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    drag = { id:event.pointerId, x:event.clientX - rect.left, y:event.clientY - rect.top };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.x))}px`;
    panel.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - drag.y))}px`;
  });
  const end = () => { drag = null; };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}

function properties(info) {
  document.querySelector('.caps-v029-properties')?.remove();
  const panel = document.createElement('section'); panel.className = 'caps-v029-properties';
  const drag = document.createElement('div'); drag.className = 'caps-v029-drag'; drag.textContent = 'Capsularius · Properties'; panel.append(drag);
  const heading = document.createElement('h2'); heading.textContent = info.name; panel.append(heading);
  const dl = document.createElement('dl'); dl.className = 'caps-v029-grid';
  [['Location',info.location],['Type',info.type],['Size',info.size],['Date modified',info.modified],['Date created',info.created],['Length / dimensions',info.details]].forEach(([label,value]) => { const dt=document.createElement('dt'); dt.textContent=label; const dd=document.createElement('dd'); dd.textContent=value; dl.append(dt,dd); }); panel.append(dl);
  const key = `${info.location}|${info.name}`; const all = json(META_KEY, {}); const existing = all[key] || {};
  const fields = document.createElement('div'); fields.className = 'caps-v029-fields';
  [['Title','title',false],['Tags','tags',false],['Rating (0–5)','rating',false],['Description','description',true],['Notes','notes',true]].forEach(([label,name,multiline]) => { const wrap=document.createElement('label'); const cap=document.createElement('span'); cap.textContent=label; const input=document.createElement(multiline?'textarea':'input'); if (!multiline) input.type=name==='rating'?'number':'text'; input.value=existing[name]||''; input.dataset.meta=name; wrap.append(cap,input); fields.append(wrap); }); panel.append(fields);
  const actions=document.createElement('div'); actions.className='caps-v029-actions'; const saveButton=document.createElement('button'); saveButton.className='primary'; saveButton.textContent='Save Capsularius metadata'; const close=document.createElement('button'); close.textContent='Close';
  saveButton.addEventListener('click',()=>{ const next={}; fields.querySelectorAll('[data-meta]').forEach((input)=>{ next[input.dataset.meta]=input.value.trim(); }); all[key]=next; save(META_KEY,all); }); close.addEventListener('click',()=>panel.remove()); actions.append(saveButton,close); panel.append(actions);
  document.body.append(panel); requestAnimationFrame(()=>{ const rect=panel.getBoundingClientRect(); panel.style.left=`${Math.max(16,(window.innerWidth-rect.width)/2)}px`; panel.style.top=`${Math.max(16,(window.innerHeight-rect.height)/2)}px`; }); dragPanel(panel,drag);
}

function contextMenu(info, windowNode, fileNode) {
  closeMenu();
  const menu=document.createElement('div'); menu.className='caps-v029-context';
  const add=(label,action,separator=false)=>{ if(separator){const line=document.createElement('div');line.className='separator';menu.append(line);} const button=document.createElement('button');button.textContent=label;button.addEventListener('click',()=>{closeMenu();action();});menu.append(button); };
  if (fileNode) {
    add('ℹ️ Properties…',()=>properties(info));
    add('🔄 Refresh',()=>windowNode.querySelector('[data-action="refresh"]')?.click());
  } else {
    add('🔄 Refresh',()=>windowNode.querySelector('[data-action="refresh"]')?.click());
  }
  menu.style.left=`${Math.min(info.x,window.innerWidth-230)}px`; menu.style.top=`${Math.min(info.y,window.innerHeight-150)}px`; document.body.append(menu);
}

function infoFromTarget(target, event) {
  const file=target.closest('.file-item'); const windowNode=folderWindow(target); if(!windowNode) return null;
  const title=windowNode.querySelector('.window-title')?.textContent?.trim()||'Capsularius';
  if(!file) return {windowNode,file:null,name:'Current folder',location:title,type:'Folder',size:'—',modified:'—',created:'—',details:'—',x:event.clientX,y:event.clientY};
  return {windowNode,file,name:text(file,'.file-name'),location:title,type:text(file,'.caps-list-cell.type'),size:text(file,'.file-meta'),modified:text(file,'.caps-list-cell.modified'),created:text(file,'.caps-list-cell.created'),details:text(file,'.caps-list-cell.info'),x:event.clientX,y:event.clientY};
}

function typeSettings() {
  const backdrop=document.createElement('div'); backdrop.className='modal-backdrop caps-v029-type-backdrop'; const card=document.createElement('section'); card.className='modal-card';
  const eyebrow=document.createElement('p'); eyebrow.className='eyebrow'; eyebrow.textContent='Capsularius global settings'; const heading=document.createElement('h2'); heading.textContent='File type labels'; const description=document.createElement('p'); description.className='modal-description'; description.textContent='Set exactly what appears in the Type column for each extension. These labels are stored locally in this browser.'; card.append(eyebrow,heading,description);
  const labels=json(TYPE_KEY,{}); const extensions=new Set(Object.keys(labels)); document.querySelectorAll('.caps-list-cell.type').forEach((cell)=>{const extension=extensionFromType(cell);if(extension)extensions.add(extension);}); const list=document.createElement('div'); list.className='caps-v029-type-list';
  const render=()=>{list.replaceChildren();[...extensions].sort().forEach((extension)=>{const row=document.createElement('label');row.className='caps-v029-type-row';const code=document.createElement('code');code.textContent=`.${extension}`;const input=document.createElement('input');input.value=labels[extension]||'';input.placeholder='Leave blank for default';input.dataset.extension=extension;row.append(code,input);list.append(row);});}; render(); card.append(list);
  const add=document.createElement('div');add.className='caps-v029-type-add';const ext=document.createElement('input');ext.placeholder='Extension, e.g. fbx';const value=document.createElement('input');value.placeholder='Type text, e.g. 3D Model · .fbx';const addButton=document.createElement('button');addButton.textContent='Add';addButton.addEventListener('click',()=>{const key=ext.value.trim().replace(/^\./,'').toLowerCase();if(!key)return;extensions.add(key);labels[key]=value.value.trim();ext.value='';value.value='';render();});add.append(ext,value,addButton);card.append(add);
  const actions=document.createElement('div');actions.className='modal-actions';const saveButton=document.createElement('button');saveButton.className='action-button primary';saveButton.textContent='Save labels';const cancel=document.createElement('button');cancel.className='action-button';cancel.textContent='Cancel';saveButton.addEventListener('click',()=>{list.querySelectorAll('[data-extension]').forEach((input)=>{const key=input.dataset.extension;const text=input.value.trim();if(text)labels[key]=text;else delete labels[key];});save(TYPE_KEY,labels);document.querySelectorAll('.caps-list-cell.type').forEach(applyTypeLabel);backdrop.remove();});cancel.addEventListener('click',()=>backdrop.remove());actions.append(saveButton,cancel);card.append(actions);backdrop.append(card);document.getElementById('dialog-layer').append(backdrop);
}

function injectTypeButton() {
  const footer=document.querySelector('.caps-location-dialog .caps-location-footer');
  if(!footer||footer.querySelector('.caps-v029-type-button'))return;
  const button=document.createElement('button');button.className='caps-v029-type-button';button.textContent='File type labels';button.addEventListener('click',typeSettings);footer.insertBefore(button,footer.firstChild);
}

function scan() {
  document.querySelectorAll('.folder-window').forEach(enhance);
  injectTypeButton();
  const badge=document.querySelector('.app-badge'); if(badge)badge.textContent=VERSION;
}

style();
const observer=new MutationObserver(()=>requestAnimationFrame(scan));
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('contextmenu',(event)=>{ const target=event.target; if(!target.closest('.window-content')||target.closest('.caps-list-header,.caps-column-filter-menu'))return; const info=infoFromTarget(target,event); if(!info)return; setTimeout(()=>contextMenu(info,info.windowNode,info.file),0); });
document.addEventListener('pointerdown',(event)=>{if(!event.target.closest('.caps-v029-context'))closeMenu();});
setTimeout(scan,60);
