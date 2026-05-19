(function(){
  function sectionClass(name) {
    const n = String(name || '').toUpperCase();
    if (n.includes('TOP') || n.includes('UPPER')) return 'builder-section-top';
    if (n.includes('MID') || n.includes('MIDDLE') || n.includes('CENTER')) return 'builder-section-middle';
    if (n.includes('LOWER') || n.includes('BOTTOM')) return 'builder-section-lower';
    return 'builder-section-generic';
  }

  function contextClass(context) {
    if (context === 'top') return 'pill-in-top';
    if (context === 'middle') return 'pill-in-middle';
    if (context === 'lower') return 'pill-in-lower';
    if (context === 'group') return 'pill-in-group';
    return '';
  }

  function contextFromSection(name, fallback) {
    const n = String(name || '').toUpperCase();
    if (n.includes('TOP') || n.includes('UPPER')) return 'top';
    if (n.includes('MID') || n.includes('MIDDLE') || n.includes('CENTER')) return 'middle';
    if (n.includes('LOWER') || n.includes('BOTTOM')) return 'lower';
    return fallback || '';
  }

  function renderBuilder() {
    const list = document.getElementById('notepad-list');
    const state = window.builderState;
    if (!list || !state) return;
    list.innerHTML = '';
    if (!state.items.length) {
      list.innerHTML = '<div class="builder-empty-message">Builder is empty. Click here to type, click Group for a group card, Section for a section box, or add repository components.</div>';
      syncBasketBadges?.();
      return;
    }
    let rowCounter = 0;
    const fragment = document.createDocumentFragment();

    function nextLine() { rowCounter += 1; return rowCounter; }

    function appendLine(contentEl) {
      const rowNumber = nextLine();
      const row = document.createElement('div');
      row.className = 'builder-row';
      const num = document.createElement('div');
      num.className = `builder-line-number ${state.highlightedRows.has(rowNumber) ? 'highlighted' : ''}`;
      num.textContent = String(rowNumber);
      num.addEventListener('click', (event) => { event.stopPropagation(); toggleHighlightRow(rowNumber); });
      const content = document.createElement('div');
      content.className = 'builder-row-content';
      content.appendChild(contentEl);
      row.appendChild(num);
      row.appendChild(content);
      return row;
    }

    function renderList(items, context = '', parentContainerId = null) {
      const holder = document.createDocumentFragment();
      let loose = [];
      function flushLoose() {
        if (!loose.length) return;
        const line = document.createElement('div');
        line.className = 'builder-pill-row';
        line.dataset.dropContainer = parentContainerId || 'root';
        addDropHandlers(line, parentContainerId || null);
        loose.forEach(item => line.appendChild(buildPill(item, context)));
        holder.appendChild(appendLine(line));
        loose = [];
      }
      items.forEach(item => {
        if (item.type === 'component' || item.type === 'text') {
          loose.push(item);
        } else {
          flushLoose();
          holder.appendChild(appendLine(buildContainer(item, context)));
        }
      });
      flushLoose();
      return holder;
    }

    function buildContainer(item, parentContext) {
      const isGroup = item.type === 'group';
      const secClass = isGroup ? '' : sectionClass(item.name);
      const context = isGroup ? 'group' : contextFromSection(item.name, parentContext || 'group');
      const div = document.createElement('div');
      div.className = isGroup ? 'builder-container builder-group' : `builder-container builder-section ${secClass}`;
      div.dataset.containerId = item.id;
      addDropHandlers(div, item.id);
      div.addEventListener('click', (event) => { if (event.target === div) setActiveContainer(item.id); });

      const label = document.createElement('div');
      label.className = 'container-label';
      label.contentEditable = 'true';
      label.textContent = item.name || (isGroup ? 'GROUP' : 'SECTION');
      label.addEventListener('click', (event) => { event.stopPropagation(); setActiveContainer(item.id); });
      label.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); label.blur(); } });
      label.addEventListener('blur', () => updateContainerName(item.id, label.innerText));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'container-delete';
      del.textContent = '⛔';
      del.title = 'Delete whole container';
      del.addEventListener('click', (event) => { event.stopPropagation(); removeContainer(item.id); });

      const childWrap = document.createElement('div');
      childWrap.className = 'container-children';
      childWrap.dataset.dropContainer = item.id;
      addDropHandlers(childWrap, item.id);
      const children = item.children || [];
      if (!children.length) {
        const empty = document.createElement('div');
        empty.className = 'text-[10px] text-gray-400 italic py-2';
        empty.textContent = 'Drag pills into this box.';
        childWrap.appendChild(empty);
      } else {
        childWrap.appendChild(renderList(children, context, item.id));
      }
      div.appendChild(label);
      div.appendChild(del);
      div.appendChild(childWrap);
      return div;
    }

    function buildPill(item, context) {
      const expanded = state.expandedIds.has(item.id);
      const selected = state.selectedIds.has(item.id);
      const pill = document.createElement('div');
      const typeClass = item.type === 'component' ? 'pill-component' : 'pill-text';
      pill.className = `builder-pill ${typeClass} ${contextClass(context)} ${selected ? 'selected' : ''} ${expanded ? 'expanded' : ''}`;
      pill.draggable = true;
      pill.dataset.pillId = item.id;
      pill.addEventListener('click', (event) => { if (!event.target.closest('button') && !event.target.closest('[contenteditable="true"]')) selectPill(item.id, event); });
      addPillDragHandlers(pill, item.id);

      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'pill-expand';
      expand.textContent = expanded ? '⌄' : '‹';
      expand.title = 'Expand / collapse';
      expand.addEventListener('click', (event) => { event.stopPropagation(); toggleExpand(item.id); });

      const text = document.createElement('span');
      text.className = 'pill-text-content';
      if (item.type === 'component') {
        text.textContent = expanded ? `[${item.compId}] ${item.name}: ${item.prompt || ''}` : `[${item.compId}] ${item.name}`;
      } else {
        text.contentEditable = 'true';
        text.id = `text-edit-${item.id}`;
        text.textContent = item.text || '';
        text.setAttribute('placeholder', 'note');
        text.addEventListener('click', (event) => event.stopPropagation());
        text.addEventListener('blur', () => updateTextPill(item.id, text.innerText));
        text.addEventListener('keydown', (event) => handleTextPillKeydown(event, item.id));
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'pill-delete';
      del.textContent = '×';
      del.title = 'Delete pill';
      del.addEventListener('click', (event) => { event.stopPropagation(); removeItem(item.id); });

      pill.appendChild(expand);
      pill.appendChild(text);
      pill.appendChild(del);
      return pill;
    }

    fragment.appendChild(renderList(state.items, '', null));
    list.appendChild(fragment);
    syncBasketBadges?.();
  }

  function addDropHandlers(el, containerId) {
    el.addEventListener('dragover', (event) => handleBuilderDragOver(event, containerId));
    el.addEventListener('dragleave', (event) => handleBuilderDragLeave(event));
    el.addEventListener('drop', (event) => handleBuilderDrop(event, containerId));
  }

  function addPillDragHandlers(el, id) {
    el.addEventListener('dragstart', (event) => handlePillDragStart(event, id));
    el.addEventListener('dragend', (event) => handlePillDragEnd(event));
    el.addEventListener('dragover', (event) => handlePillDragOver(event, id));
    el.addEventListener('dragleave', (event) => handleBuilderDragLeave(event));
    el.addEventListener('drop', (event) => handlePillDrop(event, id));
  }

  window.renderBuilder = renderBuilder;
  window.renderNotepad = renderBuilder;
})();
