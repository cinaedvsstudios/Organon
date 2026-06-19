import { FILE_TYPE_DELETED_KEY, FILE_TYPE_OVERRIDES_KEY } from './file-types.js';
import { addFileTypeDraft, createFileTypeUiState, deleteSelectedFileType, renderFileTypesTab } from './file-type-table.js';
import { queryDirectoryPermission, readDirectory } from './filesystem.js';

const BACKUP_KEYS = [
  'capsularius.sidebarWidth.v1',
  'capsularius.columnWidths.v1',
  'capsularius.fileMetadata.v1',
  FILE_TYPE_OVERRIDES_KEY,
  FILE_TYPE_DELETED_KEY
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function closeSettings() {
  document.querySelector('.caps-settings-backdrop')?.remove();
  document.querySelector('.caps-emoji-picker')?.remove();
}

async function checkMount(mount) {
  try {
    mount.permission = await queryDirectoryPermission(mount.handle);
    if (mount.permission !== 'granted') {
      mount.health = 'permission-required';
      mount.healthDetail = 'Browser permission is needed to reopen this folder.';
      return mount.health;
    }
    await readDirectory(mount.handle, []);
    mount.health = 'connected';
    mount.healthDetail = 'Folder opens normally.';
    return mount.health;
  } catch (error) {
    mount.health = 'unavailable';
    mount.healthDetail = error?.message || 'The mounted folder could not be opened.';
    return mount.health;
  }
}

async function relinkMount(app, mount) {
  if (!('showDirectoryPicker' in window)) {
    app.toast('This browser cannot open a folder picker. Use Chrome or Edge.', 'error');
    return false;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode:'readwrite' });
    mount.handle = handle;
    mount.name = handle.name || mount.name;
    mount.nickname = mount.nickname || mount.name;
    await checkMount(mount);
    for (const record of app.state.windows.values()) {
      if (record.source.kind === 'physical' && record.source.mountId === mount.id) await app.workspace.loadWindow(record);
      else app.workspace.renderSidebar(record);
    }
    app.save();
    app.toast(`${mount.nickname || mount.name} was relinked.`, 'success');
    return true;
  } catch (error) {
    if (error?.name !== 'AbortError') app.toast(error?.message || 'Folder relink failed.', 'error');
    return false;
  }
}

function removeMount(app, mount) {
  if (!window.confirm(`Remove “${mount.nickname || mount.name}” from Capsularius?\n\nThis does not delete the actual folder or its files.`)) return;
  for (const record of [...app.state.windows.values()]) {
    if (record.source.kind === 'physical' && record.source.mountId === mount.id) app.workspace.destroyWindow(record);
  }
  app.state.mounts.delete(mount.id);
  app.state.library = app.state.library.filter((entry) => entry.mountId !== mount.id);
  app.state.recents = app.state.recents.filter((entry) => entry.mountId !== mount.id);
  for (const record of app.state.windows.values()) app.workspace.renderSidebar(record);
  app.workspace.refreshSpecialWindows?.();
  app.save();
}

function renderMountedLocations(app, body, rerender) {
  body.append(el('p','caps-settings-copy','Mounted Locations checks whether Capsularius can open each saved browser folder. A folder that opens normally is connected; the browser not exposing its Windows drive path is not treated as an error.'));
  const list = el('div','caps-settings-list');
  for (const mount of app.state.mounts.values()) {
    const card = el('article','caps-settings-location');
    const info = el('div');
    info.append(el('h3','',`📁 ${mount.nickname || mount.name}`));
    const state = mount.health === 'unavailable' ? 'Unavailable' : mount.health === 'permission-required' ? 'Reconnect needed' : 'Connected';
    info.append(el('p',`caps-settings-status${state === 'Connected' ? '' : ' warn'}`,`${state} — ${mount.healthDetail || (state === 'Connected' ? 'Folder handle is currently available.' : 'Run scan to check this folder.')}`));
    const actions = el('div','caps-settings-actions');
    const relink = el('button','', '📂 Relink');
    relink.addEventListener('click', async () => { if (await relinkMount(app,mount)) rerender(); });
    const remove = el('button','danger','🗑️ Remove');
    remove.addEventListener('click', () => { removeMount(app,mount); rerender(); });
    actions.append(relink,remove); card.append(info,actions); list.append(card);
  }
  if (!app.state.mounts.size) list.append(el('p','caps-settings-copy','No local folders are mounted yet.'));
  body.append(list);
  const footer = el('div','caps-settings-footer');
  const controls = el('div');
  const mount = el('button','primary','📂 Mount Folder');
  mount.addEventListener('click',()=>{closeSettings();document.getElementById('mount-folder-button')?.click();});
  const scan = el('button','','🔄 Scan Mounted Locations');
  scan.addEventListener('click',async()=>{
    scan.disabled=true;scan.textContent='⏳ Scanning…';
    for (const item of app.state.mounts.values()) await checkMount(item);
    for (const record of app.state.windows.values()) app.workspace.renderSidebar(record);
    app.save(); rerender();
  });
  controls.append(mount,scan); footer.append(controls,el('span','caps-settings-note','Remove deletes only Capsularius’s saved reference.')); body.append(footer);
}

