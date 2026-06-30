(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {$,clamp}=E,encoder=new TextEncoder();
  const four=(text)=>encoder.encode(text),u16=(n)=>new Uint8Array([n&255,(n>>>8)&255]),u24=(n)=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255]),u32=(n)=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const join=(parts)=>{const len=parts.reduce((n,item)=>n+item.length,0),out=new Uint8Array(len);let at=0;parts.forEach((item)=>{out.set(item,at);at+=item.length;});return out;};
  const chunk=(name,payload)=>join([four(name),u32(payload.length),payload,payload.length%2?new Uint8Array([0]):new Uint8Array()]);
  const fourAt=(bytes,at)=>String.fromCharCode(bytes[at],bytes[at+1],bytes[at+2],bytes[at+3]);
  const uintAt=(bytes,at)=>(bytes[at]|(bytes[at+1]<<8)|(bytes[at+2]<<16)|(bytes[at+3]<<24))>>>0;
  const payload=async(canvas)=>{const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/webp',.9));if(!blob||blob.type!=='image/webp')throw new Error('This browser cannot encode WebP.');const bytes=new Uint8Array(await blob.arrayBuffer());if(fourAt(bytes,0)!=='RIFF'||fourAt(bytes,8)!=='WEBP')throw new Error('Invalid WebP frame data.');const pieces=[];let at=12;while(at+8<=bytes.length){const name=fourAt(bytes,at),size=uintAt(bytes,at+4),end=at+8+size;pieces.push({name,raw:bytes.slice(at,end+size%2)});at=end+size%2;}const image=pieces.filter((part)=>['ALPH','VP8 ','VP8L'].includes(part.name));return{bytes:join(image.map((part)=>part.raw)),alpha:image.some((part)=>part.name==='ALPH'||part.name==='VP8L')};};
  const animated=async(frames,delay)=>{const width=frames[0].width,height=frames[0].height,parts=[];let alpha=false;for(const frame of frames){const part=await payload(frame);parts.push(part);alpha||=part.alpha;}const header=new Uint8Array(10);header[0]=0x02|(alpha?0x10:0);header.set(u24(width-1),4);header.set(u24(height-1),7);const anim=join([new Uint8Array([0,0,0,0]),u16(0)]);const chunks=parts.map((part)=>chunk('ANMF',join([u24(0),u24(0),u24(width-1),u24(height-1),u24(clamp(delay,11,0xFFFFFF)),new Uint8Array([0x02]),part.bytes])));const body=join([four('WEBP'),chunk('VP8X',header),chunk('ANIM',anim),...chunks]);return new Blob([join([four('RIFF'),u32(body.length),body])],{type:'image/webp'});};
  E.exportWebp=async()=>{const frames=await E.outputFrames();if(!frames.length)return E.status('Import frames before exporting.');try{E.status('Building animated WebP...');E.saveBlob(await animated(frames,E.frameDelay(frames.length)),`${E.exportName()}.webp`);E.status('Animated WebP saved.');}catch(error){E.status(`WebP export error: ${error.message}`);}};
  $('ag-export').addEventListener('click',()=>{$('ag-format').value==='webp'?E.exportWebp():E.exportGif();});
})();