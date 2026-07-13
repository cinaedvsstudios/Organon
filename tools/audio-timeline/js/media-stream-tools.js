/** OGV preview fallback and client-side stream splitting for Basic Audio Timeline. */
import { BrowserFFmpeg, fetchBinary, toBlobURL } from './ffmpeg-client.js';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
const VIDEO_EXTS = new Set(['mp4','m4v','mov','webm','ogv','mkv','avi','mpeg','mpg']);
const AUDIO_EXTS = new Set(['mp3','wav','ogg','oga','opus','m4a','aac','flac','webm']);
const entries = [];
let ffmpeg = null;
let loadPromise = null;
let queue = Promise.resolve();
let panel = null;
let list = null;
let status = null;

const ext = (name='') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
const safeName = (name='media') => (name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'') || 'media');
const job = (entry, suffix) => `${entry.id}-${suffix}`;
const sizeLabel = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB'];
    const power = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), units.length-1);
    const value = bytes/(1024**power);
    return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
};

export function getMediaKind(file) {
    if (!file) return null;
    const mime = (file.type || '').toLowerCase();
    const extension = ext(file.name);
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (VIDEO_EXTS.has(extension)) return 'video';
    if (AUDIO_EXTS.has(extension)) return 'audio';
    return null;
}

function setStatus(message, state='normal') {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
}

function serial(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
}

async function loadEngine() {
    if (ffmpeg?.loaded) return ffmpeg;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        setStatus('Loading stream engine (about 31 MB)…','busy');
        ffmpeg = new BrowserFFmpeg(new URL('./ffmpeg-worker.js', import.meta.url));
        ffmpeg.on('progress', ({progress}) => {
            if (Number.isFinite(progress) && progress > 0 && progress <= 1) {
                setStatus(`Processing… ${Math.round(progress*100)}%`,'busy');
            }
        });
        await ffmpeg.load({
            coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm')
        });
        setStatus('Stream engine ready.','success');
        return ffmpeg;
    })().catch((error) => {
        ffmpeg = null;
        loadPromise = null;
        setStatus(`Could not load stream engine: ${error.message}`,'error');
        throw error;
    });
    return loadPromise;
}

async function removeVirtualFile(path) {
    try { await ffmpeg?.deleteFile(path); } catch { /* optional cleanup */ }
}

async function nativeOgvWorks(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            video.removeAttribute('src');
            video.load();
            URL.revokeObjectURL(url);
            resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 5000);
        video.preload = 'metadata';
        video.muted = true;
        video.addEventListener('loadedmetadata', () => finish(video.videoWidth > 0), {once:true});
        video.addEventListener('error', () => finish(false), {once:true});
        video.src = url;
        video.load();
    });
}

export async function prepareVideoForPreview(file, notify=()=>{}) {
    const ogv = (file.type || '').toLowerCase() === 'video/ogg' || ext(file.name) === 'ogv';
    if (!ogv) return file;
    notify('Checking native OGV playback…');
    if (await nativeOgvWorks(file)) {
        notify('OGV loaded natively.');
        return file;
    }
    notify('Converting OGV to a temporary WebM preview…');
    return serial(async () => {
        await loadEngine();
        const input = `preview-${Date.now()}.ogv`;
        const output = `preview-${Date.now()}.webm`;
        try {
            await ffmpeg.writeFile(input, await fetchBinary(file));
            const code = await ffmpeg.exec(['-hide_banner','-i',input,'-map','0:v:0','-an','-c:v','libvpx','-deadline','realtime','-cpu-used','6','-crf','32','-b:v','0',output]);
            if (code !== 0) throw new Error(`FFmpeg exited with code ${code}.`);
            const data = await ffmpeg.readFile(output);
            notify('OGV preview ready.');
            return new File([data.buffer], `${safeName(file.name)}-preview.webm`, {type:'video/webm'});
        } finally {
            await removeVirtualFile(input);
            await removeVirtualFile(output);
        }
    });
}

