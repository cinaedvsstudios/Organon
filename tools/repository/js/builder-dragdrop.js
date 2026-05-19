(function(){
  function isDescendant(node, possibleParentId) {
    if (!node || !node.children) return false;
    if (node.id === possibleParentId) return true;
    return node.children.some(child => isDescendant(child, possibleParentId));
  }

  function getDropList(containerId) {
    if (!containerId) return window.builderState.items;
    const found = findBuilderItem(containerId);
    if (!found || !found.item || !window.isBuilderContainer(found.item)) return window.builderState.items;
    found.item.children = found.item.children || [];
    return found.item.children;
  }

  function removeMany(ids) {
    const removed = [];
    for (const id of ids) {
      const item = removeBuilderItemById(id);
      if (item) removed.push(item);
    }
    return removed;
  }

  function moveItemsToContainer(ids, containerId) {
    const cleanIds = ids.filter(Boolean);
    if (!cleanIds.length) return;
    if (containerId && cleanIds.includes(containerId)) return showToast('Cannot drop an item inside itself.');
    const target = containerId ? findBuilderItem(containerId) : null;
    if (target && cleanIds.some(id => {
      const dragged = findBuilderItem(id);
      return dragged && isDescendant(dragged.item, containerId);
    })) return showToast('Cannot drop a parent inside its own child.');

    const removed = removeMany(cleanIds);
    const list = getDropList(containerId);
    list.push(...removed);
    window.builderState.selectedIds.clear();
    removed.forEach(item => window.builderState.selectedIds.add(item.id));
    saveBuilderState();
    renderBuilder();
  }

  function moveItemsBefore(ids, targetId) {
    const target = findBuilderItem(targetId);
    if (!target) return;
    const unique = ids.filter(id => id && id !== targetId);
    if (!unique.length) return;
    const removed = removeMany(unique);
    const refreshedTarget = findBuilderItem(targetId);
    if (!refreshedTarget) return;
    refreshedTarget.list.splice(refreshedTarget.index, 0, ...removed);
    window.builderState.selectedIds.clear();
    removed.forEach(item => window.builderState.selectedIds.add(item.id));
    saveBuilderState();
    renderBuilder();
  }

  function handlePillDragStart(event, id) {
    if (!window.builderState.selectedIds.has(id)) {
      event.preventDefault();
      showToast('Click the pill first to select it, then drag.');
      return;
    }
    const ids = [...window.builderState.selectedIds];
    window.builderState.draggedIds = ids.includes(id) ? ids : [id];
    window.builderState.dragSourceId = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    event.currentTarget.classList.add('dragging');
  }

  function handlePillDragEnd(event) {
    event.currentTarget?.classList.remove('dragging');
    document.querySelectorAll('.drop-target,.pill-drop-target').forEach(el => el.classList.remove('drop-target','pill-drop-target'));
    window.builderState.draggedIds = [];
    window.builderState.dragSourceId = null;
  }

  function handleBuilderDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.drop-target').forEach(el => { if (el !== event.currentTarget) el.classList.remove('drop-target'); });
    event.currentTarget.classList.add('drop-target');
  }

  function handleBuilderDragLeave(event) {
    event.currentTarget?.classList.remove('drop-target','pill-drop-target');
  }

  function handleBuilderDrop(event, containerId) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget?.classList.remove('drop-target');
    const ids = window.builderState.draggedIds?.length ? window.builderState.draggedIds : [event.dataTransfer.getData('text/plain')];
    moveItemsToContainer(ids, containerId || null);
  }

  function handlePillDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('pill-drop-target');
  }

  function handlePillDrop(event, targetId) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('pill-drop-target');
    const ids = window.builderState.draggedIds?.length ? window.builderState.draggedIds : [event.dataTransfer.getData('text/plain')];
    moveItemsBefore(ids, targetId);
  }

  function moveItem(id, direction) {
    const found = findBuilderItem(id);
    if (!found) return;
    const target = found.index + direction;
    if (target < 0 || target >= found.list.length) return;
    const [item] = found.list.splice(found.index, 1);
    found.list.splice(target, 0, item);
    window.builderState.selectedIds.clear();
    window.builderState.selectedIds.add(id);
    saveBuilderState();
    renderBuilder();
  }

  window.handlePillDragStart = handlePillDragStart;
  window.handlePillDragEnd = handlePillDragEnd;
  window.handleBuilderDragOver = handleBuilderDragOver;
  window.handleBuilderDragLeave = handleBuilderDragLeave;
  window.handleBuilderDrop = handleBuilderDrop;
  window.handlePillDragOver = handlePillDragOver;
  window.handlePillDrop = handlePillDrop;
  window.moveItem = moveItem;
})();
