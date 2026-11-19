/**
 * MotoriClip adapter for Orgavox audio processing.
 *
 * Preset values and Web Audio graphs are carried across from:
 *   tools/simple-edit/simple-edit-eq[/-engine].js
 *   tools/simple-edit/simple-edit-drive[/-engine].js
 *   tools/simple-edit/simple-edit-dynamics[/-engine].js
 *   tools/simple-edit/simple-edit-stereo[/-engine].js
 *
 * The originals wrap Orgavox globals such as connectClipNodes, so they cannot
 * safely execute inside MotoriClip. This DOM-free adapter shares their DSP
 * parameterization, not their application-specific globals or modal UI.
 * Lo-Fi processing uses a shared AudioWorklet with sample-hold, bitcrushing,
 * high-cut, hiss and wow, allowing identical real-time and offline rendering.
 */
import { ORGAVOX_LOFI_PRESETS } from './orgavox-lofi-dsp.mjs';

export const ORGAVOX_FX_PRESETS = Object.freeze({
    lofi:ORGAVOX_LOFI_PRESETS,
    eq: Object.freeze({
        off:null,
        voice:{label:'Voice Clear',lowCut:90,lowGain:-2,midFreq:2200,midGain:3,highGain:2,highCut:12000,outputGain:100},
        warm:{label:'Warm Bass',lowCut:35,lowGain:4,midFreq:650,midGain:-1,highGain:-2,highCut:9000,outputGain:96},
        bright:{label:'Brighten',lowCut:60,lowGain:-1,midFreq:1800,midGain:2,highGain:5,highCut:16000,outputGain:98},
        phone:{label:'Phone / Radio',lowCut:320,lowGain:-8,midFreq:1400,midGain:4,highGain:-6,highCut:3600,outputGain:105},
        muffled:{label:'Muffled',lowCut:35,lowGain:2,midFreq:500,midGain:2,highGain:-8,highCut:2600,outputGain:105}
    }),
    drive:Object.freeze({
        off:null,
        warm:{label:'Warm Saturation',drive:24,tone:58,mix:42,asymmetry:10,outputGain:100},
        tube:{label:'Tube Drive',drive:42,tone:62,mix:55,asymmetry:18,outputGain:96},
        tape:{label:'Tape Crunch',drive:38,tone:42,mix:58,asymmetry:26,outputGain:98},
        fuzz:{label:'Fuzz',drive:76,tone:68,mix:72,asymmetry:36,outputGain:86},
        speaker:{label:'Broken Speaker',drive:82,tone:34,mix:82,asymmetry:55,outputGain:88},
        softclip:{label:'Soft Clip Limiter',drive:18,tone:72,mix:34,asymmetry:0,outputGain:104}
    }),
    dynamics:Object.freeze({
        off:null,
        leveler:{label:'Voice Leveler',threshold:-26,ratio:3,knee:18,attack:10,release:260,mix:100,makeupGain:112,outputGain:100},
        glue:{label:'Gentle Glue',threshold:-20,ratio:2,knee:22,attack:28,release:320,mix:82,makeupGain:104,outputGain:100},
        limiter:{label:'Peak Limiter',threshold:-8,ratio:18,knee:4,attack:2,release:150,mix:100,makeupGain:100,outputGain:96},
        broadcast:{label:'Broadcast Tight',threshold:-30,ratio:5,knee:10,attack:5,release:210,mix:100,makeupGain:118,outputGain:96},
        pump:{label:'Pumping Effect',threshold:-34,ratio:9,knee:2,attack:3,release:620,mix:92,makeupGain:118,outputGain:92},
        soft:{label:'Soft Control',threshold:-18,ratio:1.7,knee:30,attack:45,release:420,mix:70,makeupGain:102,outputGain:100}
    }),
    stereo:Object.freeze({
        off:null,
        center:{label:'Centered',pan:0,width:100,mono:false,outputGain:100},
        left:{label:'Left side',pan:-55,width:100,mono:false,outputGain:100},
        right:{label:'Right side',pan:55,width:100,mono:false,outputGain:100},
        wide:{label:'Wide stereo',pan:0,width:160,mono:false,outputGain:96},
        narrow:{label:'Narrow focus',pan:0,width:45,mono:false,outputGain:100},
        mono:{label:'Mono center',pan:0,width:0,mono:true,outputGain:100}
    })
});

export function normalizeOrgavoxFx(value) {
    const normalized = {};
    for (const [kind, presets] of Object.entries(ORGAVOX_FX_PRESETS)) {
        const selected = typeof value?.[kind] === 'string' ? value[kind] : 'off';
        normalized[kind] = Object.hasOwn(presets,selected) ? selected : 'off';
    }
    return normalized;
}

const workletRegistrations=new WeakMap();
/** Register only on contexts using an actual Lo-Fi preset. */
export async function ensureOrgavoxLofiWorklet(context,rawSettings) {
    const settings=normalizeOrgavoxFx(rawSettings);
    if(settings.lofi==='off')return false;
    if(!context?.audioWorklet?.addModule || typeof AudioWorkletNode==='undefined')
        throw new Error('Orgavox Lo-Fi requires browser AudioWorklet support. Use a recent Chrome or Firefox.');
    let promise=workletRegistrations.get(context);
    if(!promise){
        const url=new URL('./orgavox-lofi-worklet.js',import.meta.url);
        promise=context.audioWorklet.addModule(url.href);
        workletRegistrations.set(context,promise);
    }
    try { await promise; } catch(error) {
        workletRegistrations.delete(context);
        throw new Error('Cannot load Orgavox Lo-Fi worklet: '+(error?.message||error));
    }
    return true;
}

