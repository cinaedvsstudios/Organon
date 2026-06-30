(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {state,$}=E;
  E.editable=async()=>{const group=E.group(),frame=E.frame(group);if(!group||!frame)return null;const key=`${group.id}:${frame.id}`;if(state.editCache?.key===key)return state.editCache.canvas;const size=Math.max(frame.width||0,frame.height||0,Number($('ag-size').value));const canvas=await E.canvasFor(frame,group,{size,includeEffects:false});state.editCache={key,canvas};return canvas;};
})();