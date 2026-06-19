import { extensionOf, formatBytes, hydrateFileEntry } from './filesystem.js';
import { fileTypeDescriptor } from './file-types.js';
import { sourcePathLabel } from './state.js';

const PROPERTY_KEY = 'capsularius.fileMetadata.v1';
const TEXT_EXTENSIONS = new Set(['txt','md','json','xml','yaml','yml','csv','tsv','html','htm','css','js','mjs','cjs','ts','tsx','jsx','py','java','cs','cpp','c','h','php','sql','sh','bat','ps1','log','ini','cfg','conf']);
const PDF_EXTENSIONS = new Set(['pdf']);

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

function formatDate(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}` : `${minutes}:${String(remainder).padStart(2,'0')}`;
}

function metadataLabel(entry) {
  const meta = entry.capsulariusMeta || {};
  const dimensions = Number.isFinite(meta.width) && Number.isFinite(meta.height) ? `${meta.width} × ${meta.height}` : '';
  const duration = Number.isFinite(meta.duration) ? formatDuration(meta.duration) : '';
  if (entry.fileType === 'video') return [duration, dimensions].filter(Boolean).join(' · ') || '—';
  if (entry.fileType === 'audio') return duration || '—';
  if (entry.fileType === 'image') return dimensions || '—';
  return '—';
}

function propertyId(workspace, record, entry) {
  return `${sourcePathLabel(workspace.state, record.source)}|${entry.name}`;
}

function removePanel(panel) {
  const url = panel.dataset.objectUrl;
  if (url) URL.revokeObjectURL(url);
  panel.remove();
}

function bringToFront(panel) {
  const current = Number(panel.style.zIndex || 14000);
  const next = Math.max(14000, ...[...document.querySelectorAll('.caps-asset-window')].map((item) => Number(item.style.zIndex || 14000))) + 1;
  if (next > current) panel.style.zIndex = String(next);
}

function makeDraggable(panel, handle) {
  let drag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    bringToFront(panel);
    const bounds = panel.getBoundingClientRect();
    drag = { id:event.pointerId, offsetX:event.clientX - bounds.left, offsetY:event.clientY - bounds.top };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(8,Math.min(window.innerWidth-bounds.width-8,event.clientX-drag.offsetX))}px`;
    panel.style.top = `${Math.max(8,Math.min(window.innerHeight-bounds.height-8,event.clientY-drag.offsetY))}px`;
  });
  const stop = () => { drag = null; };
  handle.addEventListener('pointerup',stop);
  handle.addEventListener('pointercancel',stop);
}

