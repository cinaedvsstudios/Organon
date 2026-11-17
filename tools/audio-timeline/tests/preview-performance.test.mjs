import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvancedMediaEngine } from '../js/advanced-media-engine-v0.24.js';

function setup() {
    const originalDocument=globalThis.document;
    const counters={getImageData:0,putImageData:0,draw:0,canvasCreated:0};
    const graphics=()=>({
        globalAlpha:1,globalCompositeOperation:'source-over',
        save(){},restore(){},clearRect(){},fillRect(){},
        drawImage(){counters.draw++},
        getImageData(){counters.getImageData++;return {data:new Uint8ClampedArray(4*16)}},
        putImageData(){counters.putImageData++}
    });
    globalThis.document={createElement(type){if(type!=='canvas')throw Error(type);counters.canvasCreated++;return {width:4,height:4,getContext:graphics}}};
    const engine=new AdvancedMediaEngine({
        canvas:{width:100,height:100,getContext:graphics},mediaBin:{},
        onTimeChange(){},onDurationChange(){},onPlaybackChange(){},onRenderError(e){throw e}
    });
    const sticker=(id,{name='logo.png',mode='chroma'}={})=>({
        id,type:'sticker',start:0,clipDuration:10,sourceName:name,
        sourceFileId:id,order:1,visible:true,opacity:1,blendMode:'source-over',
        media:{naturalWidth:4,naturalHeight:4},fileType:name.endsWith('.gif')?'image/gif':'image/png',
        transparency:{mode,keyColour:'#00ff00',tolerance:30,feather:8}
    });
    return {engine,counters,sticker,cleanup(){engine.clearAll();globalThis.document=originalDocument}};
}
test('unchanged static keyed PNG is processed once even across many rendered frames',()=>{
    const app=setup();
    try {
        const logo=app.sticker('logo');app.engine.setTracks([logo]);
        app.engine.renderFrame();app.engine.renderFrame();app.engine.renderFrame();
        assert.equal(app.counters.getImageData,1);
        assert.equal(app.engine.stickerEffectCache.size,1);
    }finally{app.cleanup()}
});
test('opacity changes reuse processed image while keyed colour change invalidates it',()=>{
    const app=setup();
    try {
        const logo=app.sticker('logo');app.engine.setTracks([logo]);
        logo.opacity=.5;app.engine.renderFrame();
        assert.equal(app.counters.getImageData,1);
        logo.transparency.keyColour='#123456';app.engine.renderFrame();
        assert.equal(app.counters.getImageData,2);
        logo.transparency.feather=20;app.engine.renderFrame();
        assert.equal(app.counters.getImageData,3);
    }finally{app.cleanup()}
});
test('animated GIF is never frozen in static sticker processing cache',()=>{
    const app=setup();
    try{
        const image=app.sticker('gif',{name:'moving.gif'});
        app.engine.setTracks([image]);app.engine.renderFrame();app.engine.renderFrame();
        assert.equal(app.counters.getImageData,3);
        assert.equal(app.engine.stickerEffectCache.size,0);
    }finally{app.cleanup()}
});
test('preview cache remains bounded and discards deleted clip media',()=>{
    const app=setup();
    try {
        const images=[0,1,2,3,4].map(i=>app.sticker('logo'+i));
        app.engine.setTracks(images);
        assert.equal(app.engine.stickerEffectCache.size,3);
        assert.equal(app.engine.stickerEffectCache.has(images[0]),false);
        app.engine.setTracks([images[4]]);
        assert.equal(app.engine.stickerEffectCache.size,1);
        app.engine.clearAll();
        assert.equal(app.engine.stickerEffectCache.size,0);
    }finally{app.cleanup()}
});
test('visual-stack order memoizes until order or track list changes',()=>{
    const app=setup();
    try{
        const back={id:'back',type:'background',sourceName:'bg.jpg',start:0,clipDuration:10,order:1};
        const a={id:'a',type:'video',sourceName:'a.mp4',start:0,clipDuration:10,order:2};
        const b={id:'b',type:'video',sourceName:'b.mp4',start:0,clipDuration:10,order:1};
        app.engine.setTracks([back,a,b]);
        const first=app.engine.getVisualTracksTopToBottom();
        assert.equal(app.engine.getVisualTracksTopToBottom(),first);
        assert.deepEqual(first.map(t=>t.id),['b','a','back']);
        b.order=5;
        const changed=app.engine.getVisualTracksTopToBottom();
        assert.notEqual(changed,first);
        assert.deepEqual(changed.map(t=>t.id),['a','b','back']);
    }finally{app.cleanup()}
});
