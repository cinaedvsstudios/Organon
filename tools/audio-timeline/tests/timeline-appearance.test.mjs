import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseTimelineColour,clipVisualKind,resolvedClipColour,resolvedLaneColour}
    from '../js/timeline-appearance.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

test('media-type timeline colours distinguish video, audio, stills, text and effects',()=>{
    const examples=[
        [{type:'video'},'video'],
        [{type:'audio'},'audio'],
        [{type:'background',sourceName:'photo.jpg'},'image'],
        [{type:'sticker',sourceName:'photo.png'},'image'],
        [{type:'sticker',sourceName:'text-news-title-overlay.png'},'text'],
        [{type:'sticker',sourceName:'effect-haze-overlay.png'},'effect']
    ];
    assert.deepEqual(examples.map(([clip])=>resolvedClipColour(clip)).length,6);
    assert.equal(new Set(examples.map(([clip])=>resolvedClipColour(clip))).size,5);
    for(const [clip,kind] of examples)assert.equal(clipVisualKind(clip),kind);
});
test('clip override outranks lane colour; lane outranks category default',()=>{
    const clip={type:'video',laneColor:'#55AA33',clipColor:'#FF0022'};
    assert.equal(resolvedClipColour(clip),'#ff0022');
    assert.equal(resolvedLaneColour(clip),'#55aa33');
    delete clip.clipColor;
    assert.equal(resolvedClipColour(clip),'#55aa33');
    delete clip.laneColor;
    assert.equal(resolvedClipColour(clip),'#4b84bf');
});
test('bad colours are never interpreted as CSS or restored to a clip',()=>{
    for(const value of ['red','rgb(1 2 3)','transparent','#fff','url(javascript:alert(1))','',null,33])
        assert.equal(normaliseTimelineColour(value),null);
});
test('Undo snapshots retain and clear original lane and clip colour metadata',()=>{
    const clip={id:'a',type:'sticker',laneId:'lane1',laneLabel:'Poster',
        sourceFileId:'asset1',sourceName:'poster.png',start:0,sourceOffset:0,clipDuration:3,
        laneColor:'#5522ee',clipColor:'#88ffaa'};
    const saved=snapshotClip(clip);
    assert.equal(saved.laneColor,'#5522ee');
    assert.equal(saved.clipColor,'#88ffaa');
    clip.laneColor=null;clip.clipColor=null;
    applyClipData(clip,saved);
    assert.equal(clip.clipColor,'#88ffaa');
    applyClipData(clip,{...saved,clipColor:null,laneColor:null});
    assert.equal(clip.clipColor,null);
    assert.equal(clip.laneColor,null);
});