function positionPanel(panel, offset = 0) {
  document.body.append(panel);
  requestAnimationFrame(() => {
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(12,Math.round((window.innerWidth-bounds.width)/2)+offset)}px`;
    panel.style.top = `${Math.max(12,Math.round((window.innerHeight-bounds.height)/2)+offset)}px`;
    bringToFront(panel);
  });
}

function createWindow({ kind, title, subtitle }) {
  const panel = el('section',`caps-asset-window caps-${kind}-window`);
  const bar = el('header','caps-asset-window-bar');
  const heading = el('div','caps-asset-window-heading');
  heading.append(el('strong','',title));
  if (subtitle) heading.append(el('span','',subtitle));
  const close = el('button','caps-asset-window-close','❌');
  close.type='button'; close.title='Close'; close.addEventListener('click',()=>removePanel(panel));
  bar.append(heading,close);
  panel.append(bar);
  panel.addEventListener('pointerdown',()=>bringToFront(panel));
  makeDraggable(panel,bar);
  return panel;
}

function unsupportedPreview(content, entry) {
  const type = fileTypeDescriptor(entry.name);
  const empty = el('div','caps-preview-empty');
  empty.append(el('span','caps-preview-empty-icon',type.icon || '📄'),el('strong','',entry.name),el('span','',`Capsularius cannot preview ${type.label} in the browser yet.`));
  content.append(empty);
}

async function addPreviewContent(panel, entry) {
  const content = el('div','caps-preview-content');
  panel.append(content);
  const file = await entry.handle.getFile();
  const extension = extensionOf(entry.name);
  const url = URL.createObjectURL(file);
  panel.dataset.objectUrl = url;

  if (entry.fileType === 'image') {
    const image = document.createElement('img');
    image.className='caps-preview-image'; image.alt=entry.name; image.src=url;
    image.addEventListener('load',()=>panel.classList.add('preview-ready'));
    image.addEventListener('error',()=>unsupportedPreview(content,entry));
    content.append(image);
    return;
  }
  if (entry.fileType === 'video') {
    const video = document.createElement('video');
    video.className='caps-preview-video'; video.controls=true; video.preload='metadata'; video.src=url;
    content.append(video);
    return;
  }
  if (entry.fileType === 'audio') {
    const audioBox = el('div','caps-preview-audio');
    audioBox.append(el('span','caps-preview-audio-icon','🎵'),el('strong','',entry.name));
    const audio = document.createElement('audio'); audio.controls=true; audio.preload='metadata'; audio.src=url;
    audioBox.append(audio); content.append(audioBox);
    return;
  }
  if (PDF_EXTENSIONS.has(extension)) {
    const frame = document.createElement('iframe');
    frame.className='caps-preview-pdf'; frame.title=entry.name; frame.src=url;
    content.append(frame);
    return;
  }
  if (TEXT_EXTENSIONS.has(extension) || entry.mimeType.startsWith('text/')) {
    const text = await file.text();
    const pre = el('pre','caps-preview-text');
    pre.textContent = text.length > 250000 ? `${text.slice(0,250000)}\n\n— Preview limited to the first 250,000 characters —` : text;
    content.append(pre);
    return;
  }
  unsupportedPreview(content,entry);
}

export async function openPreviewWindow(workspace, record, entry) {
  if (!entry?.handle || entry.kind !== 'file') {
    workspace.onToast('Preview is available for one local file at a time.', 'error');
    return;
  }
  const type = fileTypeDescriptor(entry.name);
  const panel = createWindow({ kind:'preview', title:entry.name, subtitle:type.label });
  panel.append(el('div','caps-preview-loading','Loading preview…'));
  positionPanel(panel,24);
  try {
    await hydrateFileEntry(entry);
    panel.querySelector('.caps-preview-loading')?.remove();
    await addPreviewContent(panel,entry);
  } catch (error) {
    panel.querySelector('.caps-preview-loading')?.remove();
    const failed = el('div','caps-preview-empty');
    failed.append(el('span','caps-preview-empty-icon',type.icon || '📄'),el('strong','',entry.name),el('span','',error?.message || 'This file could not be previewed.'));
    panel.append(failed);
  }
}

export async function openPropertiesWindow(workspace, record, entries) {
  if (!entries.length) return;
  const single = entries.length === 1;
  const entry = entries[0];
  if (single?.handle) {
    try { await hydrateFileEntry(entry); } catch (_) { /* show available data */ }
  }

  const panel = createWindow({ kind:'properties', title:single ? entry.name : `${entries.length} selected items`, subtitle:'Properties' });
  const content = el('div','caps-properties-content');
  const details = el('dl','caps-properties-grid');
  const add = (label,value) => details.append(el('dt','',label),el('dd','',value));

  if (single) {
    add('Capsularius location',sourcePathLabel(workspace.state,record.source));
    add('Type',entry.kind === 'directory' ? 'Folder' : fileTypeDescriptor(entry.name).label);
    add('Size',entry.kind === 'file' ? formatBytes(entry.size) : '—');
    add('Modified',formatDate(entry.lastModified));
    add('Length / dimensions',metadataLabel(entry));
    add('Browser MIME type',entry.mimeType || '—');
  } else {
    add('Items',String(entries.length));
    add('Files',String(entries.filter((item)=>item.kind==='file').length));
    add('Folders',String(entries.filter((item)=>item.kind==='directory').length));
    add('Combined size',formatBytes(entries.reduce((total,item)=>total+(Number.isFinite(item.size)?item.size:0),0)));
  }
  content.append(details);

  if (single) {
    const metadata = readJson(PROPERTY_KEY,{});
    const saved = metadata[propertyId(workspace,record,entry)] || {};
    const fields = el('div','caps-properties-fields');
    [['Title','title',false],['Tags','tags',false],['Rating (0–5)','rating',false],['Description','description',true],['Notes','notes',true]].forEach(([label,key,multiline]) => {
      const wrapper = el('label'); wrapper.append(el('span','',label));
      const input = document.createElement(multiline ? 'textarea' : 'input');
      if (!multiline) input.type = key === 'rating' ? 'number' : 'text';
      if (key === 'rating') { input.min='0'; input.max='5'; input.step='1'; }
      input.value = saved[key] || ''; input.dataset.property = key;
      wrapper.append(input); fields.append(wrapper);
    });
    content.append(fields);
    const save = el('button','primary','💾 Save Capsularius metadata');
    save.addEventListener('click',() => {
      const value = {};
      fields.querySelectorAll('[data-property]').forEach((input)=>{value[input.dataset.property]=input.value.trim();});
      metadata[propertyId(workspace,record,entry)] = value;
      writeJson(PROPERTY_KEY,metadata);
      workspace.onToast('Properties saved in Capsularius.','success');
    });
    const actions = el('div','caps-asset-window-actions'); actions.append(save); content.append(actions);
  }

  panel.append(content);
  positionPanel(panel,0);
}
