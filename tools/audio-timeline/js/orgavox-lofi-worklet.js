/**
 * Real-time/offline Orgavox Lo-Fi processor.
 * Runs on the AudioWorklet rendering thread in both AudioContext and
 * OfflineAudioContext; no editor DOM or Orgavox global state is referenced.
 */
import { createOrgavoxLofiState, processOrgavoxLofiBlock } from './orgavox-lofi-dsp.mjs';

class OrganonOrgavoxLofiProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);
        this.settings=options.processorOptions?.settings || {preset:'subtle'};
        this.channels=[];
    }
    process(inputs,outputs) {
        const input=inputs[0] || [];
        const output=outputs[0] || [];
        for(let channel=0;channel<output.length;channel++) {
            if(!this.channels[channel])
                this.channels[channel]=createOrgavoxLofiState(this.settings,sampleRate,channel);
            processOrgavoxLofiBlock(input[channel] || input[0],output[channel],this.channels[channel]);
        }
        return true;
    }
}
registerProcessor('organon-orgavox-lofi-20261120',OrganonOrgavoxLofiProcessor);
