/**
 * MotoriClip media-library overlays. Generated artwork is entirely local,
 * rendered into standard PNG files that the existing sticker clip engine can
 * preview, move, trim, blend, save in history and export.
 *
 * These are STATIC overlay clips, not aliases for the 41 paired transitions.
 */
export const TEXT_PRESETS = Object.freeze([
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
    {id:'vignette',label:'Vignette',group:'effect'},
    {id:'cinema-bars',label:'Cinema bars',group:'effect'},
    {id:'sunset-leak',label:'Warm light leak',group:'effect'},
    {id:'blue-leak',label:'Blue light leak',group:'effect'},
    {id:'film-grain',label:'Film grain',group:'effect'},
    {id:'scanlines',label:'Scanlines',group:'effect'},
    {id:'edge-neon',label:'Neon frame',group:'effect'},
    {id:'rainbow-halo',label:'Prismatic halo',group:'effect'},
    {id:'particle-stars',label:'Particle stars',group:'effect'},
    {id:'letterbox-gold',label:'Gold letterbox',group:'effect'},
    {id:'cyan-gradient',label:'Cyan gradient',group:'effect'},
    {id:'ruby-gradient',label:'Ruby gradient',group:'effect'}
]);
const seeded=(n)=>((Math.imul((n+1)>>>0,0x9e3779b1)^0x85ebca6b)>>>0)/4294967295;
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
        case 'vignette':
            g=ctx.createRadialGradient(w/2,h/2,h*.12,w/2,h/2,w*.67);
            g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.88)');
            ctx.fillStyle=g;ctx.fillRect(0,0,w,h);break;
        case 'cinema-bars':
        case 'letterbox-gold':{
            const band=h*.115;
            ctx.fillStyle=preset.id==='cinema-bars'?'#050505':'#33210d';
            ctx.fillRect(0,0,w,band);ctx.fillRect(0,h-band,w,band);
            if(preset.id==='letterbox-gold'){
                ctx.fillStyle='#f7c476';ctx.fillRect(0,band-2*u,w,2*u);ctx.fillRect(0,h-band,w,2*u);
            }
            break;
        }
        case 'sunset-leak':case 'blue-leak':case 'cyan-gradient':case 'ruby-gradient':{
            const warm=['sunset-leak','ruby-gradient'].includes(preset.id);
            g=ctx.createRadialGradient(w*.12,h*.1,0,w*.12,h*.1,w*.85);
            g.addColorStop(0,warm?'rgba(255,90,28,.7)':'rgba(33,190,255,.67)');
            g.addColorStop(.5,warm?'rgba(226,49,77,.24)':'rgba(39,52,255,.2)');
            g.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle=g;ctx.fillRect(0,0,w,h);break;
        }
        case 'scanlines':
            ctx.fillStyle='rgba(0,0,0,.37)';
            for(let y=0;y<h;y+=Math.max(3,4*u))ctx.fillRect(0,y,w,Math.max(1,u));break;
        case 'film-grain':
        case 'particle-stars':
            for(let i=0;i<(preset.id==='film-grain'?Math.round(w*h/350):90);i++){
                const x=seeded(i*7+1)*w,y=seeded(i*7+2)*h;
                const a=preset.id==='film-grain'?.04+seeded(i*7+3)*.17:.18+seeded(i*7+3)*.72;
                ctx.fillStyle=preset.id==='film-grain'?'rgba(255,255,255,'+a+')':'rgba(205,241,255,'+a+')';
                ctx.fillRect(x,y,Math.max(1, (preset.id==='film-grain'?1:2)*u),Math.max(1,(preset.id==='film-grain'?1:2)*u));
            }
            break;
        case 'edge-neon':
            ctx.strokeStyle='#20cfff';ctx.lineWidth=Math.max(2,9*u);
            ctx.shadowColor='#30f6ff';ctx.shadowBlur=24*u;
            ctx.strokeRect(15*u,15*u,w-30*u,h-30*u);ctx.shadowBlur=0;break;
        case 'rainbow-halo':
            g=ctx.createConicGradient(0,w/2,h/2);
            ['#ff3292','#994aff','#28dfff','#44ffc8','#ffe85a','#ff3292']
                .forEach((color,i)=>g.addColorStop(i/5,color));
            ctx.strokeStyle=g;ctx.lineWidth=18*u;ctx.shadowBlur=19*u;ctx.shadowColor='#9b57ed';
            ctx.beginPath();ctx.ellipse(w/2,h/2,w*.39,h*.40,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;break;
    }
}
export function renderOverlayPreset(canvas,preset,value='YOUR TEXT'){
    if(!canvas || !preset || !['text','effect'].includes(preset.group))
        throw Error('Unknown overlay template');
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    try {
        if(preset.group==='text')renderText(ctx,canvas,preset,value);
        else drawEffect(ctx,canvas,preset);
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