export function makeOrgavoxDriveCurve(drive,asymmetry) {
    const samples=2048,curve=new Float32Array(samples);
    const amount=1+(drive/100)*34;
    const skew=(asymmetry/100)*.55;
    const gainComp=1/(1+drive/115);
    for(let i=0;i<samples;i++) {
        const x=i*2/(samples-1)-1;
        const biased=x+skew*(1-Math.abs(x));
        curve[i]=Math.max(-1,Math.min(1,Math.tanh(biased*amount)/Math.tanh(amount)))*gainComp;
    }
    return curve;
}

/**
 * Build a clip-local graph. The returned input can accept one or more
 * HTMLMediaElement/AudioBufferSource nodes. Only returned nodes should be
 * disconnected during a live preset change; the clip's output gain node stays
 * connected to the preview and any real-time export mix.
 */
export function connectOrgavoxAudioChain(context,destination,rawSettings,source=null) {
    const settings=normalizeOrgavoxFx(rawSettings);
    const nodes=[];
    const add=node=>{nodes.push(node);return node;};
    const gain=value=>{const node=add(context.createGain());node.gain.value=value;return node;};
    const filter=(type,frequency,Q=.707,db=0)=>{
        const node=add(context.createBiquadFilter());
        node.type=type;
        node.frequency.value=Math.max(20,Math.min(context.sampleRate/2-100,frequency));
        node.Q.value=Q;
        node.gain.value=db;
        return node;
    };
    const input=gain(1);
    if(source)source.connect(input);
    let tail=input;
    const append=node=>{tail.connect(node);tail=node;};
    const eq=ORGAVOX_FX_PRESETS.eq[settings.eq];
    if(eq) {
        if(eq.lowCut>25)append(filter('highpass',eq.lowCut));
        if(Math.abs(eq.lowGain)>.05)append(filter('lowshelf',120,.707,eq.lowGain));
        if(Math.abs(eq.midGain)>.05)append(filter('peaking',eq.midFreq,1.1,eq.midGain));
        if(Math.abs(eq.highGain)>.05)append(filter('highshelf',6200,.707,eq.highGain));
        if(eq.highCut<19900)append(filter('lowpass',eq.highCut));
        append(gain(eq.outputGain/100));
    }
    const drive=ORGAVOX_FX_PRESETS.drive[settings.drive];
    if(drive) {
        const output=gain(drive.outputGain/100),dry=gain(1-drive.mix/100),wet=gain(drive.mix/100);
        tail.connect(dry);dry.connect(output);
        const pregain=gain(1+drive.drive/55);
        const shaper=add(context.createWaveShaper());
        shaper.curve=makeOrgavoxDriveCurve(drive.drive,drive.asymmetry);
        shaper.oversample=drive.drive>65?'4x':'2x';
        const highpass=filter('highpass',25+(100-drive.tone)*.85,.65);
        const lowpass=filter('lowpass',1600+drive.tone*145,.72);
        tail.connect(pregain);pregain.connect(shaper);
        shaper.connect(highpass);highpass.connect(lowpass);
        lowpass.connect(wet);wet.connect(output);
        tail=output;
    }
    const dynamics=ORGAVOX_FX_PRESETS.dynamics[settings.dynamics];
    if(dynamics) {
        const output=gain(dynamics.outputGain/100);
        const dry=gain(1-dynamics.mix/100);
        tail.connect(dry);dry.connect(output);
        const compressor=add(context.createDynamicsCompressor());
        compressor.threshold.value=dynamics.threshold;
        compressor.ratio.value=dynamics.ratio;
        compressor.knee.value=dynamics.knee;
        compressor.attack.value=dynamics.attack/1000;
        compressor.release.value=dynamics.release/1000;
        const makeup=gain(dynamics.makeupGain/100);
        const wet=gain(dynamics.mix/100);
        tail.connect(compressor);compressor.connect(makeup);
        makeup.connect(wet);wet.connect(output);
        tail=output;
    }
    if(settings.lofi!=='off'){
        if(typeof AudioWorkletNode==='undefined')
            throw Error('AudioWorkletNode unavailable for Orgavox Lo-Fi');
        const crusher=add(new AudioWorkletNode(context,'organon-orgavox-lofi-20261120',{
            numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],
            processorOptions:{settings:{preset:settings.lofi,enabled:true}}
        }));
        append(crusher);
    }
    const stereo=ORGAVOX_FX_PRESETS.stereo[settings.stereo];
    if(stereo) {
        const width=stereo.mono?0:stereo.width/100;
        const splitter=add(context.createChannelSplitter(2));
        const merger=add(context.createChannelMerger(2));
        const lToL=gain((1+width)/2),rToL=gain((1-width)/2);
        const lToR=gain((1-width)/2),rToR=gain((1+width)/2);
        tail.connect(splitter);
        splitter.connect(lToL,0);splitter.connect(lToR,0);
        splitter.connect(rToL,1);splitter.connect(rToR,1);
        lToL.connect(merger,0,0);rToL.connect(merger,0,0);
        lToR.connect(merger,0,1);rToR.connect(merger,0,1);
        tail=merger;
        if(typeof context.createStereoPanner==='function') {
            const pan=add(context.createStereoPanner());
            pan.pan.value=stereo.pan/100;
            append(pan);
        }
        append(gain(stereo.outputGain/100));
    }
    tail.connect(destination);
    return {input,nodes,settings};
}
