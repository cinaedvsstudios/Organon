/** MotoriClip Phase 8B: plan a non-destructive fade from an earlier video A
 * into a later video B. Never mutate media, track lists or preview runtime.
 */
import { normalizeVisualTransitions } from './visual-transitions.mjs';
import { isAvailablePairEffect } from './paired-visual-effects.mjs';

export const PAIR_VISUAL_TYPES = new Set(['video','sticker','background']);
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const end=track=>finite(track.start)+Math.max(0,finite(track.clipDuration));
const overlaps=(start,duration,other)=>start<end(other)-.001&&start+duration>finite(other.start)+.001;
export function planPairedTransition(tracks,selectedIds,requestedDuration=1,effectId='fade',{preserveOrder=false}={}){
    if(!isAvailablePairEffect(effectId))throw new Error('Transition effect is not implemented yet.');
    if(!Array.isArray(selectedIds)||selectedIds.length!==2||new Set(selectedIds).size!==2)
        throw new Error('Select exactly two different video or still-image clips.');
    const selected=selectedIds.map(id=>(tracks||[]).find(t=>t.id===id));
    if(selected.some(t=>!t||!PAIR_VISUAL_TYPES.has(t.type)||!t.sourceName||!t.file))
        throw new Error('Select two loaded visual clips (video or still images) to create a transition.');
    const [a,b]=preserveOrder?selected:selected.sort((x,y)=>finite(x.start)-finite(y.start)
        || (tracks.indexOf(x)-tracks.indexOf(y)));
    const aDuration=finite(a.clipDuration), bDuration=finite(b.clipDuration);
    const max=Math.min(30,aDuration,bDuration);
    if(max<.1)throw new Error('Both visual clips must be at least 0.1 seconds long.');
    const input=Number(requestedDuration);
    if(!Number.isFinite(input)||input<=0)throw new Error('Enter a transition duration greater than zero.');
    const duration=Math.min(Math.max(.1,input),max);
    const incomingStart=Math.max(0,end(a)-duration);
    const conflicts=(tracks||[]).some(t=>t.id!==b.id&&t.type===b.type&&t.sourceName
        &&t.laneId===b.laneId&&overlaps(incomingStart,bDuration,t));
    const needsNewLane=conflicts||(a.type===b.type&&finite(b.order)>=finite(a.order));
    const incomingTransitions=normalizeVisualTransitions(b.visualTransitions);
    incomingTransitions.enter={type:'fade',duration,curve:'linear'};
    const outgoingTransitions=normalizeVisualTransitions(a.visualTransitions);
    // B fades over a fully opaque A. Fading both at once would darken the
    // combined image halfway through the overlap, so disable A's exit fade.
    outgoingTransitions.exit={...outgoingTransitions.exit,duration:0};
    return {
        fromId:a.id,toId:b.id,duration,start:incomingStart,
        needsNewLane,incomingOrder:finite(a.order)-.5,
        incomingTransitions,outgoingTransitions,effectId,
        outgoingEnd:end(a)
    };
}

/** Pair metadata is valid only while both clips retain the planned overlap.
 * Dragging/trimming either clip can break the link, without erasing a fade.
 */
export const planPairedFade=(tracks,selectedIds,requestedDuration=1)=>planPairedTransition(tracks,selectedIds,requestedDuration,'fade');

export function isPairedFadeActive(track,tracks){
    if(!track?.transitionFromId||!isAvailablePairEffect(track.transitionEffectId)||!PAIR_VISUAL_TYPES.has(track.type))return false;
    const from=(tracks||[]).find(t=>t.id===track.transitionFromId&&PAIR_VISUAL_TYPES.has(t.type));
    if(!from||!from.sourceName||!track.sourceName||!track.file
        ||(track.type===from.type&&finite(track.order)>=finite(from.order)))return false;
    const fade=finite(track.visualTransitions?.enter?.duration);
    if(fade<.1)return false;
    return Math.abs(finite(track.start)-(end(from)-fade))<=.051;
}
