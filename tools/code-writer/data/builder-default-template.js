(function(){
  window.createBuilderDefaultTemplate = function createBuilderDefaultTemplate() {
    const stamp = () => window.createId ? window.createId('template') : String(Date.now() + Math.random());
    return [
      { id: stamp(), type: 'group_start', name: 'SIDE PANEL' },
      { id: stamp(), type: 'text', text: 'Notes:' },
      { id: stamp(), type: 'text', text: '[None]' },
      { id: stamp(), type: 'text', text: 'This feature should appear on:' },
      { id: stamp(), type: 'text', text: '[Mobile] [Desktop]' },
      { id: stamp(), type: 'text', text: 'Code Risk: ★★★☆☆ (3/5) Difficult' },
      { id: stamp(), type: 'section', name: 'TOP / UPPER' },
      { id: stamp(), type: 'text', text: 'Align = [Center]' },
      { id: stamp(), type: 'text', text: 'Colors = [Default Palette]' },
      { id: stamp(), type: 'text', text: 'Components:' },
      { id: stamp(), type: 'text', text: 'Behavior:' },
      { id: stamp(), type: 'text', text: 'Interactions:' },
      { id: stamp(), type: 'text', text: 'Dynamic Content:' },
      { id: stamp(), type: 'text', text: 'Links:' },
      { id: stamp(), type: 'section', name: 'MIDDLE / CENTER' },
      { id: stamp(), type: 'text', text: 'Align = [Center]' },
      { id: stamp(), type: 'text', text: 'Colors = [Default Palette]' },
      { id: stamp(), type: 'text', text: 'Components:' },
      { id: stamp(), type: 'text', text: 'Behavior:' },
      { id: stamp(), type: 'text', text: 'Interactions:' },
      { id: stamp(), type: 'text', text: 'Dynamic Content:' },
      { id: stamp(), type: 'text', text: 'Links:' },
      { id: stamp(), type: 'section', name: 'LOWER / BOTTOM' },
      { id: stamp(), type: 'text', text: 'Align = [Left]' },
      { id: stamp(), type: 'text', text: 'Colors = [Default Palette]' },
      { id: stamp(), type: 'text', text: 'Components:' },
      { id: stamp(), type: 'text', text: 'Behavior:' },
      { id: stamp(), type: 'text', text: 'Interactions:' },
      { id: stamp(), type: 'text', text: 'Dynamic Content:' },
      { id: stamp(), type: 'text', text: 'Links:' },
      { id: stamp(), type: 'group_end', name: 'SIDE PANEL' }
    ];
  };
})();
