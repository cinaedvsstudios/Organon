import { paintSpiralBlockWipe } from './gl-transitions/SpiralBlockWipe.mjs';
import { paintHologram } from './gl-transitions/Hologram.mjs';
import { paintCellDissolve } from './gl-transitions/CellDissolve.mjs';
import { paintVortex } from './gl-transitions/Vortex.mjs';
import { paintCrumple } from './gl-transitions/Crumple.mjs';
import { paintLiquidFill } from './gl-transitions/LiquidFill.mjs';
import { paintHeatHaze } from './gl-transitions/HeatHaze.mjs';
import { paintSphere } from './gl-transitions/Sphere.mjs';
import { paintRingsWipe } from './gl-transitions/RingsWipe.mjs';
import { paintSnapshot } from './gl-transitions/Snapshot.mjs';
import { paintColorPanelWipe } from './gl-transitions/ColorPanelWipe.mjs';
import { paintGallery } from './gl-transitions/Gallery.mjs';
import { paintVhsTracking } from './gl-transitions/VhsTracking.mjs';
import { paintCardSwipe } from './gl-transitions/CardSwipe.mjs';
import { paintCameraShake } from './gl-transitions/CameraShake.mjs';
import { paintSmokeDissolve } from './gl-transitions/SmokeDissolve.mjs';
import { paintSplatterWipe } from './gl-transitions/SplatterWipe.mjs';
import { paintInkBleed } from './gl-transitions/InkBleed.mjs';
import { paintRefraction } from './gl-transitions/Refraction.mjs';
import { paintWhipSpin } from './gl-transitions/WhipSpin.mjs';
import { paintPaperTear } from './gl-transitions/PaperTear.mjs';
import { paintApertureWipe } from './gl-transitions/ApertureWipe.mjs';
import { paintSpiralWipe } from './gl-transitions/SpiralWipe.mjs';
import { paintPrisms } from './gl-transitions/Prisms.mjs';
import { paintTvTurnOff } from './gl-transitions/TvTurnOff.mjs';
import { paintColorCoords } from './gl-transitions/ColorCoords.mjs';
import { paintCrossWarp } from './gl-transitions/CrossWarp.mjs';
import { paintFade } from './gl-transitions/Fade.mjs';
import { paintGlitchFlicker } from './gl-transitions/GlitchFlicker.mjs';
import { paintCrosshatch } from './gl-transitions/Crosshatch.mjs';
import { paintCube } from './gl-transitions/Cube.mjs';
import { paintBloomDissolve } from './gl-transitions/BloomDissolve.mjs';
import { paintBokehDissolve } from './gl-transitions/BokehDissolve.mjs';
import { paintLightRays } from './gl-transitions/LightRays.mjs';
import { paintBlockCover } from './gl-transitions/BlockCover.mjs';
import { paintDisintegrate } from './gl-transitions/Disintegrate.mjs';
import { paintAscii } from './gl-transitions/Ascii.mjs';
import { paintFilmStrip } from './gl-transitions/FilmStrip.mjs';
import { normalizeTransitionEffectId } from './transition-catalog.mjs';
/**
 * MotoriClip 8C–8O: deterministic canvas-native paired effects.
 *
 * These are independent implementations named for the user's selected gallery
 * effects, not copies of third-party GLSL shaders. All operations use a bounded
 * number of draw calls and the same canvas path for preview and fixed export.
 */
export const ACTIVE_PAIR_EFFECTS = Object.freeze(['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','whipspin','cube','cross-warp','paper-tear','ink-bleed','splatter-wipe','cell-dissolve','bloom-dissolve','smoke-dissolve','vortex','heat-haze','refraction','liquid-fill','disintegrate','light-rays','ascii','colorcoords','prisms','spiralblockwipe','hologram','crumple','sphere','snapshot','gallery','bokeh-dissolve']);
export const isAvailablePairEffect = id => ACTIVE_PAIR_EFFECTS.includes(normalizeTransitionEffectId(id));
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
/** Phase 8I: a steadily advancing jagged paper edge.
 * Jitter is reproducible per sample; the envelope decays at both endpoints.
 */
