/* Onda Patch V3 — bottom Library bar + desktop/mobile toggle + fullscreen + row buttons. */
(function(){
'use strict';
const PATCH_NAME='onda-patch-v3-bottom-bar-fullscreen';
const $all=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
function toast(m){ if(typeof window.showToast==='function') window.showToast(m); else console.log('['+PATCH_NAME+'] '+m); }

function setupBottomBar(){
 const bar=document.getElementById('organon-bottom-panel');
 const lib=document.getElementById('btn-database-engine');
 if(!bar||!lib) return;
 bar.classList.add('onda-bottom-bar-v3');
 lib.innerHTML='📚 Library';
 lib.title='Open Library';
 if(!document.getElementById('onda-toggle-desktop-mode')){
   const phone=document.createElement('button');
   phone.id='onda-toggle-desktop-mode';
   phone.type='button';
   phone.className='onda-bottom-mini-pill';
   phone.title='Toggle mobile/desktop layout mode';
   phone.textContent='📱';
   phone.addEventListener('click',toggleDesktopMode);
   bar.appendChild(phone);
 }
 if(!document.getElementById('onda-toggle-fullscreen')){
   const fs=document.createElement('button');
   fs.id='onda-toggle-fullscreen';
   fs.type='button';
   fs.className='onda-bottom-mini-pill';
   fs.title='Toggle fullscreen';
   fs.textContent='⛶';
   fs.addEventListener('click',toggleFullscreen);
   bar.appendChild(fs);
 }
 applySavedDesktopMode();
 updateFullscreenButton();
}

function applySavedDesktopMode(){
 const on=localStorage.getItem('ondaForceDesktopModeV1')==='1';
 document.body.classList.toggle('onda-force-desktop-mode',on);
 const btn=document.getElementById('onda-toggle-desktop-mode');
 if(btn){ btn.classList.toggle('active',on); btn.textContent=on?'💻':'📱'; btn.title=on?'Desktop layout forced. Tap for mobile layout.':'Mobile layout. Tap for desktop layout.'; }
}
function toggleDesktopMode(){
 const next=!document.body.classList.contains('onda-force-desktop-mode');
 localStorage.setItem('ondaForceDesktopModeV1',next?'1':'0');
 applySavedDesktopMode();
 toast(next?'Desktop layout mode on.':'Mobile layout mode on.');
}
async function toggleFullscreen(){
 try{
   if(!document.fullscreenElement){
     await document.documentElement.requestFullscreen();
     document.body.classList.add('onda-app-fullscreen');
     toast('Fullscreen mode on.');
   }else{
     await document.exitFullscreen();
   }
 }catch(err){
   console.warn('Fullscreen failed:',err);
   toast('Fullscreen was blocked by this browser.');
 }
 updateFullscreenButton();
}
function updateFullscreenButton(){
 const on=!!document.fullscreenElement;
 document.body.classList.toggle('onda-app-fullscreen',on);
 const btn=document.getElementById('onda-toggle-fullscreen');
 if(btn){ btn.classList.toggle('active',on); btn.textContent=on?'↙':'⛶'; btn.title=on?'Exit fullscreen':'Enter fullscreen'; }
}
document.addEventListener('fullscreenchange',updateFullscreenButton);

function addTransportClass(){ const p=document.getElementById('btn-play')?.closest('.utility-pill'); if(p) p.classList.add('onda-transport-pill'); }
function trackId(el){ return el?.dataset?.trackId||el?.dataset?.historyTrackId||el?.closest?.('[data-track-id]')?.dataset?.trackId||el?.closest?.('[data-history-track-id]')?.dataset?.historyTrackId||''; }
function actionsFor(row){ let a=row.querySelector('.library-row-buttons'); if(!a){ a=document.createElement('div'); a.className='library-row-buttons onda-row-actions'; (row.querySelector('.library-row-main')||row).appendChild(a); } return a; }
function markText(row){
 const explicit=row.matches('.playlist-detail-track-row')?Array.from(row.children).find(c=>!c.classList.contains('history-list-number')&&!c.classList.contains('library-row-buttons')):null;
 [explicit,row.querySelector('.playlist-row-content'),row.querySelector('.library-row-main>div:first-child')].filter(Boolean).forEach(e=>e.classList.add('onda-track-text-wrap'));
}
function ensurePlay(row,id,a){
 let b=row.querySelector('.btn-db-play-track,.btn-history-play,.btn-onda-row-play');
 if(b){ b.classList.add('btn-onda-row-play'); b.dataset.trackId=b.dataset.trackId||id; b.textContent='Play'; return; }
 b=document.createElement('button'); b.type='button'; b.className='btn-pill btn-onda-row-play'; b.dataset.trackId=id; b.textContent='Play'; a.prepend(b);
}
function ensureAdd(row,id,a){
 if(row.querySelector('.btn-onda-add-playlist')) return;
 const b=document.createElement('button'); b.type='button'; b.className='btn-pill btn-onda-add-playlist'; b.dataset.trackId=id; b.textContent='+ Playlist'; a.appendChild(b);
}
function enhance(row){
 const id=trackId(row); if(!id) return;
 row.dataset.trackId=id; row.classList.add('onda-track-row-enhanced'); markText(row);
 const a=actionsFor(row); ensurePlay(row,id,a); ensureAdd(row,id,a);
}
function enhanceRows(root=document){
 const sel='.library-result-row[data-track-id],.library-mini-row[data-track-id],.playlist-detail-track-row[data-track-id],.history-list-row[data-history-track-id],.history-list-row[data-track-id]';
 $all(sel,root).forEach(enhance);
}
function playTrack(id){
 if(!id) return false;
 if(typeof window.addTrackToQueueFromLibrary==='function'){ window.addTrackToQueueFromLibrary(id,true); setTimeout(refreshAll,80); return true; }
 const row=document.querySelector('[data-track-id="'+CSS.escape(id)+'"],[data-history-track-id="'+CSS.escape(id)+'"]');
 if(row){ row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); setTimeout(refreshAll,120); return true; }
 toast('Could not play that row because the track function was not available.'); return false;
}
function addToPlaylist(id){
 if(!id) return;
 const name=prompt('Add this track to which playlist? Type an existing or new playlist name:');
 if(name===null) return;
 const cleanName=name.trim(); if(!cleanName){ toast('No playlist name entered.'); return; }
 if(typeof window.addTrackIdToPlaylist==='function'){
   window.addTrackIdToPlaylist(id,cleanName);
   ['syncAllTrackPlaylistMetadata','renderPlaylistsList','renderLibraryManager','updateMetadataUI'].forEach(fn=>{ if(typeof window[fn]==='function') window[fn](); });
   if(typeof window.saveActiveLibraryState==='function') window.saveActiveLibraryState('row-add-to-playlist');
   toast('Added to playlist: '+cleanName); setTimeout(refreshAll,120); return;
 }
 toast('Playlist add function was not available in this Onda build.');
}
function label(title,sub){
 const d=document.createElement('div'); d.className='onda-now-panel-label';
 d.innerHTML='<span>'+title+'</span>'+(sub?'<span class="onda-now-panel-sub">'+sub+'</span>':''); return d;
}
function decoratePlaylist(panel){
 panel.classList.add('onda-now-panel','onda-now-playlist-mode'); panel.classList.remove('onda-now-history-mode');
 const list=document.getElementById('now-playing-playlist-track-list'); if(!list) return false;
 if(!panel.querySelector('.onda-now-panel-label')){
   const div=label('Playlist Queue','Each song has its own Play button');
   const hr=panel.querySelector('.now-playing-divider');
   if(hr&&hr.nextSibling) hr.parentNode.insertBefore(div,hr.nextSibling); else panel.prepend(div);
 }
 list.classList.add('onda-now-playlist-list');
 $all('.playlist-detail-track-row[data-track-id]',list).forEach(enhance);
 enhanceRows(panel);
 return true;
}
function buildHistory(panel){
 const current=clean((document.getElementById('now-playing')?.textContent||'').replace(/\|.*$/,''));
 if(!current||current==='no track loaded') return;
 const rows=$all('#history-list [data-history-track-id],#history-list [data-track-id]').filter(r=>clean(r.querySelector('.library-track-title')?.textContent||'')!==current).slice(0,10);
 panel.hidden=false; panel.classList.add('onda-now-panel','onda-now-history-mode'); panel.classList.remove('onda-now-playlist-mode'); panel.innerHTML='';
 const hr=document.createElement('hr'); hr.className='now-playing-divider'; panel.appendChild(hr); panel.appendChild(label('Previously Played','Individual track history'));
 const list=document.createElement('div'); list.className='onda-now-history-list';
 if(!rows.length){ const e=document.createElement('div'); e.className='library-track-meta'; e.textContent='No previous tracks yet. Play another song and it will appear here.'; list.appendChild(e); }
 rows.forEach(r=>{ const c=r.cloneNode(true); const id=trackId(r); c.dataset.trackId=id; c.classList.remove('history-list-row'); c.classList.add('library-result-row'); c.removeAttribute('data-history-track-id'); list.appendChild(c); });
 panel.appendChild(list); enhanceRows(panel);
}
function refreshNow(){
 const panel=document.getElementById('now-playing-playlist-panel'); if(!panel) return;
 if(panel.querySelector('#now-playing-playlist-track-list,.playlist-detail-track-row')) decoratePlaylist(panel); else buildHistory(panel);
}
function refreshAll(){ setupBottomBar(); addTransportClass(); enhanceRows(document); refreshNow(); }
let timer=null; function schedule(){ clearTimeout(timer); timer=setTimeout(refreshAll,80); }
document.addEventListener('click',e=>{
 const add=e.target.closest('.btn-onda-add-playlist'); if(add){ e.preventDefault(); e.stopPropagation(); addToPlaylist(trackId(add)); return; }
 const play=e.target.closest('.btn-onda-row-play'); if(play){ if(playTrack(trackId(play))){ e.preventDefault(); e.stopPropagation(); } }
},true);
function init(){
 refreshAll();
 const observer=new MutationObserver(schedule);
 ['organon-bottom-panel','db-library-results','db-recent-list','history-list','now-playing-playlist-panel','metadata-display-card'].map(id=>document.getElementById(id)).filter(Boolean).forEach(n=>observer.observe(n,{childList:true,subtree:true,attributes:true}));
 setInterval(refreshAll,1500);
 window.OndaPatchV3={refresh:refreshAll,toggleDesktopMode,toggleFullscreen};
 console.log(PATCH_NAME+' loaded');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
