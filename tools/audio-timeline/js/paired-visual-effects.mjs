/**
 * MotoriClip 8C–8H: deterministic canvas-native paired effects.
 *
 * These are independent implementations named for the user's selected gallery
 * effects, not copies of third-party GLSL shaders. All operations use a bounded
 * number of draw calls and the same canvas path for preview and fixed export.
 */
export const ACTIVE_PAIR_EFFECTS = Object.freeze(['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp']);
export const isAvailablePairEffect = id => ACTIVE_PAIR_EFFECTS.includes(id);
export const unit = x => Math.max(0, Math.min(1, Number.isFinite(Number(x)) ? Number(x) : 0));
export const seededCell = index => {
    // Stable and reversible: no Math.random(), time dependency or global RNG.
    let x=(Math.imul((index+1)>>>0, 0x9e3779b1)^0x85ebca6b)>>>0;
    x^=x>>>16; x=Math.imul(x,0x7feb352d)>>>0;
    x^=x>>>15; x=Math.imul(x,0x846ca68b)>>>0;
    x^=x>>>16;
    return (x>>>0)/4294967296;
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
    if(remaining<=0)return 0;
    const cell=Math.floor((band+1)*131+Math.max(0,step)*397);
    return Math.round((seededCell(cell)*2-1)*Math.min(42,width*.065)*remaining);
}
export function pairedEffectProgress(track,time) {
    const seconds=Number(track?.visualTransitions?.enter?.duration)||0;
    if(seconds<=0)return 1;
    return unit((Number(time)-(Number(track.start)||0))/seconds);
}

/** Full-frame radial reveals share a centered radius, but Ripple has a
 * periodic wavefront. Both resolve exactly to the entire frame at 100%.
 */
export function radialMaskRadius(effectId,progress,width,height,angle=0) {
    const p=unit(progress),diagonal=Math.hypot(width/2,height/2);
    const base=diagonal*p;
    if(effectId!=='ripple')return base;
    const wave=Math.min(width,height)*.045*Math.sin(12*angle-24*p)*Math.sin(Math.PI*p);
    return Math.max(0,base+wave);
}
export function tvScanHeight(progress) {
    const p=unit(progress);
    return p<=.5?Math.pow(1-2*p,1.6):Math.pow(2*p-1,1.6);
}

function traceIris(context,effectId,progress,width,height) {
    const cx=width/2,cy=height/2;
    context.beginPath();
    if(effectId==='aperture-wipe'){
        context.arc(cx,cy,radialMaskRadius(effectId,progress,width,height),0,2*Math.PI);
    }else{
        const vertices=96;
        for(let i=0;i<=vertices;i++){
            const angle=i/vertices*2*Math.PI;
            const radius=radialMaskRadius(effectId,progress,width,height,angle);
            const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;
            if(!i)context.moveTo(x,y);
            else context.lineTo(x,y);
        }
        context.closePath();
    }
}
/** For a true spiral, each annular band reveals a different angular extent.
 * Only Canvas paths are used, so there is no per-pixel JavaScript processing.
 */
export function spiralRingFraction(progress,ringIndex,count=32) {
    const n=Math.max(1,Math.trunc(count)||32);
    const r=Math.min(n-1,Math.max(0,Math.trunc(ringIndex)||0));
    return unit(unit(progress)*1.6-((r+.5)/n)*.6);
}
/** Concentric rings intentionally enter out of strict radial order to create
 * distinct alternating radial bands, rather than another circular aperture.
 */