export function registerImportedMedia(file) {
    const kind = getMediaKind(file);
    if (!kind) return null;
    const entry = {id:`m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, file, kind, streams:null, error:null};
    entries.push(entry);
    render();
    return entry;
}

async function probe(entry) {
    if (entry.streams || entry.error) return;
    await serial(async () => {
        await loadEngine();
        const input = job(entry, `probe.${ext(entry.file.name) || 'bin'}`);
        const output = job(entry, 'probe.json');
        try {
            setStatus(`Reading streams in ${entry.file.name}…`,'busy');
            await ffmpeg.writeFile(input, await fetchBinary(entry.file));
            const code = await ffmpeg.ffprobe(['-v','error','-show_entries','stream=index,codec_type,codec_name,width,height,sample_rate,channels,channel_layout','-of','json',input,'-o',output]);
            if (code !== 0) throw new Error(`FFprobe exited with code ${code}.`);
            const parsed = JSON.parse(new TextDecoder().decode(await ffmpeg.readFile(output)));
            const counts = {video:0,audio:0};
            entry.streams = (parsed.streams || []).filter((s) => ['video','audio'].includes(s.codec_type)).map((s) => {
                const type = s.codec_type;
                const details = type === 'video'
                    ? (s.width && s.height ? `${s.width}×${s.height}` : '')
                    : [s.sample_rate ? `${s.sample_rate} Hz` : '', s.channel_layout || (s.channels ? `${s.channels} channels` : '')].filter(Boolean).join(' · ');
                return {type, typeIndex:counts[type]++, codec:s.codec_name || type, details};
            });
            if (!entry.streams.length) throw new Error('No video or audio streams found.');
        } catch (error) {
            entry.error = error.message;
        } finally {
            await removeVirtualFile(input);
            await removeVirtualFile(output);
            render();
        }
    });
}

function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportStream(entry, stream, format) {
    return serial(async () => {
        await loadEngine();
        const input = job(entry, `input.${ext(entry.file.name) || 'bin'}`);
        const output = job(entry, `${stream.type}-${stream.typeIndex+1}.${format}`);
        try {
            await ffmpeg.writeFile(input, await fetchBinary(entry.file));
            let args;
            if (stream.type === 'audio') {
                setStatus(`Creating MP3 audio stream ${stream.typeIndex+1}…`,'busy');
                args = ['-hide_banner','-i',input,'-map',`0:a:${stream.typeIndex}`,'-vn','-c:a','libmp3lame','-q:a','2',output];
            } else if (format === 'mp4') {
                setStatus(`Creating MP4 video stream ${stream.typeIndex+1}…`,'busy');
                args = ['-hide_banner','-i',input,'-map',`0:v:${stream.typeIndex}`,'-an','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',output];
            } else if (format === 'ogv') {
                setStatus(`Creating OGV video stream ${stream.typeIndex+1}…`,'busy');
                args = ['-hide_banner','-i',input,'-map',`0:v:${stream.typeIndex}`,'-an','-c:v','libtheora','-q:v','7',output];
            } else {
                setStatus(`Creating WebM video stream ${stream.typeIndex+1}…`,'busy');
                args = ['-hide_banner','-i',input,'-map',`0:v:${stream.typeIndex}`,'-an','-c:v','libvpx','-deadline','realtime','-cpu-used','6','-crf','30','-b:v','0',output];
            }
            const code = await ffmpeg.exec(args);
            if (code !== 0) throw new Error(`FFmpeg exited with code ${code}.`);
            const data = await ffmpeg.readFile(output);
            const mime = format === 'mp3' ? 'audio/mpeg' : format === 'mp4' ? 'video/mp4' : format === 'ogv' ? 'video/ogg' : 'video/webm';
            const name = `${safeName(entry.file.name)}-${stream.type}-${stream.typeIndex+1}.${format}`;
            download(new Blob([data.buffer], {type:mime}), name);
            setStatus(`Downloaded ${name}.`,'success');
        } catch (error) {
            setStatus(`Stream export failed: ${error.message}`,'error');
            throw error;
        } finally {
            await removeVirtualFile(input);
            await removeVirtualFile(output);
        }
    });
}

function render() {
    if (!list) return;
    if (!entries.length) {
        list.innerHTML = '<div class="stream-empty">Import a video or audio file first.</div>';
        return;
    }
    list.innerHTML = entries.map((entry, entryIndex) => {
        const rows = entry.error
            ? `<div class="stream-error">Could not inspect streams: ${entry.error}</div>`
            : !entry.streams
                ? '<div class="stream-empty">Reading streams…</div>'
                : entry.streams.map((stream, streamIndex) => {
                    const label = `${stream.type === 'video' ? 'Video' : 'Audio'} stream ${stream.typeIndex+1}`;
                    const actions = stream.type === 'video'
                        ? `<select data-format><option value="mp4">MP4</option><option value="webm">WebM</option><option value="ogv">OGV</option></select><button class="mini-action" data-export="${entryIndex}:${streamIndex}">Download Video</button>`
                        : `<button class="mini-action" data-export="${entryIndex}:${streamIndex}">Download MP3</button>`;
                    return `<div class="stream-row"><div><strong>${label}</strong><span>${stream.codec}${stream.details ? ` · ${stream.details}` : ''}</span></div><div class="stream-actions">${actions}</div></div>`;
                }).join('');
        return `<article class="stream-file"><header><strong>${entry.file.name}</strong><span>${sizeLabel(entry.file.size)}</span></header>${rows}</article>`;
    }).join('');
}

function installUI() {
    const actions = document.querySelector('#timeline-card .action-stack');
    const stabilizer = document.getElementById('btn-toggle-chroma');
    if (!actions || !stabilizer || document.getElementById('btn-split-streams')) return;
    const style = document.createElement('style');
    style.textContent = `#timeline-card .action-stack.stream-pair{grid-template-columns:repeat(2,minmax(0,1fr))}.stream-panel{margin-top:12px;padding:12px;border:1px solid rgba(117,178,222,.7);border-radius:14px;background:rgba(0,0,0,.34)}.stream-panel[hidden]{display:none}.stream-head,.stream-file header,.stream-row,.stream-actions{display:flex;align-items:center;gap:8px}.stream-head h4,.stream-file header strong{flex:1;min-width:0}.stream-close{width:30px;height:30px;border:1px solid var(--chiseled-bronze);border-radius:50%;background:var(--bg-input);color:var(--alabaster-paper)}.stream-status,.stream-empty,.stream-error{font:.65rem/1.4 var(--font-mono);color:rgba(245,240,219,.65)}.stream-status[data-state=busy]{color:var(--water-spray)}.stream-status[data-state=success]{color:var(--light-teal)}.stream-status[data-state=error],.stream-error{color:var(--terracotta-peach)}.stream-list{display:flex;flex-direction:column;gap:10px}.stream-file{padding:10px;border:1px solid rgba(137,107,73,.72);border-radius:12px;background:rgba(24,25,25,.92)}.stream-file header{font:.68rem var(--font-mono);margin-bottom:6px}.stream-file header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--stone-ochre)}.stream-file header span{color:rgba(245,240,219,.55)}.stream-row{justify-content:space-between;padding:8px 0;border-top:1px dashed rgba(137,107,73,.35)}.stream-row>div:first-child{display:flex;flex-direction:column;min-width:0;font:.64rem/1.35 var(--font-mono)}.stream-row span{color:rgba(245,240,219,.58)}.stream-actions select{padding:7px;border:1px solid var(--chiseled-bronze);border-radius:999px;background:var(--bg-input);color:var(--stone-ochre)}.stream-actions .mini-action{padding:7px 9px;font-size:.56rem;white-space:nowrap}@media(max-width:420px){#timeline-card .action-stack.stream-pair{grid-template-columns:1fr}.stream-row{align-items:flex-start;flex-direction:column}}`;
    document.head.appendChild(style);
    actions.classList.add('stream-pair');
    const button = document.createElement('button');
    button.id = 'btn-split-streams';
    button.type = 'button';
    button.className = 'btn-icon';
    button.textContent = 'Split & Download Streams';
    stabilizer.insertAdjacentElement('afterend', button);
    panel = document.createElement('section');
    panel.className = 'stream-panel';
    panel.hidden = true;
    panel.innerHTML = '<div class="stream-head"><h4>Split & Download Streams</h4><button class="stream-close" type="button" aria-label="Close">×</button></div><p class="stream-status" data-state="normal">The conversion engine loads only when this panel is used.</p><div class="stream-list"></div>';
    actions.insertAdjacentElement('afterend', panel);
    status = panel.querySelector('.stream-status');
    list = panel.querySelector('.stream-list');
    button.addEventListener('click', async () => {
        panel.hidden = !panel.hidden;
        if (panel.hidden) return;
        render();
        for (const entry of entries) await probe(entry);
        if (entries.length) setStatus(`Found streams in ${entries.length} imported file${entries.length === 1 ? '' : 's'}.`,'success');
    });
    panel.querySelector('.stream-close').addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-export]');
        if (!target) return;
        const [entryIndex, streamIndex] = target.dataset.export.split(':').map(Number);
        const entry = entries[entryIndex];
        const stream = entry?.streams?.[streamIndex];
        if (!entry || !stream) return;
        const format = stream.type === 'audio' ? 'mp3' : target.parentElement.querySelector('[data-format]').value;
        target.disabled = true;
        try { await exportStream(entry, stream, format); } finally { target.disabled = false; }
    });
    render();
}

export function initMediaStreamTools() { installUI(); }
