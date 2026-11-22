import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,asciiGlyphForLuminance,asciiIntensity,
    rgbToColorCode,colorCodeStrength,prismFacetOffset,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const selected=['ascii','colorcoords','prisms'];

test('Phase 8M retains all 41 names and enables only the three new choices',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(31,34),selected);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='available').length,41);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='requested').length,0);
    for(const id of selected)assert.equal(TRANSITION_CATALOG.find(x=>x.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(x=>x.id==='gallery')?.status,'available');
});

test('ASCII glyph mapping is luminance-derived and fades only within overlap',()=>{
    assert.equal(asciiGlyphForLuminance(0),'@');
    assert.equal(asciiGlyphForLuminance(255),' ');
    assert.notEqual(asciiGlyphForLuminance(30),asciiGlyphForLuminance(180));
    assert.equal(asciiGlyphForLuminance(100),asciiGlyphForLuminance(100));
    assert.equal(asciiIntensity(0),0);
    assert.equal(asciiIntensity(1),0);
    assert.equal(asciiIntensity(.5),1);
    assert.ok(asciiIntensity(.25)>0&&asciiIntensity(.25)<1);
    assert.ok(Math.abs(asciiIntensity(.25)-asciiIntensity(.75))<1e-10);
});

test('Historical Color codes Canvas math remains deterministic for older test fixtures (not the live ColorCoords shader)',()=>{
    assert.equal(rgbToColorCode(255,0,0),'#FF0000');
    assert.equal(rgbToColorCode(0,0,255),'#0000FF');
    assert.equal(rgbToColorCode(1,15,160),'#010FA0');
    assert.equal(rgbToColorCode(-5,800,100.7),'#00FF65');
    const strengths=Array.from({length:28},(_,i)=>colorCodeStrength(.5,i));
    assert.ok(new Set(strengths.map(x=>Math.round(x*100))).size>6);
    assert.ok(strengths.every(x=>x>0&&x<=1));
    for(let i=0;i<28;i++){
        assert.equal(colorCodeStrength(0,i),0);
        assert.equal(colorCodeStrength(1,i),0);
        assert.equal(colorCodeStrength(.5,i),strengths[i]);
    }
});

test('Historical Canvas prism offset helper remains deterministic (live 3D GLSL verified separately)',()=>{
    const offsets=Array.from({length:9},(_,i)=>prismFacetOffset(.5,i,196,112));
    assert.ok(new Set(offsets.map(p=>p.x+','+p.y)).size>=8);
    for(let i=0;i<9;i++){
        assert.deepEqual(prismFacetOffset(0,i,196,112),{x:0,y:0});
        assert.deepEqual(prismFacetOffset(1,i,196,112),{x:0,y:0});
        assert.deepEqual(prismFacetOffset(.5,i,196,112),offsets[i]);
        assert.ok(Math.abs(offsets[i].x)<=Math.min(196*.075,48)+1);
        assert.ok(Math.abs(offsets[i].y)<=Math.min(112*.085,40)+1);
    }
});

test('ASCII, ColorCoords and Prisms preserve paired source/audio and Undo/Redo',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:5,order:2,laneId:'A',
        sourceName:'a.mp4',file:{name:'a.mp4'},sourceOffset:.45,audio:{volume:.61}};
    const b={id:'B',type:'video',start:6,clipDuration:4,order:1,laneId:'B',
        sourceName:'b.mp4',file:{name:'b.mp4'},sourceOffset:.55,audio:{volume:.87}};
    for(const effectId of selected){
        const plan=planPairedTransition([a,b],['A','B'],1.5,effectId);
        assert.equal(plan.start,4.5);
        assert.equal(plan.duration,1.5);
        assert.equal(plan.effectId,effectId);
        const incoming={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(incoming,[a,incoming]),true);
        assert.equal(pairedEffectProgress(incoming,5.25),.5);
        const prior=snapshotClip(incoming);
        incoming.transitionEffectId=null;
        applyClipData(incoming,prior);
        assert.equal(incoming.transitionEffectId,effectId);
    }
    assert.equal(a.audio.volume,.61);
    assert.equal(b.audio.volume,.87);
    assert.equal(a.sourceOffset,.45);
    assert.equal(b.sourceOffset,.55);
    assert.equal(b.start,6);
});
