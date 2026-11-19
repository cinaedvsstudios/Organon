/**
 * Stateful Orgavox Lo-Fi / Crush sample processing for audio worklets.
 *
 * Parameters and the sample-and-hold/quantize/high-cut mix originate in
 * tools/simple-edit/simple-edit-lofi[-engine].js. A bounded delay-history
 * replaces the offline-only look-ahead wobble so the same DSP operates
 * causally during real-time playback and OfflineAudioContext rendering.
 * Hiss uses a deterministic PRNG for repeatable fixed-frame exports.
 */
export const ORGAVOX_LOFI_PRESETS = Object.freeze({
    off:null,
    subtle:{label:'Subtle grit',bitDepth:12,sampleRate:22050,crushMix:35,noise:2,wobble:2,highCut:14000,outputGain:100},
    sampler:{label:'Old sampler',bitDepth:10,sampleRate:12000,crushMix:70,noise:4,wobble:3,highCut:7200,outputGain:98},
    eightbit:{label:'8-bit crush',bitDepth:8,sampleRate:8000,crushMix:88,noise:3,wobble:0,highCut:5600,outputGain:96},
    cassette:{label:'Cassette haze',bitDepth:13,sampleRate:18000,crushMix:55,noise:10,wobble:16,highCut:5200,outputGain:96},
    broken:{label:'Broken robot',bitDepth:5,sampleRate:3000,crushMix:100,noise:7,wobble:7,highCut:2600,outputGain:92},
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
export function normalizeOrgavoxLofiSettings(raw) {
    if(!raw || raw.enabled===false)return null;
    const preset=ORGAVOX_LOFI_PRESETS[raw.preset||'subtle'];
    if(!preset)return null;
    return {
        bitDepth:clamp(raw.bitDepth??preset.bitDepth,3,16),
        sampleRate:clamp(raw.sampleRate??preset.sampleRate,800,44100),
        crushMix:clamp(raw.crushMix??preset.crushMix,0,100),
        noise:clamp(raw.noise??preset.noise,0,40),
        wobble:clamp(raw.wobble??preset.wobble,0,40),
        highCut:clamp(raw.highCut??preset.highCut,800,20000),
        outputGain:clamp(raw.outputGain??preset.outputGain,0,150)
    };
}
export function quantizeOrgavoxSample(value,bitDepth) {
    const levels=Math.max(3,2**Math.round(bitDepth)-1);
    return Math.round(((clamp(value,-1,1)+1)/2)*levels)/levels*2-1;
}
export function createOrgavoxLofiState(settings,sampleRate=48000,channel=0) {
    const normalized=normalizeOrgavoxLofiSettings(settings);
    if(!normalized)throw Error('Choose an active Orgavox Lo-Fi preset');
    const rate=Math.max(8000,Number(sampleRate)||48000);
    const wobbleSamples=Math.round((normalized.wobble/100)*rate*.006);
    const cutoff=clamp(normalized.highCut,800,Math.max(801,rate/2-100));
    const rc=1/(2*Math.PI*cutoff);
    const dt=1/rate;
    return {
        settings:normalized,
        sampleRate:rate,
        step:Math.max(1,Math.round(rate/normalized.sampleRate)),
        wobbleSamples,
        alpha:dt/(rc+dt),
        history:new Float32Array(Math.max(512,wobbleSamples*4+16)),
        held:0,filtered:0,index:0,
        noiseSeed:((0x6d2b79f5+channel*0x9e3779b1)>>>0)
    };
}
/** Fill a target Float32Array, continuing smoothly across 128-frame worklet blocks. */
export function processOrgavoxLofiBlock(input,output,state) {
    if(!state?.settings)throw Error('Lo-Fi state not initialized');
    const cfg=state.settings,wet=cfg.crushMix/100;
    const noiseAmount=cfg.noise/100,outputGain=cfg.outputGain/100;
    const ring=state.history,limit=ring.length,rate=state.sampleRate;
    for(let i=0;i<output.length;i++) {
        const dry=Number(input?.[i])||0;
        const n=state.index++;
        ring[n%limit]=dry;
        if(n%state.step===0){
            let sample=dry;
            if(state.wobbleSamples){
                const phase=Math.sin(n/rate*Math.PI*2*1.15);
                const position=n-state.wobbleSamples+phase*state.wobbleSamples;
                const left=Math.floor(position),right=left+1;
                const take=at=>at>=0&&n-at<limit ? ring[at%limit] : 0;
                const fraction=position-left;
                sample=take(left)*(1-fraction)+take(right)*fraction;
            }
            state.noiseSeed=(Math.imul(state.noiseSeed,1664525)+1013904223)>>>0;
            const noise=((state.noiseSeed/0x100000000)*2-1)*noiseAmount*.22;
            state.held=quantizeOrgavoxSample(sample+noise,cfg.bitDepth);
        }
        state.filtered+=state.alpha*(state.held-state.filtered);
        const crushed=cfg.highCut<19800?state.filtered:state.held;
        output[i]=clamp((dry*(1-wet)+crushed*wet)*outputGain,-1,1);
    }
    return output;
}
