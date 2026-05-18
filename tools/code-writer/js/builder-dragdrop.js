(function(){
  let draggedIndex = null;
  function handleDragStart(event, index) {
    draggedIndex = index;
    event.target.closest('.group-row')?.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
  function handleDragEnd(event) {
    event.target.closest('.group-row')?.classList.remove('dragging');
    draggedIndex = null;
  }
  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
  function handleDrop(event, targetIndex) {
    event.preventDefault();
    const state = window.builderState;
    if (!state || draggedIndex === null || draggedIndex === targetIndex) return;
    const item = state.items.splice(draggedIndex, 1)[0];
    state.items.splice(targetIndex, 0, item);
    saveBuilderState();
    renderBuilder();
  }
  function moveItem(id, direction) {
    const state = window.builderState;
    const index = state.items.findIndex(item => item.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= state.items.length) return;
    const item = state.items.splice(index, 1)[0];
    state.items.splice(target, 0, item);
    state.activeId = item.id;
    saveBuilderState();
    renderBuilder();
  }
  window.handleDragStart = handleDragStart;
  window.handleDragEnd = handleDragEnd;
  window.handleDragOver = handleDragOver;
  window.handleDrop = handleDrop;
  window.moveItem = moveItem;
})();