export function paperTearEdge(progress,segment,width) {
    const p=unit(progress);
    if(p===0)return 0;
    if(p===1)return width;
    const grain=(seededCell(segment*17+193)*2-1);
    return Math.max(0,Math.min(width,width*p+
        grain*Math.min(width*.072,44)*Math.sin(Math.PI*p)));
}
function tracePaperTear(ctx,progress,width,height) {
    const segments=36;
    ctx.beginPath();
    ctx.moveTo(0,0);
    for(let i=0;i<=segments;i++)
        ctx.lineTo(paperTearEdge(progress,i,width),height*i/segments);
    ctx.lineTo(0,height);
    ctx.closePath();
}
/** Ink slowly blossoms from a fairly even distribution of irregular pools. */
export function inkBleedRadius(progress,index,width,height){
    const p=unit(progress);
    const delayed=Math.max(0,p-seededCell(index*13+37)*.22);
    // Final broadening merges the irregular pools before the clean B frame,
    // avoiding a sudden jump in coverage at the exact transition endpoint.
    const finish=unit((p-.58)/.41)*Math.hypot(width,height);
    return Math.max(0,Math.min(width,height)*.34*delayed
        *(.8+seededCell(index*23+79)*.5)+finish);
}
function traceInkBleed(ctx,progress,width,height) {
    const cols=6,rows=4,vertices=16;
    ctx.beginPath();
    for(let i=0;i<cols*rows;i++){
        const radius=inkBleedRadius(progress,i,width,height);
        if(radius<=0)continue;
        const x=(i%cols+.5+(seededCell(i+131)-.5)*.38)*width/cols;
        const y=(Math.floor(i/cols)+.5+(seededCell(i+251)-.5)*.38)*height/rows;
        for(let v=0;v<=vertices;v++){
            const k=v%vertices,angle=v/vertices*Math.PI*2;
            const jagged=radius*(.83+seededCell(i*97+k*11+317)*.34);
            const px=x+Math.cos(angle)*jagged,py=y+Math.sin(angle)*jagged;
            if(v===0)ctx.moveTo(px,py);
            else ctx.lineTo(px,py);
        }
        ctx.closePath();
    }
}
/** Splatter advances horizontally in isolated drops and long spray dots.
 * This has a different spatial order and size distribution than ink bleed.
 */
export function splatterDropRadius(progress,index,width,height) {
    const p=unit(progress);
    const delay=seededCell(index*29+431)*.82+seededCell(index*13+593)*.08;
    const grown=unit((p-delay)/.22);
    const size=.032+seededCell(index*61+719)*.09;
    return grown*Math.min(width,height)*size;
}
function traceSplatter(ctx,progress,width,height){
    const count=72;
    ctx.beginPath();
    // Advancing paint front fills the small remaining gaps at the end, while
    // deterministic droplets fly ahead of the frontier throughout the wipe.
    const front=unit((unit(progress)-.38)/.60);
    if(front>0)ctx.rect(0,0,width*front,height);
    for(let i=0;i<count;i++){
        const r=splatterDropRadius(progress,i,width,height);
        if(r<=0)continue;
        const x=seededCell(i*29+431)*width,y=seededCell(i*53+883)*height;
        const stretch=i%5===0?1.85:.9+seededCell(i*7+991)*.3;
        ctx.moveTo(x+r*stretch,y);
        ctx.ellipse(x,y,Math.max(.01,r*stretch),Math.max(.01,r*.68),
            (seededCell(i+101)-.5)*.8,0,2*Math.PI);
    }
}
/** Legacy Phase 8J helper retained solely to avoid breaking historical API tests.
 * Render path now uses the original GLSL Voronoi cells and never calls this
 * regular-hexagon approximation.
 */
