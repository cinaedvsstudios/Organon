/**
 * MotoriClip 8C: deterministic canvas-native first effects batch.
 *
 * These are independent implementations named for the user's selected gallery
 * effects, not copies of third-party GLSL shaders. All operations use a bounded
 * number of draw calls and the same canvas path for preview and fixed export.
 */
export const ACTIVE_PAIR_EFFECTS = Object.freeze(['fade','pixelize','random-squares','glitch-flicker']);
export const isAvailablePairEffect = id => ACTIVE_PAIR_EFFECTS.includes(id);
export const unit = x => Math.max(0, Math.min(1, Number.isFinite(Number(x)) ? Number(x) : 0));
export const seededCell = index => {
    // Stable and reversible: no Math.random(), time dependency or global RNG.
    let x=(Math.imul((index+1)>>>0, 0x9e3779b1)^0x85ebca6b)>>>0;
    x^=x>>>16; x=Math.imul(x,0x7feb352d)>>>0;
    x^=x>>>15; x=Math.imul(x,0x846ca68b)>>>0;
    x^=x>>>16;
    return x/4294967296;
};
export function revealCell(progress,index) {
    const p=unit(progress);
    return p>=1 || (p>0 && seededCell(index)<p);
}
export function pixelScale(progress) {
    const remaining=1-unit(progress);
    return Math.max(1,Math.round(1+remaining*remaining*39));
}
export function glitchShift(progress,band,step,width) {
    const remaining=1-unit(progress);
    const cell=Math.floor((band+1)*131+Math.max(0,step)*397);
    return Math.round((seededCell(cell)*2-1)*Math.min(42,width*.065)*remaining);
}
export function pairedEffectProgress(track,time) {
    const seconds=Number(track?.visualTransitions?.enter?.duration)||0;
    if(seconds<=0)return 1;
    return unit((Number(time)-(Number(track.start)||0))/seconds);
}

/** Create or resize a scratch canvas held by the renderer instance. */
function scratchCanvas(renderer,key,width,height) {
    let canvas=renderer[key];
    if(!canvas)canvas=renderer[key]=document.createElement('canvas');
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    return canvas;
}

/**
 * Draw the incoming video B over the previous video A already in the canvas.
 * renderContained(ctx,media,width,height) is injected from the media engine
 * to maintain the editor's existing letterboxing/cropping behaviour.
 */
export function paintPairedEffect(renderer,context,track,width,height,time,renderContained) {
    const id=track.transitionEffectId;
    if(!isAvailablePairEffect(id)||id==='fade')return false;
    const progress=pairedEffectProgress(track,time);
    if(progress<=0)return true; // Keep A entirely visible at the boundary.
    if(progress>=1)return false; // Let normal renderer draw a pristine B.
    const alpha=context.globalAlpha;
    const media=track.media;

    if(id==='pixelize'){
        const block=pixelScale(progress);
        const small=scratchCanvas(renderer,'transitionPixelScratch',
            Math.max(1,Math.ceil(width/block)),Math.max(1,Math.ceil(height/block)));
        const sc=small.getContext('2d');
        sc.clearRect(0,0,small.width,small.height);
        renderContained(sc,media,small.width,small.height);
        context.globalAlpha=alpha*progress;
        context.imageSmoothingEnabled=false;
        context.drawImage(small,0,0,width,height);
        return true;
    }
    const full=scratchCanvas(renderer,'transitionFullScratch',width,height);
    const sc=full.getContext('2d');
    sc.clearRect(0,0,width,height);
    renderContained(sc,media,width,height);

    if(id==='random-squares'){
        // Whole-image tile reveal: 112 cells per frame at most. Each tile
        // contributes its *full* opacity, so there is no dark crossfade.
        const cols=14,rows=8,cellW=width/cols,cellH=height/rows;
        for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
            if(!revealCell(progress,y*cols+x))continue;
            const sx=Math.floor(x*cellW),sy=Math.floor(y*cellH);
            const ex=Math.min(width,Math.ceil((x+1)*cellW));
            const ey=Math.min(height,Math.ceil((y+1)*cellH));
            context.drawImage(full,sx,sy,ex-sx,ey-sy,sx,sy,ex-sx,ey-sy);
        }
        return true;
    }
    if(id==='glitch-flicker'){
        // Deterministic horizontal strip shifts with intermittent flicker;
        // only B is distorted, so the underlying A stays spatially stable.
        const bands=18,h=height/bands,step=Math.floor(time*24);
        context.globalAlpha=alpha*progress;
        for(let i=0;i<bands;i++){
            if(seededCell(i+step*17)<Math.pow(1-progress,2)*.20)continue;
            const y=Math.floor(i*h),next=Math.min(height,Math.ceil((i+1)*h));
            const shift=glitchShift(progress,i,step,width);
            context.drawImage(full,0,y,width,next-y,shift,y,width,next-y);
        }
        return true;
    }
    return false;
}
