(() => {
  const $ = id => document.getElementById(id);
  const okExt = new Map([['jpg','JPEG'],['jpeg','JPEG'],['png','PNG'],['webp','WEBP'],['gif','GIF']]);
  const s = { dir:null, write:false, fallback:false, folder:'No folder selected', images:[], ignored:[], skipped:[], busy:false };
  const e = {
    choose:$('chooseFolder'), fallbackBtn:$('fallbackPickerButton'), fallback:$('fallbackPicker'), folder:$('folderName'), note:$('folderModeNote'),
    ignored:$('ignoredButton'), imageCount:$('imageCount'), types:$('typeSummary'), first:$('firstFile'), last:$('lastFile'), summary:$('summaryNote'), status:$('liveStatus'),
    pattern:$('filenamePattern'), preview:$('filenamePreview'), per:$('perSheet'), cols:$('columns'), tw:$('thumbWidth'), th:$('tileHeight'), gap:$('gap'), pad:$('padding'),
    label:$('labelMode'), fs:$('fontSize'), quality:$('quality'), sort:$('sortOrder'), bgPreset:$('bgPreset'), bgCustom:$('bgCustom'), text:$('textColor'),
    index:$('includeIndex'), header:$('includeHeader'), key:$('createKey'), crop:$('cropFill'), sheetBadge:$('sheetCountBadge'), estImages:$('estimateImages'),
    estPer:$('estimatePerSheet'), estDim:$('estimateDimensions'), estMp:$('estimateMp'), estEach:$('estimateEach'), estTotal:$('estimateTotal'), warn:$('estimateWarning'),
    progressLabel:$('progressLabel'), fill:$('progressFill'), progressText:$('progressText'), made:$('createdList'), create:$('createSheets'),
    modal:$('modalOverlay'), modalClose:$('modalClose'), modalBody:$('modalBody'), toast:$('toast')
  };
  const post = text => window.parent?.postMessage?.({type:'set-status', text}, '*');
  const clearPost = () => window.parent?.postMessage?.({type:'clear-status'}, '*');
  const flash = text => { e.toast.textContent = text; e.toast.classList.add('show'); clearTimeout(flash.t); flash.t = setTimeout(() => e.toast.classList.remove('show'), 2400); };
  const ext = name => { const i = name.lastIndexOf('.'); return i > -1 ? name.slice(i + 1).toLowerCase() : ''; };
  const clamp = (el, min, max, fallback, round = true) => { let v = Number(el.value); if (!Number.isFinite(v)) v = fallback; v = Math.min(max, Math.max(min, v)); if (round) v = Math.round(v); el.value = String(round ? v : Math.round(v * 100) / 100); return v; };
  const pad = (n, w) => String(n).padStart(w, '0');
  const mono = 'ui-monospace, "Cascadia Mono", Consolas, "Lucida Console", "Courier New", monospace';

  function pattern(){
    let raw = (e.pattern.value || 'contact_sheet01.jpg').trim().replace(/[\\/:*?"<>|]+/g, '_');
    if (!/\.jpe?g$/i.test(raw)) raw = raw.replace(/\.+$/, '') + '.jpg';
    const m = raw.match(/\.(jpe?g)$/i), extension = m ? '.' + m[1].toLowerCase().replace('jpeg','jpg') : '.jpg';
    const stem = raw.slice(0, -extension.length), n = stem.match(/(\d+)$/);
    return n ? {prefix:stem.slice(0, -n[1].length), start:Number(n[1]), width:n[1].length, extension} : {prefix:stem, start:1, width:2, extension};
  }
  function sheetName(i){ const p = pattern(); return `${p.prefix}${pad(p.start + i, p.width)}${p.extension}`; }
  function base(){ return pattern().prefix.replace(/[_\-\s]+$/, '') || 'contact_sheet'; }
  function settings(){
    const per = clamp(e.per,1,500,50), cols = clamp(e.cols,1,20,5), tw = clamp(e.tw,80,1200,320), th = clamp(e.th,80,1200,380);
    const gap = clamp(e.gap,0,120,24), padding = clamp(e.pad,0,160,32), fs = clamp(e.fs,8,28,12), q = clamp(e.quality,.3,1,.88,false);
    const labelMode = e.label.value, labelLines = labelMode === 'none' ? 0 : labelMode === 'full' ? 2 : 1;
    const labelH = labelLines ? fs * labelLines + 16 : 0, headerH = e.header.checked ? 88 : 0, rows = Math.ceil(per / cols);
    const width = padding * 2 + cols * tw + (cols - 1) * gap;
    const height = padding * 2 + headerH + rows * (th + labelH) + (rows - 1) * gap;
    return {per, cols, tw, th, gap, padding, fs, q, labelMode, labelH, headerH, rows, width, height, mp:width*height/1e6, bg:e.bgPreset.value === 'custom' ? e.bgCustom.value : e.bgPreset.value, text:e.text.value, includeIndex:e.index.checked || labelMode === 'index-only', createKey:e.key.checked || labelMode === 'index-only', crop:e.crop.checked, sort:e.sort.value, header:e.header.checked};
  }
  function sortedImages(){
    const a = [...s.images], st = settings();
    const byName = (x,y) => x.name.localeCompare(y.name, undefined, {numeric:true, sensitivity:'base'});
    const byDate = (x,y) => (x.lastModified || 0) - (y.lastModified || 0) || byName(x,y);
    if (st.sort === 'name-desc') a.sort((x,y) => byName(y,x)); else if (st.sort === 'date-asc') a.sort(byDate); else if (st.sort === 'date-desc') a.sort((x,y) => byDate(y,x)); else a.sort(byName);
    return a;
  }
  function update(){
    const arr = sortedImages(), st = settings(), sheets = arr.length ? Math.ceil(arr.length / st.per) : 0, each = Math.max(.15, st.mp * (.33 + st.q * .62));
    e.folder.textContent = s.folder; e.imageCount.textContent = s.images.length; e.types.textContent = [...new Set(arr.map(x => x.type))].sort().join(', ') || '—';
    e.first.textContent = arr[0]?.name || '—'; e.last.textContent = arr.at(-1)?.name || '—'; e.ignored.textContent = `Ignored: ${s.ignored.length + s.skipped.length}`; e.ignored.disabled = !(s.ignored.length + s.skipped.length);
    e.summary.textContent = s.images.length ? `${s.images.length} image${s.images.length === 1 ? '' : 's'} ready. ${s.write ? 'Sheets will be saved into this folder.' : 'Folder write access is unavailable; sheets will download instead.'}` : 'Choose a folder to scan top-level JPG, PNG, WEBP and GIF image files.';
    e.preview.textContent = `Output: ${sheetName(0)}${sheets > 1 ? ', ' + sheetName(1) + '...' : ''}`; e.sheetBadge.textContent = `${sheets} sheet${sheets === 1 ? '' : 's'}`;
    e.estImages.textContent = arr.length; e.estPer.textContent = st.per; e.estDim.textContent = sheets ? `${st.width} × ${st.height}px` : '—'; e.estMp.textContent = sheets ? `${st.mp.toFixed(1)} MP` : '—'; e.estEach.textContent = sheets ? `~${each.toFixed(1)} MB` : '—'; e.estTotal.textContent = sheets ? `~${(each * sheets).toFixed(1)} MB` : '—';
    const warnings = []; if (st.mp > 80) warnings.push('This canvas is very large. Reduce images per sheet, thumbnail size, or columns if generation fails.'); if (st.width > 16000 || st.height > 16000) warnings.push('One canvas dimension is above 16,000 px, which may fail in some browsers.');
    e.warn.textContent = warnings.join(' '); e.warn.classList.toggle('hidden', !warnings.length); e.create.disabled = !arr.length || s.busy;
  }
  async function writePermission(dir){
    try { const opt = {mode:'readwrite'}; if (await dir.queryPermission?.(opt) === 'granted') return true; if (await dir.requestPermission?.(opt) === 'granted') return true; return !dir.requestPermission; } catch { return false; }
  }
  async function choose(){
    if (s.busy) return;
    if (!('showDirectoryPicker' in window)) { s.fallback = true; e.fallbackBtn.classList.remove('hidden'); e.note.textContent = 'Folder write access is not available in this browser. Use the fallback picker; sheets will download.'; e.fallback.click(); return; }
    try {
      status('Scanning folder...'); const dir = await window.showDirectoryPicker({mode:'readwrite'}), write = await writePermission(dir), imgs = [], bad = [];
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind !== 'file') { bad.push({name, reason:'Folder skipped. Subfolders are not included in this version.'}); continue; }
        const x = ext(name); if (!okExt.has(x)) { bad.push({name, reason:'Unsupported file type.'}); continue; }
        try { const f = await entry.getFile(); imgs.push({name, handle:entry, file:null, lastModified:f.lastModified, type:okExt.get(x)}); } catch { bad.push({name, reason:'Browser could not read this file.'}); }
      }
      Object.assign(s, {dir, write, fallback:false, folder:dir.name || 'Selected folder', images:imgs, ignored:bad, skipped:[]});
      e.fallbackBtn.classList.add('hidden'); e.note.textContent = write ? 'Read/write access granted. Sheets will be saved into this folder.' : 'Read access granted, but write access was not granted. Sheets will download instead.'; status('Ready'); flash(`Found ${imgs.length} image file${imgs.length === 1 ? '' : 's'}.`); update();
    } catch (err) { if (err?.name !== 'AbortError') { console.warn(err); e.fallbackBtn.classList.remove('hidden'); flash('Folder picker blocked. Use fallback picker.'); } status('Ready'); }
  }
  function fallbackClick(){ if (!s.busy) e.fallback.click(); }
  function fallbackFiles(ev){
    const files = [...(ev.target.files || [])], imgs = [], bad = [], root = files[0]?.webkitRelativePath?.split('/')[0] || 'Selected files';
    files.forEach(f => { const rel = f.webkitRelativePath || f.name, parts = rel.split('/').filter(Boolean), display = parts.length > 1 ? parts.slice(1).join('/') : f.name; if (parts.length > 2) { bad.push({name:display, reason:'Nested file skipped. Subfolders are not included in this version.'}); return; } const x = ext(f.name); if (!okExt.has(x)) bad.push({name:display, reason:'Unsupported file type.'}); else imgs.push({name:f.name, file:f, handle:null, lastModified:f.lastModified, type:okExt.get(x)}); });
    Object.assign(s, {dir:null, write:false, fallback:true, folder:root, images:imgs, ignored:bad, skipped:[]}); e.note.textContent = 'Fallback mode. Sheets will download because folder write access is unavailable.'; status('Ready'); flash(`Found ${imgs.length} image file${imgs.length === 1 ? '' : 's'}.`); update();
  }
  function status(t){ e.status.textContent = t; post(t); }
  async function itemFile(item){ return item.file || item.handle.getFile(); }
  function loadImage(file){ return new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image failed')); }; img.src = url; }); }
  function drawFit(ctx, img, x, y, w, h, crop){
    const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height; if (!sw || !sh) return;
    const r = crop ? Math.max(w/sw, h/sh) : Math.min(w/sw, h/sh), dw = sw*r, dh = sh*r;
    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); ctx.drawImage(img, x + (w-dw)/2, y + (h-dh)/2, dw, dh); ctx.restore();
  }
  function shortName(n, max=34){ if (n.length <= max) return n; const ex = n.includes('.') ? '.' + n.split('.').pop() : ''; return n.slice(0, Math.max(8, max - ex.length - 1)) + '…' + ex; }
  function label(item, idx, st, total){ if (st.labelMode === 'none') return ''; const num = pad(idx+1, Math.max(2, String(total).length)); if (st.labelMode === 'index-only') return num; const n = st.labelMode === 'full' ? item.name : shortName(item.name); return st.includeIndex ? `${num} · ${n}` : n; }
  function wrap(ctx, text, x, y, maxW, lineH, maxLines){
    const words = text.split(/\s+/); let line = '', lines = [];
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; } }); if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); let last = lines[maxLines-1]; while (last.length > 4 && ctx.measureText(last + '…').width > maxW) last = last.slice(0,-1); lines[maxLines-1] = last + '…'; }
    lines.forEach((l,i) => ctx.fillText(l, x, y + i * lineH));
  }
  function header(ctx, sheet, totalSheets, start, end, total, st){ if (!st.header) return; ctx.fillStyle = st.text; ctx.font = `700 28px ${mono}`; ctx.fillText(`${base()} · Sheet ${sheet} of ${totalSheets}`, st.padding, st.padding + 30); ctx.font = `600 18px ${mono}`; ctx.fillText(`Files ${pad(start+1, String(total).length)}–${pad(end, String(total).length)} of ${total} · ${st.cols} columns · ${st.per} images · ${st.tw}px thumbs`, st.padding, st.padding + 62); }
  function toBlob(canvas, q){ return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('JPEG export failed')), 'image/jpeg', q)); }
  const tick = () => new Promise(r => setTimeout(r, 0));
  async function renderSheet(chunk, sheetIdx, sheetTotal, all, st, offset){
    const c = document.createElement('canvas'); c.width = st.width; c.height = st.height; const ctx = c.getContext('2d', {alpha:false}); if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = st.bg; ctx.fillRect(0,0,c.width,c.height); header(ctx, sheetIdx+1, sheetTotal, offset, offset + chunk.length, all.length, st);
    const startY = st.padding + st.headerH;
    for (let i=0;i<chunk.length;i++) { const item = chunk[i], gi = offset + i, col = i % st.cols, row = Math.floor(i / st.cols), x = st.padding + col * (st.tw + st.gap), y = startY + row * (st.th + st.labelH + st.gap);
      try { drawFit(ctx, await loadImage(await itemFile(item)), x, y, st.tw, st.th, st.crop); } catch { s.skipped.push({name:item.name, reason:'Could not load image while generating.'}); ctx.strokeStyle = '#9a2f4f'; ctx.lineWidth = 2; ctx.strokeRect(x+1,y+1,st.tw-2,st.th-2); ctx.fillStyle = '#ff9cb3'; ctx.font = `700 ${Math.max(10, st.fs)}px ${mono}`; ctx.fillText(`SKIPPED ${gi+1}`, x+10, y+24); }
      const txt = label(item, gi, st, all.length); if (txt) { ctx.fillStyle = st.text; ctx.font = `600 ${st.fs}px ${mono}`; wrap(ctx, txt, x, y + st.th + st.fs + 8, st.tw, st.fs + 4, st.labelMode === 'full' ? 2 : 1); }
      progress(gi+1, all.length, `Sheet ${sheetIdx+1} of ${sheetTotal} · Image ${gi+1} of ${all.length}`); await tick();
    }
    const b = await toBlob(c, st.q); c.width = c.height = 0; return b;
  }
  async function exists(name){ if (!s.dir) return false; try { await s.dir.getFileHandle(name, {create:false}); return true; } catch { return false; } }
  async function unique(name){ if (!s.dir || !(await exists(name))) return name; const i = name.lastIndexOf('.'), stem = i > 0 ? name.slice(0,i) : name, ex = i > 0 ? name.slice(i) : ''; let n = 2, cand = `${stem}_${n}${ex}`; while (await exists(cand)) cand = `${stem}_${++n}${ex}`; return cand; }
  async function save(blob, name){ if (s.dir && s.write) { const final = await unique(name), fh = await s.dir.getFileHandle(final, {create:true}), w = await fh.createWritable(); await w.write(blob); await w.close(); return {name:final, mode:'folder'}; } download(blob, name); return {name, mode:'download'}; }
  function download(blob, name){ const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
  function addMade(t){ const d = document.createElement('div'); d.className = 'created-item'; d.textContent = t; e.made.appendChild(d); }
  function keyText(all, st, sheets){ const w = Math.max(2, String(all.length).length), lines = ['CONTACT SHEET THUMBS KEY', `Created: ${new Date().toISOString()}`, `Folder: ${s.folder}`, `Images: ${all.length}`, `Sheets: ${sheets.length}`, `Settings: ${st.cols} columns · ${st.per} images per sheet · ${st.tw}px thumbs · ${st.q} JPEG quality`, '']; sheets.forEach((n,i) => lines.push(`Sheet ${i+1}: ${n}`)); lines.push(''); all.forEach((it,i) => lines.push(`${pad(i+1,w)} = Sheet ${Math.floor(i/st.per)+1} = ${it.name}`)); return lines.join('\n'); }
  function skippedText(){ const all = [...s.ignored.map(x => ({...x, sec:'Ignored during scan'})), ...s.skipped.map(x => ({...x, sec:'Skipped during generation'}))], lines = ['CONTACT SHEET THUMBS SKIPPED / IGNORED FILES', `Created: ${new Date().toISOString()}`, `Folder: ${s.folder}`, `Count: ${all.length}`, '']; all.forEach((x,i) => lines.push(`${i+1}. ${x.name}\n   ${x.sec}: ${x.reason}`)); return lines.join('\n'); }
  function progress(done,total,text){ e.fill.style.width = `${total ? Math.min(100, done/total*100) : 0}%`; e.progressText.textContent = text; }
  async function create(){
    if (s.busy || !s.images.length) return; s.busy = true; s.skipped = []; e.made.replaceChildren(); e.create.disabled = true; e.fill.style.width = '0%'; status('Generating');
    const st = settings(), all = sortedImages(), totalSheets = Math.ceil(all.length / st.per), savedSheets = [];
    try {
      for (let i=0;i<totalSheets;i++) { e.progressLabel.textContent = `Sheet ${i+1}/${totalSheets}`; const chunk = all.slice(i*st.per, i*st.per + st.per), blob = await renderSheet(chunk, i, totalSheets, all, st, i*st.per), out = await save(blob, sheetName(i)); savedSheets.push(out.name); addMade(`${out.name} ${out.mode === 'folder' ? 'saved to folder' : 'downloaded'}`); await tick(); }
      if (st.createKey) { const out = await save(new Blob([keyText(all, st, savedSheets)], {type:'text/plain;charset=utf-8'}), `${base()}_key.txt`); addMade(`${out.name} ${out.mode === 'folder' ? 'saved to folder' : 'downloaded'}`); }
      if (s.ignored.length || s.skipped.length) { const out = await save(new Blob([skippedText()], {type:'text/plain;charset=utf-8'}), `${base()}_skipped.txt`); addMade(`${out.name} ${out.mode === 'folder' ? 'saved to folder' : 'downloaded'}`); }
      e.progressLabel.textContent = 'Done'; e.fill.style.width = '100%'; e.progressText.textContent = `Created ${totalSheets} contact sheet${totalSheets === 1 ? '' : 's'}.`; status('Complete'); flash('Contact sheets created.');
    } catch (err) { console.error(err); e.progressLabel.textContent = 'Error'; e.progressText.textContent = err?.message || 'Generation failed.'; status('Error'); flash('Generation failed.'); }
    finally { s.busy = false; update(); clearPost(); }
  }
  function showIgnored(){ const all = [...s.ignored.map(x => ({...x, sec:'Ignored during scan'})), ...s.skipped.map(x => ({...x, sec:'Skipped during generation'}))]; e.modalBody.replaceChildren(); if (!all.length) { const p = document.createElement('p'); p.className = 'note'; p.textContent = 'No ignored or skipped files.'; e.modalBody.appendChild(p); } else { const list = document.createElement('div'); list.className = 'ignored-list'; all.forEach(x => { const r = document.createElement('div'); r.className = 'ignored-item'; r.textContent = x.name; const rs = document.createElement('span'); rs.textContent = `${x.sec}: ${x.reason}`; r.appendChild(rs); list.appendChild(r); }); e.modalBody.appendChild(list); } e.modal.classList.add('open'); e.modal.setAttribute('aria-hidden','false'); }
  function closeModal(){ e.modal.classList.remove('open'); e.modal.setAttribute('aria-hidden','true'); }
  e.choose.addEventListener('click', choose); e.fallbackBtn.addEventListener('click', fallbackClick); e.fallback.addEventListener('change', fallbackFiles); e.create.addEventListener('click', create); e.ignored.addEventListener('click', showIgnored); e.modalClose.addEventListener('click', closeModal); e.modal.addEventListener('click', ev => { if (ev.target === e.modal) closeModal(); }); document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });
  [e.pattern,e.per,e.cols,e.tw,e.th,e.gap,e.pad,e.label,e.fs,e.quality,e.sort,e.bgPreset,e.bgCustom,e.text,e.index,e.header,e.key,e.crop].forEach(x => { x.addEventListener('input', update); x.addEventListener('change', update); });
  update();
})();
