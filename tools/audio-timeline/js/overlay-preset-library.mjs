/**
 * MotoriClip media-library overlays. Generated artwork is entirely local,
 * rendered into standard PNG files that the existing sticker clip engine can
 * preview, move, trim, blend, save in history and export.
 *
 * These are STATIC overlay clips, not aliases for the 41 paired transitions.
 */
import { TEXT_DESIGNS, paintTimelineText } from './text-template-renderer.mjs';
// The library exposes real typography/layout differences. Earlier saved
// colour-only preset IDs remain available for reconstructing legacy projects.
export const TEXT_PRESETS = TEXT_DESIGNS;
export const LEGACY_TEXT_PRESETS = Object.freeze([
    {id:'neon-cyan',label:'Neon cyan',group:'text',color:'#4fe8ff',accent:'#0033bd'},
    {id:'neon-purple',label:'Ultraviolet',group:'text',color:'#dc7aff',accent:'#5b10a4'},
    {id:'ruby-red',label:'Ruby',group:'text',color:'#ff6b86',accent:'#bc1e39'},
    {id:'gold-foil',label:'Gold foil',group:'text',color:'#ffdd8e',accent:'#b16d15'},
    {id:'electric-blue',label:'Electric blue',group:'text',color:'#9ddeff',accent:'#1167c9'},
    {id:'neon-green',label:'Neon green',group:'text',color:'#b3ff69',accent:'#338522'},
    {id:'pink-outline',label:'Pink outline',group:'text',color:'#f7e3fa',accent:'#fc2db1'},
    {id:'retro-orange',label:'Retro amber',group:'text',color:'#ffcb60',accent:'#ed6518'},
    {id:'white-chrome',label:'Silver chrome',group:'text',color:'#fbfeff',accent:'#5d88b0'},
    {id:'hologram',label:'Hologram',group:'text',color:'#83fff4',accent:'#a151e5'},
    {id:'violet-halo',label:'Violet halo',group:'text',color:'#f8dcff',accent:'#a859f4'},
    {id:'classical-gold',label:'Classical',group:'text',color:'#ffe7ab',accent:'#705127'}
]);
export const EFFECT_OVERLAYS = Object.freeze([
    {id:'vignette',label:'Vignette (still)',group:'effect'},
    {id:'cinema-bars',label:'Cinema bars (still)',group:'effect'},
    {id:'sunset-leak',label:'Warm light leak (still)',group:'effect'},
    {id:'blue-leak',label:'Blue light leak (still)',group:'effect'},
    {id:'film-grain',label:'Film grain (still)',group:'effect'},
    {id:'scanlines',label:'Scanlines (still)',group:'effect'},
    {id:'edge-neon',label:'Neon frame (still)',group:'effect'},
    {id:'rainbow-halo',label:'Prismatic halo (still)',group:'effect'},
    {id:'particle-stars',label:'Particle stars (still)',group:'effect'},
    {id:'letterbox-gold',label:'Gold letterbox (still)',group:'effect'},
    {id:'cyan-gradient',label:'Cyan gradient (still)',group:'effect'},
    {id:'ruby-gradient',label:'Ruby gradient (still)',group:'effect'}
]);
const seeded=(n)=>((Math.imul((n+1)>>>0,0x9e3779b1)^0x85ebca6b)>>>0)/4294967295;
// Avalanche hash: independent, reproducible grain cells and stars.
const artworkRandom=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
const withAlpha=(hex,a)=>{
    const c=hex.replace('#',''),nums=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16));
    return 'rgba('+nums.join(',')+','+a+')';
};
function renderText(ctx,canvas,preset,value) {
    const w=canvas.width,h=canvas.height,unit=w/640;
    const text=String(value||'YOUR TEXT').trim().slice(0,100)||'YOUR TEXT';
    let px=Math.round(112*unit);
    ctx.font='900 '+px+'px system-ui,Arial,sans-serif';
    while(ctx.measureText(text).width>w*.91 && px>18*unit){
        px=Math.max(px-2,Math.floor(18*unit));
        ctx.font='900 '+px+'px system-ui,Arial,sans-serif';
    }
    ctx.textBaseline='middle';ctx.textAlign='center';
    const x=w/2,y=h/2,stroke=Math.max(1,5*unit);
    ctx.lineJoin='round';
    ctx.shadowColor=preset.accent;ctx.shadowBlur=25*unit;
    ctx.lineWidth=stroke*2.2;ctx.strokeStyle=withAlpha(preset.accent,.95);
    ctx.strokeText(text,x,y);
    ctx.shadowBlur=14*unit;ctx.fillStyle=preset.color;
    if(['gold-foil','white-chrome','hologram','classical-gold'].includes(preset.id)){
        const g=ctx.createLinearGradient(0,y-px/2,0,y+px/2);
        g.addColorStop(0,preset.color);
        g.addColorStop(.45,'#ffffff');
        g.addColorStop(.55,preset.accent);
        g.addColorStop(1,preset.color);
        ctx.fillStyle=g;
    }
    ctx.fillText(text,x,y);
    ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,1.2*unit);
    ctx.strokeStyle=withAlpha('#ffffff',.8);ctx.strokeText(text,x,y);
}
function drawEffect(ctx,canvas,preset) {
    const w=canvas.width,h=canvas.height,u=w/640;
    let g;
    switch(preset.id){
        case 'vignette': {
            // Normalized elliptical optical falloff, independent of output aspect ratio.
            // A protected clear centre and multiple soft stops avoid a visible hard ring.
            ctx.save();
            ctx.translate(w/2,h/2);ctx.scale(w/2,h/2);
            g=ctx.createRadialGradient(0,0,0,0,0,Math.SQRT2);
            for(const [r,alpha] of [[0,0],[.23,0],[.42,.035],[.58,.14],[.72,.33],[.86,.59],[1,.82]])
                g.addColorStop(r,'rgba(0,0,0,'+alpha+')');
            ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();break;
        }
        case 'cinema-bars': {
            // True 2.39:1 scope aperture at the artwork's own aspect ratio.
            const band=Math.max(0,Math.round((h-w/2.39)/2));
            ctx.fillStyle='#000000';
            ctx.fillRect(0,0,w,band);ctx.fillRect(0,h-band,w,band);
            break;
        }
        case 'letterbox-gold':{
            const band=Math.max(0,Math.round((h-w/2.39)/2));
            if(!band)break;
            // Dark satin-gold matte, with mirrored metallic trim at the aperture.
            const trim=Math.max(1,Math.round(Math.min(w,h)*.009));
            const matte=ctx.createLinearGradient(0,0,0,band);
            for(const [p,c] of [[0,'#1b1009'],[.48,'#382313'],[1,'#51371b']])matte.addColorStop(p,c);
            ctx.fillStyle=matte;ctx.fillRect(0,0,w,band);
            ctx.save();ctx.translate(0,h);ctx.scale(1,-1);ctx.fillRect(0,0,w,band);ctx.restore();
            const gold=ctx.createLinearGradient(0,0,w,0);
            for(const [p,c] of [[0,'#956123'],[.18,'#e3b25b'],[.34,'#fff0b2'],[.54,'#a56c2a'],[.76,'#f7d38a'],[1,'#8e5720']])gold.addColorStop(p,c);
            ctx.fillStyle=gold;ctx.fillRect(0,band-trim,w,trim);ctx.fillRect(0,h-band,w,trim);
            break;
        }
        case 'sunset-leak':
        case 'blue-leak': {
            // Deliberately static photographic edge leaks. Each palette has
            // a different entry edge and layered optical falloff; these
            // are not aliases for the decorative gradient artwork.
            const warm=preset.id==='sunset-leak';
            const x=warm?-.12*w:1.10*w,y=warm?.07*h:.89*h;
            const r=Math.max(w,h)*.83;
            g=ctx.createRadialGradient(x,y,0,x,y,r);
            for(const [p,c] of (warm?[[0,'rgba(255,238,174,.96)'],[.17,'rgba(255,170,64,.78)'],[.40,'rgba(255,75,31,.40)'],[.68,'rgba(215,26,48,.09)'],[1,'rgba(205,16,54,0)']]:[[0,'rgba(172,244,255,.95)'],[.17,'rgba(56,180,255,.74)'],[.40,'rgba(37,84,242,.40)'],[.68,'rgba(99,35,211,.09)'],[1,'rgba(100,30,210,0)']]))g.addColorStop(p,c);
            ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
            // Secondary narrow, softly tapered film-edge flare.
            g=ctx.createLinearGradient(warm?0:w,0,warm?w*.32:w*.68,0);
            const stops=warm?[[0,'rgba(255,205,116,.25)'],[.25,'rgba(255,96,31,.17)'],[.58,'rgba(240,56,42,.07)'],[1,'rgba(240,56,42,0)']]:[[0,'rgba(122,218,255,.26)'],[.23,'rgba(84,101,255,.20)'],[.56,'rgba(126,55,237,.07)'],[1,'rgba(126,55,237,0)']];
            for(const [p,c] of stops)g.addColorStop(p,c);
            ctx.fillStyle=g;ctx.fillRect(0,0,w,h);break;
        }
        case 'cyan-gradient':
        case 'ruby-gradient': {
            // Decorative diagonal colour wash, deliberately distinct from
            // the two photographic radial edge leaks.
            const cyan=preset.id==='cyan-gradient';
            g=ctx.createLinearGradient(cyan?0:w,cyan?h:0,cyan?w:0,cyan?0:h);
            const stops=cyan?[[0,'rgba(0,212,234,.61)'],[.28,'rgba(0,172,201,.40)'],[.60,'rgba(18,112,162,.18)'],[1,'rgba(17,84,142,0)']]:[[0,'rgba(176,9,65,.65)'],[.26,'rgba(203,20,81,.44)'],[.60,'rgba(110,11,70,.19)'],[1,'rgba(80,4,55,0)']];
            for(const [p,c] of stops)g.addColorStop(p,c);
            ctx.fillStyle=g;ctx.fillRect(0,0,w,h);break;
        }
        case 'scanlines': {
            // Resolution-normalized static raster, with a softly shaped dark
            // phosphor gap rather than discontinuously sized rectangles.
            const img=ctx.createImageData(w,h),period=h/90;
            for(let y=0;y<h;y++){
                const wave=.5+.5*Math.cos(y/period*Math.PI*2);
                const alpha=Math.round(111*Math.pow(wave,2.5));
                for(let x=0;x<w;x++)img.data[(y*w+x)*4+3]=alpha;
            }
            ctx.putImageData(img,0,0);break;
        }
        case 'film-grain': {
            // Fine signed monochrome texture, not a sparse white dot overlay.
            const img=ctx.createImageData(w,h),cell=Math.max(1,Math.round(Math.min(w/320,h/180)));
            for(let y=0;y<h;y++)for(let x=0;x<w;x++){
                const k=Math.floor(x/cell)*73856093^Math.floor(y/cell)*19349663^1946;
                const r=artworkRandom(k),a=artworkRandom(k^0x71327);
                const i=(y*w+x)*4,v=r<.5?0:255;
                img.data[i]=img.data[i+1]=img.data[i+2]=v;
                img.data[i+3]=Math.round(4+Math.pow(a,2)*51);
            }
            ctx.putImageData(img,0,0);break;
        }
        case 'particle-stars': {
            // Sparse starlight: numerous pinpoints and a few asymmetric
            // four-point flares, with individually seeded sizes and glow.
            const unit=Math.min(w,h)/360;
            for(let i=0;i<100;i++){
                const k=6173+i*97,x=artworkRandom(k+1)*w,y=artworkRandom(k+2)*h;
                const bright=artworkRandom(k+3),r=(.65+bright*1.5)*unit;
                const a=.28+.62*bright;
                ctx.fillStyle='rgba(213,240,255,'+a+')';
                ctx.beginPath();ctx.arc(x,y,Math.max(.36,r),0,Math.PI*2);ctx.fill();
                if(i%13===0){
                    const reach=(5+bright*6)*unit,glow=ctx.createRadialGradient(x,y,0,x,y,reach*1.25);
                    glow.addColorStop(0,'rgba(185,224,255,.5)');glow.addColorStop(1,'rgba(185,224,255,0)');
                    ctx.fillStyle=glow;ctx.fillRect(x-reach*1.25,y-reach*1.25,reach*2.5,reach*2.5);
                    ctx.fillStyle='rgba(240,250,255,.88)';ctx.beginPath();
                    for(let j=0;j<8;j++){const angle=j*Math.PI/4,dist=j%2?reach*.15:(j%4?reach*.66:reach);
                        const px=x+Math.cos(angle)*dist,py=y+Math.sin(angle)*dist;
                        if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
                    ctx.closePath();ctx.fill();
                }
            }
            break;
        }
        case 'edge-neon': {
            const unit=Math.min(w,h)/360,m=Math.max(2,Math.min(w,h)*.055),r=Math.min(w,h)*.055;
            const stroke=()=>{ctx.beginPath();ctx.roundRect(m,m,w-2*m,h-2*m,r);ctx.stroke();};
            const neon=ctx.createLinearGradient(0,0,w,h);
            for(const [p,c] of [[0,'#33f5ff'],[.36,'#36caff'],[.7,'#548cff'],[1,'#36edff']])neon.addColorStop(p,c);
            ctx.strokeStyle=neon;ctx.shadowColor='#27c9ff';ctx.shadowBlur=18*unit;
            ctx.lineWidth=11*unit;ctx.globalAlpha=.50;stroke();
            ctx.shadowBlur=8*unit;ctx.lineWidth=5.5*unit;ctx.globalAlpha=.9;stroke();
            ctx.shadowBlur=0;ctx.strokeStyle='#dcfbff';ctx.lineWidth=1.6*unit;ctx.globalAlpha=1;stroke();break;
        }
        case 'rainbow-halo': {
            const unit=Math.min(w,h)/360,ellipse=()=>{ctx.beginPath();ctx.ellipse(w/2,h/2,w*.36,h*.36,0,0,Math.PI*2);ctx.stroke();};
            g=ctx.createConicGradient(0,w/2,h/2);
            ['#ff4f99','#975aff','#36c8ff','#4bffd4','#e9ff67','#ffad57','#ff4f99'].forEach((c,i)=>g.addColorStop(i/6,c));
            ctx.strokeStyle=g;ctx.shadowColor='#a45bff';ctx.shadowBlur=20*unit;
            ctx.globalAlpha=.44;ctx.lineWidth=24*unit;ellipse();
            ctx.shadowBlur=10*unit;ctx.globalAlpha=.90;ctx.lineWidth=9*unit;ellipse();
            ctx.shadowBlur=0;ctx.globalAlpha=.85;ctx.strokeStyle='#e9f5ff';ctx.lineWidth=1.8*unit;ellipse();break;
        }
    }
}
export function renderOverlayPreset(canvas,preset,value='YOUR TEXT'){
    if(!canvas || !preset || !['text','effect'].includes(preset.group))
        throw Error('Unknown overlay template');
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    try {
        if(preset.group==='text'){
            if(preset.layout) paintTimelineText(ctx,canvas.width,canvas.height,
                {presetId:preset.id,value,animation:'none'},1,1);
            else renderText(ctx,canvas,preset,value); // old projects' recipe
        }else drawEffect(ctx,canvas,preset);
    } finally {ctx.restore();}
}
export function createOverlayFile(preset,value='YOUR TEXT'){
    const canvas=document.createElement('canvas');
    canvas.width=640;canvas.height=360;
    renderOverlayPreset(canvas,preset,value);
    const base64=canvas.toDataURL('image/png').split(',')[1];
    const bytes=Uint8Array.from(atob(base64),letter=>letter.charCodeAt(0));
    const suffix=preset.group==='text'?String(value||'TEXT').trim().replace(/[^a-z0-9]+/gi,'-').slice(0,20):'overlay';
    const fileName=[preset.group,preset.id,suffix,Date.now()].join('-')+'.png';
    return new File([bytes],fileName,{type:'image/png',lastModified:Date.now()});
}
