(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const settings=document.querySelector('.ag-settings');
  const preview=document.getElementById('ag-output-preview');
  if(!settings||!preview)return;
  const control=document.createElement('label');
  control.className='ag-control';
  control.innerHTML='Strobe <output id="ag-strobe-output">0</output><input id="ag-strobe" type="range" min="0" max="10" value="0">';
  preview.insertAdjacentElement('beforebegin',control);
  const original=E.applyOutputEffects;
  E.applyOutputEffects=(frames)=>{const output=original(frames),strength=Number(document.getElementById('ag-strobe').value);if(!strength)return output;const every=Math.max(2,12-strength);return output.map((frame,index)=>{if(index%every!==0)return frame;const canvas=E.makeCanvas(frame.width,frame.height),ctx=canvas.getContext('2d');ctx.globalAlpha=.35+strength/20;ctx.drawImage(frame,0,0);return canvas;});};
  document.getElementById('ag-strobe').addEventListener('input',(event)=>{document.getElementById('ag-strobe-output').textContent=event.target.value;E.renderCanvas();});
})();