(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const state=E.state;
  const original=E.renderGroups;
  let dragged=null;
  E.renderGroups=()=>{
    original();
    document.querySelectorAll('.ag-group').forEach((section)=>{
      const group=E.group(section.querySelector('[data-select]')?.dataset.select);
      if(!group)return;
      [...section.querySelectorAll('.ag-thumb')].forEach((tile,index)=>{
        const frame=group.frames[index];
        if(!frame)return;
        tile.draggable=true;
        tile.addEventListener('dragstart',()=>{dragged={groupId:group.id,frameId:frame.id};tile.classList.add('dragging');});
        tile.addEventListener('dragend',()=>{dragged=null;tile.classList.remove('dragging');});
        tile.addEventListener('dragover',(event)=>{if(!dragged||dragged.groupId!==group.id||dragged.frameId===frame.id)return;event.preventDefault();});
        tile.addEventListener('drop',(event)=>{if(!dragged||dragged.groupId!==group.id||dragged.frameId===frame.id)return;event.preventDefault();const from=group.frames.findIndex((item)=>item.id===dragged.frameId),to=group.frames.findIndex((item)=>item.id===frame.id);if(from<0||to<0)return;const [moving]=group.frames.splice(from,1);let insertAt=to+(event.clientX-tile.getBoundingClientRect().left>=tile.clientWidth/2?1:0);if(from<insertAt)insertAt-=1;group.frames.splice(insertAt,0,moving);state.activeGroupId=group.id;state.activeFrameId=moving.id;state.timelineIndex=insertAt;state.editCache=null;E.stopPreview?.();E.renderAll();});
      });
    });
  };
})();