(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const run=async()=>{
    const state=E.state;
    const saved={groups:state.groups,activeGroupId:state.activeGroupId,activeFrameId:state.activeFrameId,timelineIndex:state.timelineIndex,images:state.images,editCache:state.editCache};
    try{
      const make=(colour)=>{const canvas=E.makeCanvas(4,4);const context=canvas.getContext('2d');context.fillStyle=colour;context.fillRect(0,0,4,4);return canvas.toDataURL('image/png');};
      const blue=make('#0000ff'),red=make('#ff0000');
      state.images=new Map();
      state.groups=[
        {id:'test-top',name:'Test Top',layer:1,blend:'source-over',effects:E.copy(E.defaults()),frames:[{id:'test-red',name:'red',source:red,working:red,width:4,height:4,offsetX:0,offsetY:0}]},
        {id:'test-bottom',name:'Test Bottom',layer:2,blend:'source-over',effects:E.copy(E.defaults()),frames:[{id:'test-blue',name:'blue',source:blue,working:blue,width:4,height:4,offsetX:0,offsetY:0}]}
      ];
      state.activeGroupId='test-top';
      state.activeFrameId='test-red';
      const composite=await E.composite(0,4);
      const pixel=composite.getContext('2d').getImageData(2,2,1,1).data;
      if(pixel[0]<240||pixel[1]>15||pixel[2]>15)throw new Error('Layer order check failed.');
      const output=await E.outputFrames();
      const size=Number(document.getElementById('ag-size').value);
      if(!output.length||output[0].width!==size||output[0].height!==size)throw new Error('Output pipeline check failed.');
      Object.assign(state,saved);
      E.renderAll();
      E.status('Advanced Mode ready.');
    }catch(error){
      Object.assign(state,saved);
      E.renderAll();
      console.error('Advanced Mode self-test failed:',error);
      E.status(`Advanced Mode load check failed: ${error.message}`);
    }
  };
  run();
})();