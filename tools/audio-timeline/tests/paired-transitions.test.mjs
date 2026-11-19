import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITION_CATALOG, SELECTED_TRANSITION_NAMES, transitionId } from '../js/transition-catalog.mjs';
import { planPairedFade, isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const clip=(id,start,duration,order=1,laneId='lane-'+id)=>({
    id,type:'video',sourceName:id+'.mp4',file:{name:id+'.mp4'},
    laneId,laneLabel:'Video '+order,order,start,clipDuration:duration,
    sourceOffset:0,sourceDuration:10,
    opacity:1,visible:true,audio:{volume:.8,muted:false,fadeIn:0,fadeOut:0},
    visualTransitions:{
        enter:{type:'fade',duration:0,curve:'linear'},
        exit:{type:'fade',duration:0.5,curve:'linear'}
    }
});
test('the first 41 requested effects stay in user order and are additively extendable',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
    assert.equal(TRANSITION_CATALOG[0].label,'SpiralBlockWipe');
    assert.equal(TRANSITION_CATALOG[18].label,'Brokey dissolve');
    assert.equal(TRANSITION_CATALOG.at(-1).label,'Ripple');
    assert.equal(transitionId('Cell dissolve'),'cell-dissolve');
    assert.deepEqual(TRANSITION_CATALOG.filter(x=>x.status==='available').map(x=>x.label),['Cell dissolve','Vortex','Liquid fill','Heat haze','Rings wipe','Color panel wipe','VHS tracking','Card swipe','Camera shake','Smoke dissolve','Splatter wipe','Bloom dissolve','Light rays','Block cover','Disintegrate','Film strip','Ink bleed','Refraction','Spin','Paper tear','Aperture wipe','Spiral wipe','TV turn off','Cross warp','Cross hatch','Cube','Fade','Glitch flicker','Pixelize','Random squares','Ripple']);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='requested').length,10);
});
test('pair planner creates exact overlap for non-adjacent videos without changing sources/audio',()=>{
    const a=clip('A',2,4,1),b=clip('B',6,3,2);
    const tracks=[a,b];
    const old=structuredClone({a:{...a,file:undefined},b:{...b,file:undefined}});
    const plan=planPairedFade(tracks,['B','A'],1.25);
    assert.equal(plan.fromId,'A');
    assert.equal(plan.toId,'B');
    assert.equal(plan.start,4.75);
    assert.equal(plan.duration,1.25);
    assert.equal(plan.needsNewLane,true);
    assert.ok(plan.incomingOrder<a.order);
    assert.equal(plan.incomingTransitions.enter.duration,1.25);
    assert.equal(plan.outgoingTransitions.exit.duration,0);
    assert.deepEqual({a:{...a,file:undefined},b:{...b,file:undefined}},old,'Planner may not mutate input tracks');
    assert.equal(a.audio.volume,.8);
});
test('pair planner keeps the upper lane when its placement has no other collisions',()=>{
    const a=clip('A',0,5,2),b=clip('B',7,4,1);
    const plan=planPairedFade([a,b],['A','B'],2);
    assert.equal(plan.start,3);
    assert.equal(plan.needsNewLane,false);
    assert.equal(plan.duration,2);
});
test('collision with another clip on B lane requires its own upper lane',()=>{
    const a=clip('A',0,5,2,'lower'),b=clip('B',7,4,1,'upper');
    const unrelated=clip('C',1,3,1,'upper');
    assert.equal(planPairedFade([a,b,unrelated],['A','B'],2).needsNewLane,true);
});
test('pair planner refuses invalid selection and clamps to safe available media',()=>{
    const a=clip('A',0,2,1),b=clip('B',2,3,2);
    assert.throws(()=>planPairedFade([a,b],['A'],1),/exactly two/);
    assert.throws(()=>planPairedFade([a,b],['A','A'],1),/different/);
    assert.throws(()=>planPairedFade([a,{...b,file:null}],['A','B'],1),/loaded video/);
    assert.throws(()=>planPairedFade([a,b],['A','B'],0),/greater than zero/);
    assert.equal(planPairedFade([a,b],['A','B'],5).duration,2);
    assert.throws(()=>planPairedFade([a,{...b,clipDuration:.02}],['A','B'],1),/at least 0.1/);
});
test('pair link metadata is valid only while media exists and overlap is intact',()=>{
    const a=clip('A',2,4,1),b=clip('B',5,3,.5);
    b.transitionFromId='A'; b.transitionEffectId='fade';
    b.visualTransitions.enter.duration=1;
    assert.equal(isPairedFadeActive(b,[a,b]),true);
    assert.equal(isPairedFadeActive({...b,start:6},[a,b]),false);
    assert.equal(isPairedFadeActive(b,[b]),false);
    assert.equal(isPairedFadeActive({...b,order:2},[a,b]),false);
    assert.equal(isPairedFadeActive({...b,transitionEffectId:'glitch'},[a,b]),false);
});
test('undo/redo snapshot copies pair IDs and restores unlinked histories',()=>{
    const a=clip('A',0,4,1),b=clip('B',3,4,.5);
    b.transitionFromId='A';b.transitionEffectId='fade';
    const paired=snapshotClip(b);
    b.transitionFromId=null;b.transitionEffectId=null;
    applyClipData(b,paired);
    assert.equal(b.transitionFromId,'A');
    assert.equal(b.transitionEffectId,'fade');
    applyClipData(b,snapshotClip({...b,transitionFromId:null,transitionEffectId:null}));
    assert.equal(b.transitionFromId,null);
    assert.equal(b.transitionEffectId,null);
    applyClipData(b,{...paired,transitionFromId:undefined,transitionEffectId:undefined});
    assert.equal(b.transitionFromId,null);
});
