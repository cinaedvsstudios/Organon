import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ORGAVOX_FX_PRESETS, normalizeOrgavoxFx,
    connectOrgavoxAudioChain, makeOrgavoxDriveCurve
} from '../js/orgavox-audio-chain.mjs';
import { snapshotClip, applyClipData } from '../js/project-history.mjs';

class FakeNode {
    constructor(type) {
        this.type=type; this.connections=[]; this.disconnected=false;
        for(const name of ['gain','frequency','Q','pan','threshold','ratio','knee','attack','release'])
            this[name]={value:0};
    }
    connect(to,output=0,input=0){this.connections.push({to,output,input});return to;}
    disconnect(){this.disconnected=true;this.connections=[];}
}
class FakeContext {
    constructor(){this.sampleRate=48000;this.nodes=[];}
    make(type){const node=new FakeNode(type);this.nodes.push(node);return node;}
    createGain(){return this.make('gain');}
    createBiquadFilter(){return this.make('biquad');}
    createWaveShaper(){return this.make('waveshaper');}
    createDynamicsCompressor(){return this.make('compressor');}
    createChannelSplitter(){return this.make('splitter');}
    createChannelMerger(){return this.make('merger');}
    createStereoPanner(){return this.make('panner');}
}
const build=(settings,source=null)=>{
    const ctx=new FakeContext(),destination=ctx.createGain();
    const src=source?ctx.createGain():null;
    const graph=connectOrgavoxAudioChain(ctx,destination,settings,src);
    return {ctx,graph,destination,src};
};

test('unknown presets fail safely to Off without turning on DSP',()=>{
    assert.deepEqual(normalizeOrgavoxFx({eq:'nonexistent',drive:'warm'}),
        {eq:'off',drive:'warm',dynamics:'off',stereo:'off'});
    const {graph,ctx,src}=build({},true);
    assert.equal(graph.nodes.length,1);
    assert.ok(src.connections.some(c=>c.to===graph.input));
    assert.ok(graph.input.connections.some(c=>c.to===ctx.nodes[0]));
});

test('Orgavox Voice Clear EQ uses the source high-pass, shelves and presence peak',()=>{
    const {ctx,graph}=build({eq:'voice'});
    const filters=ctx.nodes.filter(n=>n.type==='highpass'||n.type==='lowshelf'||n.type==='peaking'||n.type==='highshelf'||n.type==='lowpass');
    assert.deepEqual(filters.map(n=>n.type),['highpass','lowshelf','peaking','highshelf','lowpass']);
    assert.equal(filters[0].frequency.value,90);
    assert.equal(filters[2].frequency.value,2200);
    assert.equal(filters[2].gain.value,3);
    assert.equal(graph.settings.eq,'voice');
});

test('Orgavox Tape Drive produces original 2048-point asymmetrical waveshaping',()=>{
    const curve=makeOrgavoxDriveCurve(38,26);
    assert.equal(curve.length,2048);
    assert.ok(curve.every(Number.isFinite));
    assert.ok(curve[0]<0 && curve.at(-1)>0);
    const {ctx}=build({drive:'tape'});
    const shaper=ctx.nodes.find(node=>node.type==='waveshaper');
    assert.ok(shaper,'Tape Drive must build a real WaveShaperNode');
    assert.equal(shaper.oversample,'2x');
    assert.equal(shaper.curve.length,2048);
    assert.ok(ctx.nodes.filter(n=>n.type==='gain').length>=5,'Dry/wet mix should use separate gains');
});

test('Orgavox Peak Limiter compressor matches its actual preset parameters',()=>{
    const {ctx}=build({dynamics:'limiter'});
    const compressor=ctx.nodes.find(node=>node.type==='compressor');
    assert.ok(compressor);
    assert.equal(compressor.threshold.value,-8);
    assert.equal(compressor.ratio.value,18);
    assert.equal(compressor.attack.value,.002);
    assert.equal(compressor.release.value,.15);
});

test('Orgavox Stereo Width uses channel matrix and pan with correct coefficients',()=>{
    const {ctx}=build({stereo:'wide'});
    assert.equal(ctx.nodes.filter(n=>n.type==='splitter').length,1);
    assert.equal(ctx.nodes.filter(n=>n.type==='merger').length,1);
    const pan=ctx.nodes.find(n=>n.type==='panner');
    assert.ok(pan);
    assert.equal(pan.pan.value,0);
    assert.ok(ctx.nodes.some(n=>n.type==='gain' && Math.abs(n.gain.value-1.3)<1e-10));
    assert.ok(ctx.nodes.some(n=>n.type==='gain' && Math.abs(n.gain.value+.3)<1e-10));
});

test('all four Orgavox effects can be chained and nodes independently disconnected',()=>{
    const {ctx,graph}=build({eq:'bright',drive:'tube',dynamics:'leveler',stereo:'mono'},true);
    assert.ok(graph.nodes.length>16);
    assert.ok(ctx.nodes.some(n=>n.type==='compressor'));
    assert.ok(ctx.nodes.some(n=>n.type==='waveshaper'));
    assert.ok(ctx.nodes.some(n=>n.type==='merger'));
    for(const node of graph.nodes)node.disconnect();
    assert.ok(graph.nodes.every(n=>n.disconnected));
});

test('Orgavox effect choices are copied through clip undo/redo without aliasing',()=>{
    const track={id:'a',type:'audio',start:0,clipDuration:2,
        audio:{volume:.8,muted:false,fx:{eq:'voice',drive:'off',dynamics:'glue',stereo:'wide'}}};
    const saved=snapshotClip(track);
    track.audio.fx={...track.audio.fx,eq:'phone'};
    assert.equal(saved.audio.fx.eq,'voice');
    applyClipData(track,saved);
    assert.equal(track.audio.fx.eq,'voice');
    track.audio.fx.eq='bright';
    assert.equal(saved.audio.fx.eq,'voice');
});

test('Orgavox preset names are sourced from the four existing Orgavox processing modules',()=>{
    assert.equal(ORGAVOX_FX_PRESETS.eq.phone.label,'Phone / Radio');
    assert.equal(ORGAVOX_FX_PRESETS.drive.tape.label,'Tape Crunch');
    assert.equal(ORGAVOX_FX_PRESETS.dynamics.leveler.label,'Voice Leveler');
    assert.equal(ORGAVOX_FX_PRESETS.stereo.wide.label,'Wide stereo');
});
