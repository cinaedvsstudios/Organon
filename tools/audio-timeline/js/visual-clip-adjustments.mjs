/**
 * MotoriClip clip-local visual parameters.
 * Works in preview, real-time recording and fixed-timestamp exports.
 * Keyframes use seconds from the clip's timeline start, not absolute time.
 */
export const DEFAULT_TRANSFORM=Object.freeze({
    scale:1,x:0,y:0,rotation:0,opacity:1
});
export const DEFAULT_ADJUSTMENTS=Object.freeze({
    brightness:0,contrast:0,saturation:0,exposure:0,
    temperature:0,tint:0,vignette:0
});
export const VISIBLE_VISUAL_TYPES=new Set(['video','sticker','background']);
const bounded=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):0));
const bounds=Object.freeze({
    'transform.scale':[.1,5], 'transform.x':[-10000,10000],
    'transform.y':[-10000,10000],'transform.rotation':[-360,360],
    'transform.opacity':[0,1],
    'adjustments.brightness':[-100,100],
    'adjustments.contrast':[-100,200],
    'adjustments.saturation':[-100,200],
    'adjustments.exposure':[-100,100],
    'adjustments.temperature':[-100,100],
    'adjustments.tint':[-100,100],
    'adjustments.vignette':[0,100]
});
export const getBaseVisualValue=(track,property)=>{
    const [group,key]=String(property).split('.');
    const defaults=group==='transform'?DEFAULT_TRANSFORM:DEFAULT_ADJUSTMENTS;
    const val=track?.[group]?.[key];
    return bounded(val??defaults[key]??0,...(bounds[property]||[-10000,10000]));
};
export function visualParameterAt(track,property,timelineTime){
    const local=Math.max(0,(Number(timelineTime)||0)-(Number(track?.start)||0));
    const frames=(track?.keyframes?.[property]||[]).filter(frame=>
        Number.isFinite(Number(frame?.time)) && Number.isFinite(Number(frame?.value)))
        .sort((a,b)=>a.time-b.time);
    const base=getBaseVisualValue(track,property);
    if(!frames.length)return base;
    if(local<=frames[0].time)return bounded(frames[0].value,...bounds[property]);
    const last=frames[frames.length-1];
    if(local>=last.time)return bounded(last.value,...bounds[property]);
    for(let i=1;i<frames.length;i++){
        if(local>frames[i].time)continue;
        const a=frames[i-1],b=frames[i],position=(local-a.time)/(b.time-a.time||1);
        return bounded(Number(a.value)+(Number(b.value)-Number(a.value))*position,...bounds[property]);
    }
    return base;
}
export function upsertVisualKeyframe(track,property,timelineTime,value,{remove=false}={}){
    if(!(property in bounds))throw Error('Unknown visual keyframe property: '+property);
    const local=bounded((Number(timelineTime)||0)-(Number(track.start)||0),0,Math.max(0,Number(track.clipDuration)||0));
    track.keyframes ||= {};
    const frames=Array.isArray(track.keyframes[property])?[...track.keyframes[property]]:[];
    const index=frames.findIndex(point=>Math.abs(point.time-local)<.02);
    if(remove && index>=0)frames.splice(index,1);
    else if(!remove){
        const next={time:Number(local.toFixed(3)),value:bounded(value,...bounds[property])};
        if(index>=0)frames[index]=next;
        else frames.push(next);
    }
    frames.sort((a,b)=>a.time-b.time);
    track.keyframes[property]=frames;
    return frames;
}
export function applyVisualContext(ctx,track,time,width,height){
    const transform=key=>visualParameterAt(track,'transform.'+key,time);
    const adjust=key=>visualParameterAt(track,'adjustments.'+key,time);
    const x=transform('x'),y=transform('y');
    const scale=transform('scale'),rotation=transform('rotation');
    if(x||y||scale!==1||rotation){
        ctx.translate(width/2+x,height/2+y);
        ctx.rotate(rotation*Math.PI/180);
        ctx.scale(scale,scale);
        ctx.translate(-width/2,-height/2);
    }
    const brightness=bounded(1+adjust('brightness')/100,0,3)*Math.pow(2,adjust('exposure')/100);
    const contrast=bounded(1+adjust('contrast')/100,0,3);
    const saturation=bounded(1+adjust('saturation')/100,0,3);
    const temperature=adjust('temperature'),tint=adjust('tint');
    ctx.filter=`brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) sepia(${(Math.abs(temperature)/350).toFixed(3)}) hue-rotate(${(temperature*.21+tint*.26).toFixed(2)}deg)`;
    ctx.globalAlpha *= transform('opacity');
}
export function drawVisualVignette(ctx,track,time,width,height){
    const intensity=visualParameterAt(track,'adjustments.vignette',time)/100;
    if(intensity<=0)return;
    ctx.save();
    ctx.filter='none';
    const gradient=ctx.createRadialGradient(width/2,height/2,Math.min(width,height)*.16,width/2,height/2,Math.hypot(width,height)*.58);
    gradient.addColorStop(0,'rgba(0,0,0,0)');
    gradient.addColorStop(1,`rgba(0,0,0,${Math.min(.92,intensity*.9).toFixed(3)})`);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    ctx.restore();
}
