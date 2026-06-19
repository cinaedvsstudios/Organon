import {
  allKnownExtensions,
  createTypeRecord,
  FILE_TYPES,
  fileTypeRecord,
  normaliseFileTypeExtension,
  readDeletedFileTypes,
  readTypeOverrides,
  saveDeletedFileTypes,
  saveTypeOverrides
} from './file-types.js';
import { openEmojiPicker } from './emoji-picker.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function visibleExtensions(app) {
  const found = [];
  for (const record of app.state.windows.values()) {
    for (const entry of record.items || []) {
      const pieces = String(entry.name || '').split('.');
      const extension = pieces.length > 1 ? normaliseFileTypeExtension(pieces.pop()) : '';
      if (extension) found.push(extension);
    }
  }
  return found;
}

function setSelected(table, ui, id) {
  ui.selectedId = id;
  table.querySelectorAll('.caps-file-type-row').forEach((row) => row.classList.toggle('selected', row.dataset.typeId === id));
  document.querySelector('[data-delete-file-type]')?.toggleAttribute('disabled', !id);
}

export function createFileTypeUiState() {
  return { search:'', selectedId:null, drafts:[] };
}

export function addFileTypeDraft(ui, rerender) {
  ui.search = '';
  const id = `new-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  ui.drafts.unshift({ id, extension:'', icon:'📄', description:'File' });
  ui.selectedId = id;
  rerender();
  setTimeout(() => document.querySelector(`[data-type-id="${id}"] [data-type-field="extension"]`)?.focus(),0);
}

export function deleteSelectedFileType(app, ui, rerender) {
  if (!ui.selectedId) return;
  const draftIndex = ui.drafts.findIndex((item) => item.id === ui.selectedId);
  if (draftIndex !== -1) {
    ui.drafts.splice(draftIndex,1);
    ui.selectedId = null;
    rerender();
    return;
  }
  const extension = normaliseFileTypeExtension(ui.selectedId);
  if (!extension) return;
  if (!window.confirm(`Delete the .${extension} file type?\n\nFiles with this extension will use the generic fallback until you add it again.`)) return;
  const overrides = readTypeOverrides();
  const deleted = readDeletedFileTypes();
  delete overrides[extension];
  deleted.add(extension);
  saveTypeOverrides(overrides);
  saveDeletedFileTypes(deleted);
  ui.selectedId = null;
  for (const record of app.state.windows.values()) app.workspace.renderWindow(record);
  app.toast(`Deleted .${extension} from the file type table.`, 'success');
  rerender();
}

export function renderFileTypesTab(app, body, rerender, ui) {
  body.append(el('p','caps-settings-copy','Edit Extension, Icon and Description. The description is exactly what appears in the file explorer’s Type column. Icons can be typed, pasted, deleted, or chosen with a right-click search picker.'));
  const toolbar = el('div','caps-file-types-toolbar');
  const search = document.createElement('input');
  search.type = 'search';
  search.value = ui.search;
  search.placeholder = 'Search file types…';
  search.autocomplete = 'off';
  search.addEventListener('input', () => { ui.search = search.value; rerender(); });
  toolbar.append(search);
  body.append(toolbar);

  const table = el('div','caps-file-types-table');
  const header = el('div','caps-file-types-header');
  header.append(el('span','','File extension'),el('span','','Icon'),el('span','','Description shown in Type'));
  table.append(header);

  const defaults = allKnownExtensions(visibleExtensions(app)).map((extension) => ({ id:extension, draft:false, ...fileTypeRecord(extension) }));
  const entries = [...ui.drafts.map((item) => ({ ...item, draft:true })), ...defaults];
  const needle = ui.search.trim().toLowerCase();
  const visible = entries.filter((entry) => !needle || `${entry.extension} ${entry.icon} ${entry.description}`.toLowerCase().includes(needle));

  visible.forEach((entry) => {
    const row = el('div',`caps-file-type-row${ui.selectedId === entry.id ? ' selected' : ''}`);
    row.dataset.typeId = entry.id;
    row.addEventListener('click', () => setSelected(table,ui,entry.id));

    let extension;
    if (entry.draft) {
      extension = document.createElement('input');
      extension.type = 'text';
      extension.className = 'caps-type-extension-input';
      extension.dataset.typeField = 'extension';
      extension.placeholder = '.ext';
      extension.value = entry.extension ? `.${entry.extension}` : '';
      extension.addEventListener('click',(event) => { event.stopPropagation(); setSelected(table,ui,entry.id); });
    } else {
      extension = el('span','caps-type-extension',`.${entry.extension}`);
      extension.title = FILE_TYPES[entry.extension] ? 'Built-in file type' : 'Custom file type';
    }

    const icon = document.createElement('input');
    icon.type = 'text';
    icon.className = 'caps-type-icon-input';
    icon.dataset.typeField = 'icon';
    icon.value = entry.icon;
    icon.maxLength = 16;
    icon.placeholder = 'Icon';
    icon.title = 'Type, paste, delete, or right-click for the emoji picker';
    icon.addEventListener('click',(event) => { event.stopPropagation(); setSelected(table,ui,entry.id); });
    icon.addEventListener('contextmenu',(event) => { event.preventDefault(); event.stopPropagation(); setSelected(table,ui,entry.id); openEmojiPicker(icon); });

    const description = document.createElement('input');
    description.type = 'text';
    description.className = 'caps-type-description-input';
    description.dataset.typeField = 'description';
    description.value = entry.description;
    description.placeholder = entry.extension ? `File · .${entry.extension}` : 'Description shown in Type';
    description.addEventListener('click',(event) => { event.stopPropagation(); setSelected(table,ui,entry.id); });

    row.append(extension,icon,description);
    table.append(row);
  });

  if (table.children.length === 1) table.append(el('p','caps-file-types-empty','No matching file types. Use ＋ New Type to add one.'));
  body.append(table);

  const footer = el('div','caps-settings-footer');
  const save = el('button','primary','💾 Save File Types');
  save.addEventListener('click', () => {
    const overrides = readTypeOverrides();
    const deleted = readDeletedFileTypes();
    const seen = new Set();
    for (const row of table.querySelectorAll('.caps-file-type-row')) {
      const draft = ui.drafts.find((item) => item.id === row.dataset.typeId);
      const source = draft ? row.querySelector('[data-type-field="extension"]')?.value : row.dataset.typeId;
      const extension = normaliseFileTypeExtension(source);
      if (!extension) return app.toast('Every new file type needs an extension.', 'error');
      if (seen.has(extension)) return app.toast(`.${extension} appears more than once.`, 'error');
      seen.add(extension);
      const fallback = createTypeRecord(extension);
      const icon = row.querySelector('[data-type-field="icon"]')?.value ?? '';
      const description = row.querySelector('[data-type-field="description"]')?.value.trim() || fallback.description || `File · .${extension}`;
      overrides[extension] = { icon, description };
      deleted.delete(extension);
    }
    ui.drafts.forEach((draft) => { if (draft.extension && !seen.has(draft.extension)) delete overrides[draft.extension]; });
    saveTypeOverrides(overrides);
    saveDeletedFileTypes(deleted);
    ui.drafts = [];
    ui.selectedId = null;
    for (const record of app.state.windows.values()) app.workspace.renderWindow(record);
    app.toast('File type table saved.', 'success');
    rerender();
  });
  footer.append(save,el('span','caps-settings-note','Descriptions are prefilled from Capsularius’s default type database.'));
  body.append(footer);
}