export function ringsRevealThreshold(ringIndex,count=10) {
    const n=Math.max(1,Math.trunc(count)||10);
    const r=Math.min(n-1,Math.max(0,Math.trunc(ringIndex)||0));
    return .02+(r/n)*.68+(r%2)*.20;
}
export function panelProgress(progress,panelIndex,count=6) {
    const n=Math.max(1,Math.trunc(count)||6);
    const i=Math.min(n-1,Math.max(0,Math.trunc(panelIndex)||0));
    return unit((unit(progress)-(i/n)*.63)/.46);
}
function annulusSectorPath(ctx,cx,cy,inner,outer,start,fraction) {
    if(fraction<=0)return;
    const end=start+Math.PI*2*unit(fraction);
    ctx.moveTo(cx+inner*Math.cos(start),cy+inner*Math.sin(start));
    ctx.lineTo(cx+outer*Math.cos(start),cy+outer*Math.sin(start));
    ctx.arc(cx,cy,outer,start,end,false);
    ctx.lineTo(cx+inner*Math.cos(end),cy+inner*Math.sin(end));
    if(inner>0)ctx.arc(cx,cy,inner,end,start,true);
    ctx.closePath();
}
function traceSpiralMask(ctx,progress,width,height) {
    const cx=width/2,cy=height/2,radius=Math.hypot(cx,cy),count=32;
    ctx.beginPath();
    for(let i=0;i<count;i++){
        const fraction=spiralRingFraction(progress,i,count);
        annulusSectorPath(ctx,cx,cy,radius*i/count,
            radius*(i+1)/count,-Math.PI/2,fraction);
    }
}
function traceRingMask(ctx,progress,width,height) {
    const cx=width/2,cy=height/2,radius=Math.hypot(cx,cy),count=10;
    ctx.beginPath();
    for(let i=0;i<count;i++){
        if(unit(progress)<ringsRevealThreshold(i,count))continue;
        annulusSectorPath(ctx,cx,cy,radius*i/count,
            radius*(i+1)/count,-Math.PI/2,1);
    }
}
/** Each square is covered briefly by an opaque slate tile before B replaces it.
 * Stable cell permutations avoid changing the effect during seek/export.
 * Unlike Random squares, the cover stage is a visibly separate state.
 */
export function blockCoverState(progress,cellIndex) {
    const p=unit(progress);
    if(p<=0)return 'old';
    if(p>=1)return 'new';
    const delay=seededCell(cellIndex)*.75;
    if(p<=delay)return 'old';
    return p<delay+.17?'cover':'new';
}
/** Two passes of ±45-degree diagonal hatching widen to reveal incoming B. */
export function crossHatchWidth(progress,orientation=0) {
    const p=unit(progress);
    const delay=orientation===0?0:.18;
    return unit((p-delay)/(1-delay))*.95;
}
function traceCrossHatch(context,progress,width,height) {
    const pitch=Math.max(16,Math.min(width,height)/3);
    const left=-height,right=width+height;
    context.beginPath();
    for(let orientation=0;orientation<2;orientation++){
        const half=pitch*crossHatchWidth(progress,orientation)/2;
        if(half<=0)continue;
        const slope=orientation===0?1:-1;
        for(let intercept=-width-height;intercept<=width+height;intercept+=pitch){
            const y0=slope*left+intercept,y1=slope*right+intercept;
            context.moveTo(left,y0-half);
            context.lineTo(right,y1-half);
            context.lineTo(right,y1+half);
            context.lineTo(left,y0+half);
            context.closePath();
        }
    }
}
/** Alternating film frames enter from opposite edges with staggered timing. */
export function filmStripProgress(progress,row,count=5){
    const n=Math.max(1,Math.trunc(count)||5);
    const i=Math.min(n-1,Math.max(0,Math.trunc(row)||0));
    return unit((unit(progress)-i*.065)/.74);
}
/** Card swipe: an intact rectangular B frame enters as a card from right. */
export function cardSwipeOffset(progress,width) {
    return (1-unit(progress))*width;
}
/** One stable camera displacement per frame, rather than Math.random(),
 * with a sinusoidal shake envelope that returns to rest at both endpoints.
 */
export function cameraShakeOffset(progress,frame,width,height) {
    const p=unit(progress);
    const envelope=Math.sin(Math.PI*p);
    if(p===0||p===1)return {x:0,y:0};
    const tick=Math.floor(Number.isFinite(Number(frame))?Number(frame):0);
    return {
        x:Math.round((seededCell(tick*71+3)*2-1)*Math.min(30,width*.09)*envelope),
        y:Math.round((seededCell(tick*71+8)*2-1)*Math.min(22,height*.12)*envelope)
    };
}
/** VHS tracking has a persistent rolling bar and horizontal offsets, quite
 * distinct from the intermittent blanked bands of Glitch flicker.
 */