export function cellDissolveGrowth(progress,index) {
    const p=unit(progress);
    if(p<=0)return 0;
    if(p>=1)return 1;
    const delay=seededCell(index*71+31)*.57;
    return unit((p-delay)/.38);
}
/** A brief overexposed glow accompanies B's entrance, settling to zero
 * at both endpoints and leaving the ordinary rendered B at completion.
 */
export function bloomPulse(progress) {
    const p=unit(progress);
    if(p===0||p===1)return 0;
    return Math.pow(Math.sin(Math.PI*p),1.35);
}
/** Soft smoke clouds drift sideways with a time-derived, per-cloud vertical
 * wobble. No random state is consumed during seeks or fixed-frame export.
 */
export function smokeCloud(progress,index,width,height) {
    const p=unit(progress),col=index%6,row=Math.floor(index/6);
    const drift=p*width*.66;
    return {
        x:(col/6-.15)*width+drift+(seededCell(index*31+101)-.5)*width*.16,
        y:(row+.45)*height/3+
            Math.sin(p*9+index*1.17)*height*.07+
            (seededCell(index*29+211)-.5)*height*.10,
        radius:Math.min(width,height)*(.28+seededCell(index*17+317)*.20)
    };
}
export function smokeDensity(progress) {
    const p=unit(progress);
    if(p===0||p===1)return 0;
    return Math.sin(Math.PI*p);
}
/** Thermal shimmer is smoothly wave-shaped, not the discrete random
 * horizontal jitter or dropout used by VHS and Glitch flicker.
 */
export function heatHazeShift(progress,band,frame,width) {
    const p=unit(progress);
    if(p===0||p===1)return 0;
    const t=Number.isFinite(Number(frame))?Math.floor(Number(frame)):0;
    const envelope=Math.sin(Math.PI*p);
    const wave=Math.sin(band*.73+t*.19)*.72+Math.sin(band*1.41-t*.13)*.28;
    return Math.round(wave*envelope*Math.min(width*.065,34));
}
/** Refraction bends the sampled incoming footage inside alternating
 * triangular lens facets; all offsets relax to zero at the boundaries.
 */
export function refractionFacetOffset(progress,facet,width,height) {
    const p=unit(progress);
    if(p===0||p===1)return {x:0,y:0};
    const amplitude=Math.sin(Math.PI*p);
    const angle=seededCell(facet*47+11)*Math.PI*2;
    const magnitude=.45+seededCell(facet*23+29)*.55;
    return {
        x:Math.round(Math.cos(angle)*amplitude*magnitude*Math.min(width*.085,28)),
        y:Math.round(Math.sin(angle)*amplitude*magnitude*Math.min(height*.09,20))
    };
}
/** Phase 8L: a rising liquid surface with time-dependent wave interference.
 * Higher progress lowers the surface towards the top of the canvas.
 */
export function liquidSurfaceY(progress,x,width,height,time=0) {
    const p=unit(progress);
    if(p===0)return height;
    if(p===1)return 0;
    const w=Math.max(1,width),h=Math.max(1,height);
    const phase=2*Math.PI*Number(x)/w*2.5+(Number.isFinite(time)?time:0)*3.6;
    const wave=(Math.sin(phase)*.72+Math.sin(phase*.57+1.4)*.28);
    return Math.max(0,Math.min(h,h*(1-p)+
        wave*Math.min(h*.065,38)*Math.sin(Math.PI*p)));
}
function traceLiquidFill(ctx,progress,width,height,time) {
    const samples=72;
    ctx.beginPath();
    ctx.moveTo(0,height);
    ctx.lineTo(0,liquidSurfaceY(progress,0,width,height,time));
    for(let i=1;i<=samples;i++){
        const x=width*i/samples;
        ctx.lineTo(x,liquidSurfaceY(progress,x,width,height,time));
    }
    ctx.lineTo(width,height);
    ctx.closePath();
}
/** Phase 8M: incoming B appears as a fixed-width glyph portrait before
 * resolving into unmodified footage. Only a tiny, resolution-independent
 * 32×18 sample is read; never read full-resolution pixels per frame.
 */
