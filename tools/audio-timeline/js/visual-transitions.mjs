/**
 * MotoriClip visual transition primitives. Keep this module independent of DOM
 * and media encoders so preview, fixed-frame export and tests use one envelope.
 * Phase 8A supports visual alpha fade only; other effect types come later.
 */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
export const emptyVisualTransitions=()=>({
    enter:{type:'fade',duration:0,curve:'linear'},
    exit:{type:'fade',duration:0,curve:'linear'}
});
export function normalizeVisualTransitions(value) {
    const defaults=emptyVisualTransitions();
    for(const edge of ['enter','exit']){
        const data=value?.[edge]||{};
        defaults[edge]={
            type:'fade',
            duration:Math.max(0,Number.isFinite(Number(data.duration))?Number(data.duration):0),
            curve:data.curve==='smooth'?'smooth':'linear'
        };
    }
    return defaults;
}
export function fadeDuration(track,edge) {
    if(track?.type!=='video'||(edge!=='enter'&&edge!=='exit'))return 0;
    return clamp(track.visualTransitions?.[edge]?.duration,0,Math.max(0,Number(track.clipDuration)||0));
}
function curved(progress,curve) {
    const p=clamp(progress,0,1);
    return curve==='smooth'?p*p*(3-2*p):p;
}
export function visualFadeOpacity(track,timelineTime) {
    if(track?.type!=='video')return 1;
    const total=Math.max(0,Number(track.clipDuration)||0);
    if(!total)return 1;
    const elapsed=clamp(Number(timelineTime)-(Number(track.start)||0),0,total);
    const enter=fadeDuration(track,'enter'),exit=fadeDuration(track,'exit');
    let alpha=1;
    if(enter>0)alpha=Math.min(alpha,curved(elapsed/enter,track.visualTransitions?.enter?.curve));
    if(exit>0)alpha=Math.min(alpha,curved((total-elapsed)/exit,track.visualTransitions?.exit?.curve));
    return alpha;
}
export function splitVisualTransitions(value) {
    const source=normalizeVisualTransitions(value);
    const left=normalizeVisualTransitions(source),right=normalizeVisualTransitions(source);
    left.exit.duration=0; // The split is a cut, not an intentional new outro.
    right.enter.duration=0;
    return {left,right};
}