function renderBackup(body) {
  body.append(el('p','caps-settings-copy','Export or import Capsularius’s visual settings, file-type labels, and local metadata. Browser folder handles are not included, so mounted folders still need reconnecting after import.'));
  const area = el('div','caps-settings-backup');
  const exportCard=el('article'); exportCard.append(el('h3','','Export Settings'),el('p','','Download the current local Capsularius settings as a JSON file.'));
  const download=el('button','primary','⬇️ Download Settings JSON');
  download.addEventListener('click',()=>{
    const settings={};BACKUP_KEYS.forEach((key)=>{const value=localStorage.getItem(key);if(value!==null)settings[key]=value;});
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),settings},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`capsularius-settings-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });exportCard.append(download);
  const importCard=el('article');importCard.append(el('h3','','Import Settings'),el('p','','Import a previous Capsularius settings JSON. The app reloads after a valid import.'));
  const picker=document.createElement('input');picker.type='file';picker.accept='application/json,.json';picker.hidden=true;
  const upload=el('button','','⬆️ Import Settings JSON');upload.addEventListener('click',()=>picker.click());
  picker.addEventListener('change',()=>{
    const file=picker.files?.[0];if(!file)return;const reader=new FileReader();reader.addEventListener('load',()=>{try{const data=JSON.parse(reader.result);if(!data?.settings||typeof data.settings!=='object')throw new Error('This is not a Capsularius settings backup.');Object.entries(data.settings).forEach(([key,value])=>{if(BACKUP_KEYS.includes(key)&&typeof value==='string')localStorage.setItem(key,value);});window.location.reload();}catch(error){window.alert(error?.message||'The backup could not be imported.');}});reader.readAsText(file);
  });importCard.append(upload,picker);area.append(exportCard,importCard);body.append(area);
}

export function installSettings(app) {
  const button = document.getElementById('settings-button');
  if (!button) return;
  let tab = 'locations';
  const typeUi = createFileTypeUiState();

  const render = () => {
    closeSettings();
    const backdrop = el('div','caps-settings-backdrop');
    const panel = el('section','caps-settings');
    const header = el('header','caps-settings-header');
    const left = el('div');
    left.append(el('h2','caps-settings-title','Capsularius Settings'));
    const tabs = el('nav','caps-settings-tabs');
    [['locations','Mounted Locations'],['types','File Types'],['backup','Backup']].forEach(([key,label]) => {
      const item = el('button',`caps-settings-tab${tab === key ? ' active' : ''}`,label);
      item.type='button';
      item.addEventListener('click',()=>{tab=key;render();});
      tabs.append(item);
    });
    left.append(tabs);

    const actions = el('div','caps-settings-header-actions');
    if (tab === 'types') {
      const add = el('button','caps-settings-header-button','＋ New Type');
      add.type='button';
      add.addEventListener('click',()=>addFileTypeDraft(typeUi,render));
      const remove = el('button','caps-settings-header-button danger','🗑 Delete Type');
      remove.type='button';
      remove.dataset.deleteFileType='true';
      remove.disabled=!typeUi.selectedId;
      remove.addEventListener('click',()=>deleteSelectedFileType(app,typeUi,render));
      actions.append(add,remove);
    }
    const close = el('button','caps-settings-close','❌');
    close.type='button';
    close.addEventListener('click',closeSettings);
    actions.append(close);
    header.append(left,actions);

    const body = el('main','caps-settings-body');
    if (tab === 'locations') renderMountedLocations(app,body,render);
    else if (tab === 'types') renderFileTypesTab(app,body,render,typeUi);
    else renderBackup(body);
    panel.append(header,body);backdrop.append(panel);document.getElementById('dialog-layer').append(backdrop);
  };
  button.addEventListener('click',render);
}