export function asciiGlyphForLuminance(luminance){
    const ramp='@%#*+=-:. ';
    const value=Math.max(0,Math.min(255,Number(luminance)||0));
    return ramp[Math.min(ramp.length-1,Math.floor(value/256*ramp.length))];
}
export function asciiIntensity(progress) {
    const p=unit(progress);
    return p===0||p===1?0:Math.sin(Math.PI*p);
}
/** Hex-code panels represent the actual sampled incoming source RGB,
 * independently staggered and faded, not arbitrary decorative numbers.
 */
export function rgbToColorCode(red,green,blue) {
    const hex=v=>Math.max(0,Math.min(255,Math.round(Number(v)||0)))
        .toString(16).padStart(2,'0').toUpperCase();
    return '#'+hex(red)+hex(green)+hex(blue);
}
export function colorCodeStrength(progress,index) {
    const p=unit(progress);
    if(p===0||p===1)return 0;
    const delay=seededCell(index*37+67)*.24;
    const phase=unit((p-delay)/(1-delay));
    return Math.sin(Math.PI*phase);
}
/** Prisms split B into wide angular glass facets whose chromatic axes
 * drift apart at mid-transition; unlike 24 triangular Refraction tiles.
 */
export function prismFacetOffset(progress,facet,width,height) {
    const p=unit(progress);
    if(p===0||p===1)return {x:0,y:0};
    const angle=Math.PI*2*(Math.trunc(facet)||0)/9;
    const amplitude=Math.sin(Math.PI*p);
    return {
        x:Math.round(Math.cos(angle)*amplitude*Math.min(width*.075,48)),
        y:Math.round(Math.sin(angle)*amplitude*Math.min(height*.085,40))
    };
}
/** Create or resize a scratch canvas held by the renderer instance. */

/** Deterministic paper fold displacement that closes at both endpoints. */
export function crumpleFold(progress,index,width,height){
    const p=unit(progress);
    if(p===0||p===1)return {x:0,y:0};
    const envelope=Math.sin(Math.PI*p);
    return {x:(seededCell(index*17+41)*2-1)*width*.12*envelope,
        y:(seededCell(index*19+67)*2-1)*height*.12*envelope};
}


