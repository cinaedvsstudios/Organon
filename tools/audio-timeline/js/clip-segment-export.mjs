/**
 * Build an isolated, non-destructive export project for one selected clip.
 * Its trim source offset, speed, embedded audio, effects, transformations
 * and keyframes remain unchanged. Only its project start resets to zero.
 */
export function planClipSegmentExport(tracks,clipId,maxSeconds=120) {
    const selected=(tracks||[]).find(track=>track?.id===clipId);
    if(!selected || !selected.file || !selected.sourceName)
        throw new Error('This clip has no source media. Relink the original before exporting its section.');
    const duration=Number(selected.clipDuration);
    if(!Number.isFinite(duration) || duration<=0)
        throw new Error('The clip has no playable section to export.');
    if(duration>maxSeconds)
        throw new Error(`Trimmed-section export currently supports up to ${maxSeconds} seconds. Split the clip into shorter sections first.`);
    if(!['video','sticker','background','audio'].includes(selected.type))
        throw new Error('This clip type cannot be exported by the video renderer.');
    const clip={
        ...selected,
        start:0,
        // A paired transition relies on its missing outgoing clip. Keep the
        // selected clip standalone; independent fades are preserved.
        transitionFromId:null,
        transitionEffectId:null,
        visualTransitions:selected.transitionFromId
            ? {...(selected.visualTransitions||{}),enter:{type:'none',duration:0,curve:'linear'}}
            : selected.visualTransitions,
        audio:{...(selected.audio||{}),fx:{...(selected.audio?.fx||{})}},
        transform:{...(selected.transform||{})},
        adjustments:{...(selected.adjustments||{})},
        keyframes:Object.fromEntries(Object.entries(selected.keyframes||{}).map(([key,frames])=>[
            key,Array.isArray(frames)?frames.map(frame=>({...frame})):[]
        ])),
        transparency:{...(selected.transparency||{})},
    };
    return {
        tracks:[clip],
        duration,
        sourceOffset:Number(selected.sourceOffset)||0,
        sourceName:selected.sourceName,
        isAudioOnly:selected.type==='audio',
    };
}
