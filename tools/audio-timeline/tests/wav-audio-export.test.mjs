import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePcm16Wav } from '../js/wav-audio-export.mjs';

function fakeAudio(channels,rate=48000) {
    return {
        numberOfChannels:channels.length,length:channels[0]?.length ?? 0,
        sampleRate:rate,getChannelData(index){return channels[index];}
    };
}
function header(result){
    const view=new DataView(result);
    const ascii=(offset,length)=>Array.from(new Uint8Array(result,offset,length),v=>String.fromCharCode(v)).join('');
    return {
        riff:ascii(0,4),wave:ascii(8,4),fmt:ascii(12,4),data:ascii(36,4),
        riffLength:view.getUint32(4,true),format:view.getUint16(20,true),
        channels:view.getUint16(22,true),rate:view.getUint32(24,true),
        byteRate:view.getUint32(28,true),blockAlign:view.getUint16(32,true),
        bitsPerSample:view.getUint16(34,true),dataLength:view.getUint32(40,true),
        view
    };
}
test('Stereo 48 kHz uncompressed WAV has exact RIFF/WAVE PCM header',()=>{
    const left=new Float32Array(48000),right=new Float32Array(48000);
    const wav=encodePcm16Wav(fakeAudio([left,right]));
    const h=header(wav);
    assert.deepEqual([h.riff,h.wave,h.fmt,h.data],['RIFF','WAVE','fmt ','data']);
    assert.equal(h.format,1);
    assert.equal(h.channels,2);
    assert.equal(h.rate,48000);
    assert.equal(h.byteRate,192000);
    assert.equal(h.blockAlign,4);
    assert.equal(h.bitsPerSample,16);
    assert.equal(h.dataLength,48000*2*2);
    assert.equal(wav.byteLength,44+192000);
    assert.equal(h.riffLength,wav.byteLength-8);
});
test('PCM samples interleave channels correctly with signed clipping',()=>{
    const wav=encodePcm16Wav(fakeAudio([
        Float32Array.from([1,-1,.5,-.5]),
        Float32Array.from([0,.25,-.25,1.5])
    ]));
    const view=new DataView(wav);
    assert.deepEqual(Array.from({length:8},(_,i)=>view.getInt16(44+i*2,true)),
        [32767,0,-32768,8192,16384,-8192,-16384,32767]);
});
test('Mono WAV stays mono, preserves silence and supports sample rates',()=>{
    const wav=encodePcm16Wav(fakeAudio([Float32Array.from([0,0,0])],44100));
    const h=header(wav);
    assert.equal(h.channels,1);
    assert.equal(h.rate,44100);
    assert.equal(h.byteRate,88200);
    assert.equal(h.dataLength,6);
    assert.equal(h.view.getInt16(44,true),0);
});
test('Unsupported malformed audio inputs are rejected',()=>{
    assert.throws(()=>encodePcm16Wav(null),/AudioBuffer/);
    assert.throws(()=>encodePcm16Wav(fakeAudio([])),/AudioBuffer/);
    assert.throws(()=>encodePcm16Wav(fakeAudio([new Float32Array(10)],4000)),/AudioBuffer/);
    assert.throws(()=>encodePcm16Wav(fakeAudio([new Float32Array(3),new Float32Array(4)])),/lengths/);
});
