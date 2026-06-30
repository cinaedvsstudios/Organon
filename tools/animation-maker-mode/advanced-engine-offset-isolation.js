(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const render=E.canvasFor;
  E.canvasFor=async(frame,group,options={})=>{
    if(!options.ignoreOffset)return render(frame,group,options);
    const x=frame.offsetX||0,y=frame.offsetY||0;
    frame.offsetX=0;frame.offsetY=0;
    try{return await render(frame,group,options);}
    finally{frame.offsetX=x;frame.offsetY=y;}
  };
})();