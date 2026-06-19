import { extensionOf, formatBytes, hydrateFileEntry } from './filesystem.js';
import { fileTypeDescriptor } from './file-types.js';
import { openPreviewWindow, openPropertiesWindow } from './asset-windows.js';

const SIDEBAR_KEY = 'capsularius.sidebarWidth.v1';
const COLUMN_KEY = 'capsularius.columnWidths.v1';
const COLUMNS = [
  ['name', 'Name'],
  ['size', 'Size'],
  ['modified', 'Date modified'],
  ['type', 'Type'],
  ['info', 'Length / Dimensions'],
  ['created', 'Date created']
];
const DEFAULT_WIDTHS = { name:260, size:92, modified:132, type:178, info:168, created:126 };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value && typeof value === 'object' ? value : fallback;
  } catch (_) { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function columnWidths() {
  const saved = readJson(COLUMN_KEY, {});
  return Object.fromEntries(COLUMNS.map(([key]) => [key,Math.max(64,Math.min(560,Number(saved[key]) || DEFAULT_WIDTHS[key]))]));
}

function columnTemplate() {
  const widths = columnWidths();
  return COLUMNS.map(([key]) => `${widths[key]}px`).join(' ');
}

function formatDate(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.DateTimeFormat(undefined,{ year:'numeric', month:'short', day:'2-digit' }).format(new Date(value));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}` : `${minutes}:${String(remainder).padStart(2,'0')}`;
}

function infoFor(entry) {
  if (entry.kind !== 'file') return '—';
  const meta = entry.capsulariusMeta || {};
  const dimensions = Number.isFinite(meta.width) && Number.isFinite(meta.height) ? `${meta.width} × ${meta.height}` : '';
  const duration = Number.isFinite(meta.duration) ? formatDuration(meta.duration) : '';
  const loading = entry.metadataPending || !meta.status;
  if (entry.fileType === 'video') return [duration,dimensions].filter(Boolean).join(' · ') || (loading ? 'Reading…' : '—');
  if (entry.fileType === 'audio') return duration || (loading ? 'Reading…' : '—');
  if (entry.fileType === 'image') return dimensions || (loading ? 'Reading…' : '—');
  return '—';
}

function createdFor(entry) {
  const raw = entry.createdTime || entry.dateCreated || entry.capsulariusMeta?.createdTime;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string') return Date.parse(raw);
  return Number(raw);
}

function listState(record) {
  if (!record.listState) record.listState = { sortKey:'name', sortDirection:'asc', filters:{ name:'', types:[], extensions:[], size:'any', modified:'any', created:'any' } };
  return record.listState;
}

function sortValue(entry, key) {
  if (key === 'name') return entry.name.toLocaleLowerCase();
  if (key === 'size') return Number.isFinite(entry.size) ? entry.size : -1;
  if (key === 'modified') return Number.isFinite(entry.lastModified) ? entry.lastModified : -1;
  if (key === 'created') return Number.isFinite(createdFor(entry)) ? createdFor(entry) : -1;
  if (key === 'type') return fileTypeDescriptor(entry.name).label.toLocaleLowerCase();
  if (key === 'info') {
    const meta = entry.capsulariusMeta || {};
    return (meta.duration || 0) * 10000000 + (meta.width || 0) * 10000 + (meta.height || 0);
  }
  return '';
}

function filterEntries(entries, record) {
  const filters = listState(record).filters;
  const needle = filters.name.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const extension = extensionOf(entry.name);
    if (needle && !entry.name.toLocaleLowerCase().includes(needle)) return false;
    if (filters.types.length && !filters.types.includes(entry.fileType || 'file')) return false;
    if (filters.extensions.length && !filters.extensions.includes(extension)) return false;
    return true;
  });
}

function sortedEntries(entries, record) {
  const { sortKey, sortDirection } = listState(record);
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...filterEntries(entries,record)].sort((first,second) => {
    if (first.kind !== second.kind) return first.kind === 'directory' ? -1 : 1;
    const one = sortValue(first,sortKey);
    const two = sortValue(second,sortKey);
    if (typeof one === 'string' || typeof two === 'string') return String(one).localeCompare(String(two),undefined,{numeric:true,sensitivity:'base'}) * direction;
    return (one - two) * direction;
  });
}

function closeFilter() { document.querySelector('.caps-column-filter-menu')?.remove(); }

function showFilter(workspace, record, key, event) {
  event.preventDefault();
  closeFilter();
  const state = listState(record);
  const menu = el('div','caps-column-filter-menu');
  const label = COLUMNS.find(([id]) => id === key)?.[1] || key;
  menu.append(el('div','caps-filter-heading',`Filter ${label}`));
  const body = el('div','caps-filter-body');
  if (key === 'name') {
    const input = document.createElement('input');
    input.type='search'; input.value=state.filters.name; input.placeholder='Name contains…'; input.dataset.nameFilter='true';
    body.append(input);
  } else if (key === 'type') {
    const types = [...new Set(record.items.map((entry)=>entry.fileType || 'file'))].sort();
    const extensions = [...new Set(record.items.map((entry)=>extensionOf(entry.name)).filter(Boolean))].sort();
    body.append(el('strong','caps-filter-group-title','File categories'));
    types.forEach((type) => {
      const labelNode=el('label','caps-filter-check');const input=document.createElement('input');input.type='checkbox';input.value=type;input.checked=state.filters.types.includes(type);labelNode.append(input,el('span','',type));body.append(labelNode);
    });
    if (extensions.length) {
      body.append(el('strong','caps-filter-group-title','Extensions present here'));
      extensions.forEach((extension) => {
        const labelNode=el('label','caps-filter-check');const input=document.createElement('input');input.type='checkbox';input.value=`.${extension}`;input.checked=state.filters.extensions.includes(extension);labelNode.append(input,el('span','',`.${extension}`));body.append(labelNode);
      });
    }
  } else {
    body.append(el('div','','Click a column header to sort it. Name and Type support filters.'));
  }
  const actions=el('div','caps-filter-actions');const clear=el('button','','Clear');const apply=el('button','primary','Apply');
  clear.addEventListener('click',()=>{if(key==='name')state.filters.name='';if(key==='type'){state.filters.types=[];state.filters.extensions=[];}closeFilter();workspace.renderWindow(record);});
  apply.addEventListener('click',()=>{
    if(key==='name')state.filters.name=body.querySelector('[data-name-filter]')?.value || '';
    if(key==='type'){const values=[...body.querySelectorAll('input:checked')].map((input)=>input.value);state.filters.types=values.filter((value)=>!value.startsWith('.'));state.filters.extensions=values.filter((value)=>value.startsWith('.')).map((value)=>value.slice(1));}
    closeFilter();workspace.renderWindow(record);
  });
  actions.append(clear,apply);menu.append(body,actions);
  menu.style.left=`${Math.max(8,Math.min(event.clientX,window.innerWidth-292))}px`;
  menu.style.top=`${Math.max(8,Math.min(event.clientY,window.innerHeight-450))}px`;
  document.body.append(menu);
  setTimeout(()=>document.addEventListener('pointerdown',(outside)=>{if(!menu.contains(outside.target))closeFilter();},{once:true}),0);
}

function renderHeader(workspace, record, content) {
  const header=el('div','caps-list-header');header.style.setProperty('--caps-columns',columnTemplate());
  const state=listState(record);
  COLUMNS.forEach(([key,label],index) => {
    const cell=el('div','caps-list-header-cell');
    const button=el('button',state.sortKey===key?'sorted':'',label);button.type='button';
    if(state.sortKey===key)button.dataset.direction=state.sortDirection==='asc'?'▲':'▼';
    button.addEventListener('click',()=>{if(state.sortKey===key)state.sortDirection=state.sortDirection==='asc'?'desc':'asc';else{state.sortKey=key;state.sortDirection='asc';}workspace.renderWindow(record);});
    button.addEventListener('contextmenu',(event)=>showFilter(workspace,record,key,event));
    cell.append(button);
    if(index<COLUMNS.length-1){
      const resize=el('span','caps-column-resizer');
      resize.addEventListener('pointerdown',(event)=>{
        if(event.button!==0)return;event.preventDefault();const widths=columnWidths();const startX=event.clientX;const initial=widths[key];resize.classList.add('dragging');resize.setPointerCapture(event.pointerId);
        const move=(pointer)=>{widths[key]=Math.max(64,Math.min(560,Math.round(initial+pointer.clientX-startX)));writeJson(COLUMN_KEY,widths);document.querySelectorAll('.window-content').forEach((pane)=>pane.style.setProperty('--caps-columns',columnTemplate()));};
        const stop=()=>{resize.classList.remove('dragging');resize.removeEventListener('pointermove',move);};
        resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',stop,{once:true});resize.addEventListener('pointercancel',stop,{once:true});
      });
      cell.append(resize);
    }
    header.append(cell);
  });
  content.prepend(header);
}

function setEmojiButtons(root) {
  const icons={ '[data-action="library"]':'📚','[data-action="colour"]':'🎨','[data-action="minimise"]':'➖','[data-action="close"]':'❌','[data-action="back"]':'⬅️','[data-action="forward"]':'➡️','[data-action="up"]':'⬆️','[data-action="refresh"]':'🔄','[data-command="new-folder"]':'📂','[data-view-mode="grid"]':'🔲','[data-view-mode="list"]':'📄' };
  Object.entries(icons).forEach(([selector,emoji])=>root.querySelectorAll(selector).forEach((button)=>{if(button.textContent!==emoji)button.textContent=emoji;}));
}

function setupSidebarResize(record) {
  const main=record.element?.querySelector('.window-main');const content=record.element?.querySelector('.window-content');
  if(!main||!content||main.querySelector('.caps-sidebar-resizer'))return;
  const saved=Math.max(140,Math.min(420,Number(localStorage.getItem(SIDEBAR_KEY)) || 190));
  main.style.setProperty('--caps-sidebar-width',`${saved}px`);
  const divider=el('div','caps-sidebar-resizer');divider.title='Drag to resize navigation pane';main.insertBefore(divider,content);
  divider.addEventListener('pointerdown',(event)=>{
    if(event.button!==0)return;event.preventDefault();const startX=event.clientX;const startWidth=Number.parseFloat(getComputedStyle(main).getPropertyValue('--caps-sidebar-width')) || saved;divider.classList.add('dragging');divider.setPointerCapture(event.pointerId);
    const move=(pointer)=>{const max=Math.max(180,record.element.getBoundingClientRect().width-190);const next=Math.max(140,Math.min(max,Math.round(startWidth+pointer.clientX-startX)));main.style.setProperty('--caps-sidebar-width',`${next}px`);localStorage.setItem(SIDEBAR_KEY,String(next));};
    const stop=()=>{divider.classList.remove('dragging');divider.removeEventListener('pointermove',move);};divider.addEventListener('pointermove',move);divider.addEventListener('pointerup',stop,{once:true});divider.addEventListener('pointercancel',stop,{once:true});
  });
}

function scheduleMetadata(workspace, record, token) {
  const pending=record.items.filter((entry)=>entry.kind==='file'&&entry.metadataPending);
  if(!pending.length)return;
  let cursor=0;
  const idle=(callback)=>('requestIdleCallback' in window?window.requestIdleCallback(callback,{timeout:300}):window.setTimeout(()=>callback({timeRemaining:()=>8}),24));
  const step=async()=>{
    if(record.uiToken!==token||!record.element?.isConnected)return;
    const batch=pending.slice(cursor,cursor+4);cursor+=batch.length;
    await Promise.allSettled(batch.map(hydrateFileEntry));
    if(record.uiToken!==token||!record.element?.isConnected)return;
    workspace.renderWindow(record);
    if(cursor<pending.length)idle(step);
  };
  idle(step);
}

export function installWorkspaceUi(Workspace) {
  if(Workspace.prototype.__capsulariusWorkspaceUiInstalled)return;
  Object.defineProperty(Workspace.prototype,'__capsulariusWorkspaceUiInstalled',{value:true});
  const base={
    renderWindowShell:Workspace.prototype.renderWindowShell,
    renderContent:Workspace.prototype.renderContent,
    renderItem:Workspace.prototype.renderItem,
    loadWindow:Workspace.prototype.loadWindow,
    addWindow:Workspace.prototype.addWindow,
    destroyWindow:Workspace.prototype.destroyWindow,
    focusWindow:Workspace.prototype.focusWindow,
    showContextMenu:Workspace.prototype.showContextMenu,
    bindContextMenu:Workspace.prototype.bindContextMenu,
    openEntry:Workspace.prototype.openEntry
  };

  Workspace.prototype.renderWindowPills=function renderWindowPills(){
    const strip=document.getElementById('window-pills');if(!strip)return;const fragment=document.createDocumentFragment();
    for(const record of this.state.windows.values()){
      const pill=el('button',`window-pill${record.minimized?' minimized':''}${this.state.activeWindowId===record.id?' active':''}`);pill.type='button';pill.style.setProperty('--pill-colour',record.colour);pill.title=record.minimized?`Restore ${record.nickname}`:`Focus ${record.nickname}`;pill.append(el('span','window-pill-dot'),el('span','window-pill-label',`#${record.id} ${record.nickname}`));pill.addEventListener('click',()=>record.minimized?this.restoreWindow(record):this.focusWindow(record.id));fragment.append(pill);
    }
    strip.replaceChildren(fragment);
  };
  Workspace.prototype.minimiseWindow=function minimiseWindow(record){if(!record||record.minimized)return;record.minimized=true;record.element.hidden=true;if(this.state.activeWindowId===record.id)this.state.activeWindowId=null;this.renderWindowPills();this.onStateChange();};
  Workspace.prototype.restoreWindow=function restoreWindow(record){if(!record)return;record.minimized=false;record.element.hidden=false;this.focusWindow(record.id);this.renderWindowPills();this.onStateChange();};
  Workspace.prototype.focusWindow=function focusWindow(id){const record=this.state.windows.get(id);if(!record||record.minimized)return;base.focusWindow.call(this,id);this.renderWindowPills();};
  Workspace.prototype.addWindow=function addWindow(record){base.addWindow.call(this,record);if(record.minimized)record.element.hidden=true;this.renderWindowPills();};
  Workspace.prototype.destroyWindow=function destroyWindow(record){base.destroyWindow.call(this,record);this.renderWindowPills();};
  Workspace.prototype.renderWindowShell=function renderWindowShell(record){
    base.renderWindowShell.call(this,record);
    const actions=record.element.querySelector('.window-actions');const colour=actions.querySelector('[data-action="colour"]');const minimise=this.button('➖','icon-button','Minimise window');minimise.dataset.action='minimise';colour.before(minimise);minimise.addEventListener('click',()=>this.minimiseWindow(record));setEmojiButtons(record.element);setupSidebarResize(record);this.renderWindowPills();
  };
  Workspace.prototype.renderContent=function renderContent(record){
    const items=record.items;
    if(record.viewMode==='list'&&!record.loading&&!record.error&&!record.permissionRequired)record.items=sortedEntries(items,record);
    try{base.renderContent.call(this,record);}finally{record.items=items;}
    if(record.viewMode!=='list')return;
    const content=record.element?.querySelector('.window-content');if(!content?.querySelector('.item-list'))return;
    content.style.setProperty('--caps-columns',columnTemplate());renderHeader(this,record,content);
  };
  Workspace.prototype.renderItem=function renderItem(record,entry,index,visible){
    const node=base.renderItem.call(this,record,entry,index,visible);
    if(record.viewMode!=='list')return node;
    node.classList.add('caps-list-row');node.style.setProperty('--caps-columns',columnTemplate());
    const type=fileTypeDescriptor(entry.name);const size=node.querySelector('.file-meta');if(size)size.textContent=formatBytes(entry.size);
    node.append(el('span','caps-list-cell modified',formatDate(entry.lastModified)),el('span','caps-list-cell type',entry.kind==='directory'?'Folder':entry.kind==='shortcut'?'Location':type.label),el('span','caps-list-cell info',infoFor(entry)),el('span','caps-list-cell created',formatDate(createdFor(entry))));
    const icon=node.querySelector('.file-icon');if(icon&&entry.kind==='file'&&!icon.querySelector('img')&&type.icon)icon.textContent=type.icon;
    return node;
  };
  Workspace.prototype.loadWindow=async function loadWindow(record,...args){const token=(record.uiToken||0)+1;record.uiToken=token;const result=await base.loadWindow.call(this,record,...args);if(record.source.kind==='physical'&&!record.loading&&!record.error&&!record.permissionRequired)scheduleMetadata(this,record,token);return result;};
  Workspace.prototype.openEntry=async function openEntry(record,entry){if(entry?.kind==='file'&&entry.handle)return openPreviewWindow(this,record,entry);return base.openEntry.call(this,record,entry);};
  Workspace.prototype.showContextMenu=function showContextMenu(event,record,entry){
    base.showContextMenu.call(this,event,record,entry);
    const menu=this.contextMenu;if(!menu||menu.hidden)return;
    const add=(label,command,disabled=false)=>{const button=el('button','context-item',label);button.type='button';button.dataset.command=command;button.disabled=disabled;menu.insertBefore(button,menu.firstChild);};
    if(!menu.querySelector('[data-command="refresh"]'))add('🔄 Refresh','refresh');
    if(entry&&!menu.querySelector('[data-command="properties"]'))add('ℹ️ Properties…','properties');
    if(entry?.kind==='file'&&!menu.querySelector('[data-command="preview"]'))add('🖼️ Preview','preview',!entry.handle);
  };
  Workspace.prototype.bindContextMenu=function bindContextMenu(){
    base.bindContextMenu.call(this);
    if(this.contextMenu.dataset.assetActionsBound)return;
    this.contextMenu.dataset.assetActionsBound='true';
    this.contextMenu.addEventListener('click',(event)=>{
      const command=event.target.closest('button')?.dataset.command;
      if(command!=='preview'&&command!=='properties')return;
      event.preventDefault();event.stopImmediatePropagation();
      const record=this.state.windows.get(Number(this.contextMenu.dataset.windowId));
      const entryId=this.contextMenu.dataset.entryId;const entry=entryId?record?.items.find((item)=>item.id===entryId):null;const entries=record?this.getSelectedEntries(record):[];
      this.hideContextMenu();
      if(!record)return;
      if(command==='preview'){const target=entry?.kind==='file'?entry:entries.length===1&&entries[0].kind==='file'?entries[0]:null;if(target)openPreviewWindow(this,record,target);else this.onToast('Select one local file to preview.','error');}
      if(command==='properties')openPropertiesWindow(this,record,entries.length?entries:entry?[entry]:[]);
    },true);
  };
  Workspace.prototype.tileVisibleWindows=function tileVisibleWindows(){
    const visible=[...this.state.windows.values()].filter((record)=>!record.minimized);if(!visible.length)return;const margin=14,gap=12,width=this.viewport.clientWidth,height=this.viewport.clientHeight;const rows=visible.length<=3?[visible.length]:Array.from({length:Math.ceil(visible.length/Math.ceil(Math.sqrt(visible.length)))},(_,row)=>Math.min(Math.ceil(Math.sqrt(visible.length)),visible.length-row*Math.ceil(Math.sqrt(visible.length))));const usableHeight=height-margin*2-gap*(rows.length-1);let cursor=0,y=margin;this.state.workspace.panX=0;this.state.workspace.panY=0;this.applyWorkspaceTransform();for(const count of rows){const cellW=(width-margin*2-gap*(count-1))/count;const cellH=usableHeight/rows.length;let x=margin;for(let index=0;index<count;index+=1){const record=visible[cursor++];record.x=Math.round(x);record.y=Math.round(y);record.width=Math.floor(index===count-1?width-margin-x:cellW);record.height=Math.floor(cellH);Object.assign(record.element.style,{left:`${record.x}px`,top:`${record.y}px`,width:`${record.width}px`,height:`${record.height}px`});x+=cellW+gap;}y+=cellH+gap;}this.onStateChange();
  };
}