/** Phase 8O: deterministic closing/opening geometry for the final four effects. */
export function sphereRadius(progress,width,height){
    return Math.hypot(width,height)*unit(progress)*.55;
}
export function snapshotFlash(progress){
    return Math.max(0,1-Math.abs(unit(progress)-.5)/.105);
}
export function galleryTileProgress(progress,index,count=6){
    const delay=index/Math.max(1,count)*.45;
    return unit((unit(progress)-delay)/.55);
}

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
    const id=normalizeTransitionEffectId(track.transitionEffectId);
    if(!isAvailablePairEffect(id))return false;
    const progress=pairedEffectProgress(track,time);
    if(progress<=0)return true; // Keep A entirely visible at the boundary.
    if(progress>=1)return false; // Let normal renderer draw a pristine B.
    if(id==='fade')
        return paintFade(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='glitch-flicker')
        return paintGlitchFlicker(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='spiralblockwipe')
        return paintSpiralBlockWipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='hologram')
        return paintHologram(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='cell-dissolve')
        return paintCellDissolve(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='vortex')
        return paintVortex(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='crumple')
        return paintCrumple(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='liquid-fill')
        return paintLiquidFill(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='heat-haze')
        return paintHeatHaze(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='sphere')
        return paintSphere(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='rings-wipe')
        return paintRingsWipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='snapshot')
        return paintSnapshot(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='color-panel-wipe')
        return paintColorPanelWipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='gallery')
        return paintGallery(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='vhs-tracking')
        return paintVhsTracking(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='card-swipe')
        return paintCardSwipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='camera-shake')
        return paintCameraShake(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='smoke-dissolve')
        return paintSmokeDissolve(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='splatter-wipe')
        return paintSplatterWipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='ink-bleed')
        return paintInkBleed(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='refraction')
        return paintRefraction(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='whipspin')
        return paintWhipSpin(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='paper-tear')
        return paintPaperTear(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='aperture-wipe')
        return paintApertureWipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='spiral-wipe')
        return paintSpiralWipe(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='prisms')
        return paintPrisms(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='tv-turn-off')
        return paintTvTurnOff(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='colorcoords')
        return paintColorCoords(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='cross-warp')
        return paintCrossWarp(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='cross-hatch')
        return paintCrosshatch(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='cube')
        return paintCube(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='bloom-dissolve')
        return paintBloomDissolve(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='bokeh-dissolve')
        return paintBokehDissolve(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='light-rays')
        return paintLightRays(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='block-cover')
        return paintBlockCover(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='disintegrate')
        return paintDisintegrate(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='ascii')
        return paintAscii(renderer,context,track,width,height,time,renderContained,progress);
    if(id==='film-strip')
        return paintFilmStrip(renderer,context,track,width,height,time,renderContained,progress);
    const alpha=context.globalAlpha;
    const media=track.media;



    if(id==='refraction'){
        const full=scratchCanvas(renderer,'transitionFullScratch',width,height);
        const fullCtx=full.getContext('2d');
        fullCtx.clearRect(0,0,width,height);
        renderContained(fullCtx,media,width,height);
        const cx=width/2,cy=height/2;
        context.save();
        if(id==='heat-haze'){
            const bands=28,frame=Math.floor(time*30);
            context.globalAlpha=alpha*progress;
            for(let band=0;band<bands;band++){
                const y=Math.floor(band*height/bands);
                const end=band===bands-1?height:Math.floor((band+1)*height/bands);
                const dx=heatHazeShift(progress,band,frame,width);
                context.drawImage(full,0,y,width,end-y,dx,y,width,end-y);
            }
            // Gentle hot-air highlights ripple through the frame instead
            // of VHS scan lines, glitch dropouts, or sharp tile boundaries.
            const shimmer=Math.sin(Math.PI*progress);
            context.globalAlpha=alpha*shimmer*.09;
            context.fillStyle='#ffc46e';
            for(let band=0;band<bands;band+=4){
                const y=Math.floor((band+.4)*height/bands);
                context.fillRect(0,y,width,Math.max(1,Math.round(height/bands*.5)));
            }
        }else{
            // Two triangular facets per cell create an angled, multi-lens
            // refraction rather than a uniform crossfade or square mosaic.
            const cols=4,rows=3;
            context.globalAlpha=alpha*progress;
            for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
                const x0=col*width/cols,x1=(col+1)*width/cols;
                const y0=row*height/rows,y1=(row+1)*height/rows;
                for(let half=0;half<2;half++){
                    const idx=(row*cols+col)*2+half;
                    const shift=refractionFacetOffset(progress,idx,width,height);
                    context.save();
                    context.beginPath();
                    context.moveTo(x0,y0);
                    if(half===0){
                        context.lineTo(x1,y0);
                        context.lineTo(x1,y1);
                    }else{
                        context.lineTo(x0,y1);
                        context.lineTo(x1,y1);
                    }
                    context.closePath();
                    context.clip();
                    context.drawImage(full,shift.x,shift.y,width,height);
                    context.restore();
                }
            }
            // Subtle prismatic seams catch the boundaries between lenses.
            context.globalAlpha=alpha*Math.sin(Math.PI*progress)*.23;
            context.lineWidth=Math.max(1,Math.min(width,height)*.011);
            for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
                const x0=col*width/cols,x1=(col+1)*width/cols;
                const y0=row*height/rows,y1=(row+1)*height/rows;
                context.strokeStyle=(row+col)%2?'#b7efff':'#f7a7d9';
                context.beginPath();
                context.moveTo(x0,y0);
                context.lineTo(x1,y1);
                context.stroke();
            }
        }
        context.restore();
        return true;
    }

    if(id==='ripple'){
        context.save();
        traceIris(context,id,progress,width,height);
        context.clip();
        renderContained(context,media,width,height);
        context.restore();
        {
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

    return false;
}
