(() => {
  'use strict';
  const api=window.AdvancedAnimationMaker;
  if(!api)return;
  const $=(id)=>document.getElementById(id),{ui,state}=api;
  api.startPaint=async(event)=>{const canvas=await api.editableCanvas();if(!canvas||state.editorMode!=='paint')return;api.snapshotEdit();state.paint={active:true,colour:$('ag-brush-colour').value,size:Number($('ag-brush-size').value),buffer:canvas,previous:api.pointFor(event)};ui.editorCanvas.setPointerCapture?.(event.pointerId);};
  api.movePaint=(event)=>{if(!state.paint?.active||!state.paint.buffer)return;const next=api.pointFor(event),context=state.paint.buffer.getContext('2d');context.save();context.lineWidth=state.paint.size;context.lineCap='round';context.lineJoin='round';context.strokeStyle=state.paint.colour;context.globalCompositeOperation=$('ag-eraser').checked?'destination-out':'source-over';context.beginPath();context.moveTo(state.paint.previous.x*state.paint.buffer.width,state.paint.previous.y*state.paint.buffer.height);context.lineTo(next.x*state.paint.buffer.width,next.y*state.paint.buffer.height);context.stroke();context.restore();state.paint.previous=next;ui.editorCanvas.width=state.paint.buffer.width;ui.editorCanvas.height=state.paint.buffer.height;ui.editorCanvas.getContext('2d').drawImage(state.paint.buffer,0,0);api.fitCanvas();};
  api.endPaint=(event)=>{if(!state.paint?.active)return;ui.editorCanvas.releasePointerCapture?.(event.pointerId);const buffer=state.paint.buffer;state.paint.active=false;state.paint.buffer=null;if(buffer)api.commitEdit(buffer,'Paint applied.');};
  api.canvasPointerDown=(event)=>{if(!api.activeFrame())return;if(state.editorMode==='paint'){event.preventDefault();api.startPaint(event);return;}if(state.editorMode==='select'&&state.selection.enabled){event.preventDefault();api.startSelection(event);}};
  api.canvasPointerMove=(event)=>{if(state.editorMode==='paint')api.movePaint(event);else if(state.editorMode==='select')api.moveSelection(event);};
  api.canvasPointerUp=(event)=>{if(state.editorMode==='paint')api.endPaint(event);else if(state.editorMode==='select')api.endSelection(event);};
})();