export function vhsTrackingShift(progress,band,frame,width) {
    const p=unit(progress);
    if(p>=1)return 0;
    const tick=Math.floor(Number.isFinite(Number(frame))?Number(frame):0);
    const noise=seededCell(tick*139+band*17+11)*2-1;
    const drift=Math.sin(tick*.37+band*.83);
    return Math.round((noise*.75+drift*.25)*Math.min(34,width*.085)*(1-p));
}
/** Phase 8H: a rotating, growing intact incoming frame. */
export function spinAngle(progress) {
    return (1-unit(progress))*Math.PI*2;
}
export function spinScale(progress) {
    return .12+.88*unit(progress);
}
/** Cube-style turn, with opposing shrinking/expanding faces projected
 * horizontally in 24 bands; no third-party texture/shader dependency.
 */
export function cubeFaceWidth(progress,width,face='incoming') {
    return Math.max(0,width*(face==='outgoing'?1-unit(progress):unit(progress)));
}
export function cubeRowSkew(progress,row,rows,width) {
    if(unit(progress)===0||unit(progress)===1)return 0;
    const count=Math.max(2,Math.floor(rows)||24);
    const r=Math.min(count-1,Math.max(0,Math.trunc(row)||0));
    const displacement=Math.sin(Math.PI*unit(progress))*width*.055;
    return Math.round((r/(count-1)*2-1)*displacement);
}
/** Cross warp: B enters through a growing plus-sign, while the revealed
 * horizontal slices bend laterally and settle at both boundaries.
 */
