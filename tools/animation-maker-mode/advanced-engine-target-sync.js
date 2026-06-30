(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const state=E.state;
  const original=E.setActive;
  E.setActive=(groupId,frameId)=>{
    const effects=new Set(state.effectTargets);
    const animations=new Set(state.animationTargets);
    original(groupId,frameId);
    state.effectTargets=effects;
    state.animationTargets=animations;
    if(state.mode==='effects')E.renderEffects();
    if(state.mode==='animations')E.renderAnimationTargets?.();
  };
})();