(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const state=E.state;
  E.commit=(canvas,status)=>{const group=E.group(),frame=E.frame(group);if(!group||!frame)return;const old=frame.working;frame.working=canvas.toDataURL('image/png');frame.width=canvas.width;frame.height=canvas.height;state.images.delete(old);state.editCache={key:`${group.id}:${frame.id}`,canvas};if(status)E.status(status);E.renderAll?.();};
})();