export function crossWarpArms(progress,width,height) {
    const p=unit(progress);
    return {verticalWidth:width*p,horizontalHeight:height*p};
}
export function crossWarpShift(progress,band,bands,width) {
    const p=unit(progress);
    if(p===0||p===1)return 0;
    const count=Math.max(2,Math.trunc(bands)||24);
    const row=Math.min(count-1,Math.max(0,Math.trunc(band)||0));
    return Math.round(Math.sin(row*.88+12*p)*Math.sin(Math.PI*p)*Math.min(width*.06,52));
}
function traceCrossWarp(context,progress,width,height) {
    const {verticalWidth,horizontalHeight}=crossWarpArms(progress,width,height);
    context.beginPath();
    context.rect(0,(height-horizontalHeight)/2,width,horizontalHeight);
    context.rect((width-verticalWidth)/2,0,verticalWidth,height);
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

    if(id==='aperture-wipe'||id==='ripple'){
        context.save();
        traceIris(context,id,progress,width,height);
        context.clip();
        renderContained(context,media,width,height);
        context.restore();
        if(id==='ripple'){
            // Concentric wavefront lines make a ripple visually distinct from
            // the smooth aperture. Phase derives solely from timeline time.
            context.save();
            context.lineWidth=Math.max(1,Math.min(width,height)*.008);
            context.strokeStyle='#cceaff';
            for(let wave=1;wave<=2;wave++){
                const ringProgress=progress-wave*.10;
                if(ringProgress<=0)continue;
                context.globalAlpha=alpha*(1-progress)*.26;
                traceIris(context,'ripple',ringProgress,width,height);
                context.stroke();
            }
            context.restore();
        }
        return true;
    }

    if(id==='spiral-wipe'||id==='rings-wipe'){
        context.save();
        if(id==='spiral-wipe')traceSpiralMask(context,progress,width,height);
        else traceRingMask(context,progress,width,height);
        context.clip();
        renderContained(context,media,width,height);
        context.restore();
        return true;
    }

    if(id==='cross-hatch'){
        context.save();
        traceCrossHatch(context,progress,width,height);
        context.clip();
        renderContained(context,media,width,height);
        context.restore();
        return true;
    }
    if(id==='spin'){
        context.save();
        context.translate(width/2,height/2);
        context.rotate(spinAngle(progress));
        const scale=spinScale(progress);
        context.scale(scale,scale);
        context.translate(-width/2,-height/2);
        renderContained(context,media,width,height);
        context.restore();
        return true;
    }
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
    if(id==='cube'){
        // Rotate around a shared seam: A contracts toward the left as B
        // opens on the right. Mild row-dependent skew suggests perspective.
        const from=renderer.tracks?.find(t=>t.id===track.transitionFromId);
        if(!from?.media || (from.media.readyState!==undefined&&from.media.readyState<2))
            return false;
        const rows=24,leftWidth=cubeFaceWidth(progress,width,'outgoing');
        const rightWidth=cubeFaceWidth(progress,width,'incoming');
        context.save();
        context.fillStyle='#090c14';
        context.fillRect(0,0,width,height);
        renderContained(sc,from.media,width,height);
        for(let row=0;row<rows;row++){
            const y=Math.floor(row*height/rows),next=Math.floor((row+1)*height/rows);
            const shear=cubeRowSkew(progress,row,rows,width);
            if(leftWidth>.5)context.drawImage(full,0,y,width,next-y,shear,y,leftWidth,next-y);
        }
        sc.clearRect(0,0,width,height);
        renderContained(sc,media,width,height);
        for(let row=0;row<rows;row++){
            const y=Math.floor(row*height/rows),next=Math.floor((row+1)*height/rows);
            const shear=cubeRowSkew(progress,row,rows,width);
            if(rightWidth>.5)context.drawImage(full,0,y,width,next-y,
                width-rightWidth-shear,y,rightWidth,next-y);
        }
        context.restore();
        return true;
    }
    if(id==='tv-turn-off'){
        // In the first half, A collapses into the centerline. In the second,
        // the clean incoming B expands from that line. The screen is black
        // between phases, with a short brightness pulse like an old CRT.
        const showingA=progress<.5;
        const source=showingA
            ?renderer.tracks.find(t=>t.id===track.transitionFromId)?.media
            :media;
        if(source&&(source.readyState===undefined||source.readyState>=2))
            renderContained(sc,source,width,height);
        context.save();
        context.fillStyle='#000';
        context.fillRect(0,0,width,height);
        const heightFraction=tvScanHeight(progress);
        const size=height*heightFraction;
        if(size>.001&&source)
            context.drawImage(full,0,0,width,height,0,(height-size)/2,width,size);
        const flash=Math.max(0,1-Math.abs(progress-.5)/.045);
        if(flash>0){
            context.globalAlpha=alpha*flash;
            context.fillStyle='#ffffff';
            context.fillRect(0,Math.floor(height/2),width,Math.max(1,Math.round(height*.012)));
        }
        context.restore();
        return true;
    }
    renderContained(sc,media,width,height);

    if(id==='cross-warp'){
        const bands=24;
        context.save();
        traceCrossWarp(context,progress,width,height);
        context.clip();
        for(let row=0;row<bands;row++){
            const y=Math.floor(row*height/bands),next=Math.floor((row+1)*height/bands);
            const dx=crossWarpShift(progress,row,bands,width);
            context.drawImage(full,0,y,width,next-y,dx,y,width,next-y);
        }
        context.restore();
        return true;
    }
    if(id==='card-swipe'){
        const dx=cardSwipeOffset(progress,width);
        context.save();
        // The shadow and thin card edge separate the incoming B frame from
        // the outgoing A without altering either video source.
        context.fillStyle='rgba(0,0,0,.6)';
        context.fillRect(Math.max(0,dx-7),0,8,height);
        context.drawImage(full,dx,0,width,height);
        context.fillStyle='rgba(245,228,198,.95)';
        context.fillRect(dx,0,Math.max(1,Math.round(width*.009)),height);
        context.restore();
        return true;
    }
    if(id==='camera-shake'){
        const from=renderer.tracks.find(t=>t.id===track.transitionFromId);
        const source=progress<.5?(from?.media||media):media;
        if(source&&(source.readyState===undefined||source.readyState>=2)){
            sc.clearRect(0,0,width,height);
            renderContained(sc,source,width,height);
        }
        const {x,y}=cameraShakeOffset(progress,Math.floor(time*30),width,height);
        context.save();
        context.fillStyle='#08080c';
        context.fillRect(0,0,width,height);
        context.drawImage(full,x,y,width,height);
        const flash=Math.max(0,1-Math.abs(progress-.5)/.09);
        if(flash>0){
            context.globalAlpha=alpha*.42*flash;
            context.fillStyle='#fff';
            context.fillRect(0,0,width,height);
        }
        context.restore();
        return true;
    }
    if(id==='vhs-tracking'){
        const bands=24,frame=Math.floor(time*24);
        context.save();
        context.globalAlpha=alpha*(.28+progress*.72);
        for(let row=0;row<bands;row++){
            const y=Math.floor(row*height/bands);
            const next=row===bands-1?height:Math.floor((row+1)*height/bands);
            const dx=vhsTrackingShift(progress,row,frame,width);
            context.drawImage(full,0,y,width,next-y,dx,y,width,next-y);
        }
        // A strong rolling tracking line and fine scanlines produce an
        // analog tape feel; their phase is a pure function of time.
        const scanY=Math.floor((frame*7 % (height+24)))-12;
        context.globalAlpha=alpha*(1-progress)*.55;
        context.fillStyle='#73c7cf';
        context.fillRect(0,scanY,width,Math.max(2,Math.round(height*.045)));
        context.globalAlpha=alpha*(1-progress)*.19;
        context.fillStyle='#d4c4ef';
        const stride=Math.max(3,Math.round(height/28));
        for(let y=0;y<height;y+=stride)context.fillRect(0,y,width,1);
        context.restore();
        return true;
    }
    if(id==='block-cover'){
        const cols=10,rows=6;
        context.save();
        for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
            const sx=Math.floor(col*width/cols),sy=Math.floor(row*height/rows);
            const ex=col===cols-1?width:Math.floor((col+1)*width/cols);
            const ey=row===rows-1?height:Math.floor((row+1)*height/rows);
            const state=blockCoverState(progress,row*cols+col);
            if(state==='old')continue;
            if(state==='cover'){
                context.fillStyle=(row+col)%2===0?'#253348':'#ae8050';
                context.fillRect(sx,sy,ex-sx,ey-sy);
            }else{
                context.drawImage(full,sx,sy,ex-sx,ey-sy,sx,sy,ex-sx,ey-sy);
            }
        }
        context.restore();
        return true;
    }
    if(id==='film-strip'){
        // Five sliding strips with narrow dark film-frame bars and light
        // perforations. Each strip is moved by clipping to a growing window;
        // outgoing A remains untouched beneath the unrevealed region.
        const count=5;
        context.save();
        for(let row=0;row<count;row++){
            const y=Math.floor(row*height/count);
            const yEnd=row===count-1?height:Math.floor((row+1)*height/count);
            const bandHeight=yEnd-y;
            const p=filmStripProgress(progress,row,count);
            if(p<=0)continue;
            const shown=Math.min(width,Math.ceil(width*p));
            const x=row%2===0?0:width-shown;
            context.drawImage(full,x,y,shown,bandHeight,x,y,shown,bandHeight);
            const rail=Math.max(1,Math.round(bandHeight*.13));
            context.fillStyle='#141414';
            context.fillRect(x,y,shown,rail);
            context.fillRect(x,yEnd-rail,shown,rail);
            context.fillStyle='#e6d9b6';
            const holeWidth=Math.max(2,Math.round(width/65));
            const holeHeight=Math.max(1,Math.floor(rail/2));
            for(let hx=Math.ceil(x/(holeWidth*6))*(holeWidth*6);hx<x+shown;hx+=holeWidth*6){
                if(hx+holeWidth>x+shown)break;
                context.fillRect(hx,y+Math.floor((rail-holeHeight)/2),holeWidth,holeHeight);
                context.fillRect(hx,yEnd-rail+Math.floor((rail-holeHeight)/2),holeWidth,holeHeight);
            }
        }
        context.restore();
        return true;
    }
    if(id==='color-panel-wipe'){
        // Six tinted panels sweep over A before revealing their portion of B.
        // Each panel is a bounded draw, with no new full-resolution textures.
        const colors=['#9c733a','#284f9e','#6a377c','#aa8647','#30577c','#855e43'];
        const count=colors.length;
        context.save();
        for(let i=0;i<count;i++){
            const x=Math.floor(i*width/count);
            const edge=i===count-1?width:Math.floor((i+1)*width/count);
            const panelWidth=edge-x;
            const phase=panelProgress(progress,i,count);
            if(phase<=0)continue;
            const shown=Math.min(panelWidth,Math.ceil(2*phase*panelWidth));
            context.fillStyle=colors[i];
            if(phase<.5){
                context.fillRect(x,0,shown,height);
            }else{
                context.fillRect(x,0,panelWidth,height);
                const reveal=Math.min(panelWidth,Math.ceil((phase-.5)*2*panelWidth));
                if(reveal>0)context.drawImage(full,x,0,reveal,height,x,0,reveal,height);
            }
        }
        context.restore();
        return true;
    }

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
