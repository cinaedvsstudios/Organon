import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ORGAVOX_LOFI_PRESETS,normalizeOrgavoxLofiSettings,
    quantizeOrgavoxSample,createOrgavoxLofiState,processOrgavoxLofiBlock
} from '../js/orgavox-lofi-dsp.mjs';

const tone=(count,rate=48000,frequency=441)=>Float32Array.from({length:count},(_,i)=>Math.sin(2*Math.PI*frequency*i/rate)*.6);
const render=(source,settings,chunkSize=source.length)=>{
    const state=createOrgavoxLofiState(settings,48000),out=new Float32Array(source.length);
    for(let start=0;start<source.length;start+=chunkSize){
        const end=Math.min(source.length,start+chunkSize);
        processOrgavoxLofiBlock(source.subarray(start,end),out.subarray(start,end),state);
    }
    return out;
};
test('Lo-Fi presets copy the real Orgavox editor settings',()=>{
    assert.equal(ORGAVOX_LOFI_PRESETS.eightbit.bitDepth,8);
    assert.equal(ORGAVOX_LOFI_PRESETS.eightbit.sampleRate,8000);
    assert.equal(ORGAVOX_LOFI_PRESETS.cassette.wobble,16);
    assert.equal(ORGAVOX_LOFI_PRESETS.broken.bitDepth,5);
    assert.equal(normalizeOrgavoxLofiSettings({preset:'off'}),null);
    assert.equal(normalizeOrgavoxLofiSettings({preset:'broken'}).crushMix,100);
});
test('all crushed audio remains finite and within [-1,1]',()=>{
    const source=tone(4800);
    for(const preset of ['subtle','sampler','eightbit','cassette','broken']){
        const out=render(source,{preset});
        assert.equal(out.length,source.length);
        assert.ok(out.every(value=>Number.isFinite(value)&&value<=1&&value>=-1),preset);
    }
});
test('Worklet processing is exactly deterministic across 128-sample render quanta',()=>{
    const source=tone(5000);
    for(const preset of ['subtle','eightbit','cassette','broken']){
        const full=render(source,{preset});
        const streamed=render(source,{preset},128);
        assert.deepEqual(Array.from(streamed),Array.from(full),
            'Block boundaries must not alter Lo-Fi sound or offline exports for '+preset);
    }
});
test('Lo-Fi really changes samples rather than providing a decorative selector',()=>{
    const source=tone(8192);
    const clean=source;
    const crushed=render(source,{preset:'eightbit'});
    let changes=0;
    for(let i=0;i<source.length;i++)if(Math.abs(clean[i]-crushed[i])>.015)changes++;
    assert.ok(changes>source.length*.5,'8-bit 8 kHz crush should audibly differ from clean');
});
test('Lower Orgavox bit depth creates coarser sample steps',()=>{
    assert.ok(Math.abs(quantizeOrgavoxSample(.52,5)-.52) >
        Math.abs(quantizeOrgavoxSample(.52,12)-.52));
});
test('Cassette wobble and noise change output without nondeterministic randomness',()=>{
    const source=tone(3500);
    const cassette=render(source,{preset:'cassette'});
    const cleanWobble=render(source,{preset:'cassette',wobble:0,noise:0});
    assert.ok(cassette.some((v,i)=>Math.abs(v-cleanWobble[i])>.002));
    assert.deepEqual(Array.from(cassette),Array.from(render(source,{preset:'cassette'})));
});
