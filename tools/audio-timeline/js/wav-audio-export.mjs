/**
 * Pure 16-bit PCM RIFF/WAVE encoder, shared by audio-only clip downloads.
 * The input is the AudioBuffer returned by MotoriClip's offline audio mix,
 * so EQ, Lo-Fi, fades, gain, speed and source trim are already rendered.
 */
export function encodePcm16Wav(buffer) {
    const channels=Number(buffer?.numberOfChannels);
    const frameCount=Number(buffer?.length);
    const sampleRate=Number(buffer?.sampleRate);
    if(!Number.isInteger(channels) || channels<1 || channels>2
        || !Number.isInteger(frameCount) || frameCount<=0
        || !Number.isInteger(sampleRate) || sampleRate<8000 || sampleRate>192000
        || typeof buffer.getChannelData!=='function')
        throw new Error('Expected a mono or stereo AudioBuffer with a valid sample rate and duration.');
    const channelData=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));
    if(channelData.some(samples=>samples?.length!==frameCount))
        throw new Error('Audio channel lengths do not match the export duration.');
    const dataLength=frameCount*channels*2;
    const riffLength=36+dataLength;
    if(riffLength>0xffffffff)throw new Error('WAV output exceeds RIFF 32-bit size limits.');
    const result=new ArrayBuffer(44+dataLength);
    const view=new DataView(result);
    const writeFourCC=(offset,string)=>{
        for(let index=0;index<4;index++)view.setUint8(offset+index,string.charCodeAt(index));
    };
    writeFourCC(0,'RIFF');
    view.setUint32(4,riffLength,true);
    writeFourCC(8,'WAVE');
    writeFourCC(12,'fmt ');
    view.setUint32(16,16,true);        // PCM format header length
    view.setUint16(20,1,true);         // uncompressed signed PCM
    view.setUint16(22,channels,true);
    view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate*channels*2,true);
    view.setUint16(32,channels*2,true);
    view.setUint16(34,16,true);
    writeFourCC(36,'data');
    view.setUint32(40,dataLength,true);
    let offset=44;
    for(let index=0;index<frameCount;index++){
        for(let channel=0;channel<channels;channel++){
            const raw=channelData[channel][index];
            const sample=Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;
            const pcm=sample<0?Math.round(sample*32768):Math.round(sample*32767);
            view.setInt16(offset,pcm,true);
            offset+=2;
        }
    }
    return result;
}
