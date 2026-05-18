(function(){
  function sectionClass(name) {
    const n = String(name || '').toUpperCase();
    if (n.includes('TOP') || n.includes('UPPER')) return 'builder-section-top';
    if (n.includes('MIDDLE') || n.includes('CENTER')) return 'builder-section-middle';
    if (n.includes('LOWER') || n.includes('BOTTOM')) return 'builder-section-lower';
    return 'builder-section-generic';
  }

  function renderBuilder() {
    const list = document.getElementById('notepad-list');
    const state = window.builderState;
    if (!list || !state) return;
    list.innerHTML = '';
    if (!state.items.length) {
      list.innerHTML = '<div class="text-center text-xs text-gray-500 mt-10 italic w-full pointer-events-none">Builder is empty. Click in this black space to type, use Template, or add repository components.</div>';
      syncBasketBadges?.();
      return;
    }

    let inGroup = false;
    let inSection = false;
    state.items.forEach((item, index) => {
      const row = document.createElement('div');
      const isActive = state.activeId === item.id;
      row.className = `flex items-stretch w-full relative mb-1 group-row ${isActive ? 'active-builder-row' : ''}`;
      row.draggable = true;
      row.ondragstart = (e) => handleDragStart(e, index);
      row.ondragend = handleDragEnd;
      row.ondragover = handleDragOver;
      row.ondrop = (e) => handleDrop(e, index);

      if (item.type === 'group_start') { inGroup = true; inSection = false; }
      if (item.type === 'group_end') { inGroup = false; inSection = false; }
      if (item.type === 'section') { inSection = true; }

      const highlighted = state.highlightedIds.has(item.id);
      const lineHtml = `<div class="builder-line-number ${highlighted ? 'highlighted' : ''}" onclick="toggleHighlightLine('${item.id}')">${index + 1}</div>`;
      row.innerHTML = `${lineHtml}${buildItemHtml(item, index, inGroup, inSection)}`;
      list.appendChild(row);
    });
    syncBasketBadges?.();
  }

  function buildItemHtml(item, index, inGroup, inSection) {
    const expanded = window.builderState.expandedIds.has(item.id);
    const textWrap = expanded ? 'whitespace-normal' : 'truncate';
    if (item.type === 'group_start') {
      return `<div class="flex-1 builder-group-start border-2 rounded-t-xl p-2 mt-4 shadow-lg flex items-center justify-between" onclick="setActivePill('${item.id}')">
        <span class="font-black text-repo-cream tracking-widest uppercase">📦 ${escapeHtml(item.name)}</span>
        <button onclick="event.stopPropagation(); removeItem('${item.id}')" class="text-repo-salmon hover:text-white font-bold px-2">✕</button>
      </div>`;
    }
    if (item.type === 'group_end') {
      return `<div class="flex-1 builder-group-end border-2 border-t-0 rounded-b-xl p-2 mb-4 shadow-lg flex items-center justify-between" onclick="setActivePill('${item.id}')">
        <span class="font-black text-repo-cream tracking-widest uppercase">▲ END ${escapeHtml(item.name)}</span>
        <button onclick="event.stopPropagation(); removeItem('${item.id}')" class="text-repo-salmon hover:text-white font-bold px-2">✕</button>
      </div>`;
    }
    if (item.type === 'section') {
      const cls = sectionClass(item.name);
      const wrap = inGroup ? 'mx-3 mt-2' : '';
      return `<div class="flex-1 ${cls} border rounded-t-lg p-2 flex items-center justify-between ${wrap}" onclick="setActivePill('${item.id}')">
        <span class="font-black uppercase tracking-widest">📑 ${escapeHtml(item.name)}</span>
        <button onclick="event.stopPropagation(); removeItem('${item.id}')" class="text-repo-salmon hover:text-white font-bold px-2">✕</button>
      </div>`;
    }
    if (item.type === 'component') {
      const wrap = inGroup ? 'mx-3' : '';
      const inner = inSection ? 'border border-repo-teal/50 bg-[#161816]' : 'border border-[#444] bg-repo-dark';
      return `<div class="flex-1 p-2 flex items-start gap-2 rounded builder-pill ${inner} ${wrap}">
        <input type="checkbox" onchange="toggleGroupSelection(this, '${item.id}')" class="mt-1 shrink-0" ${window.builderState.selectedIds.has(item.id) ? 'checked' : ''}>
        <div class="flex-1 min-w-0" onclick="setActivePill('${item.id}')">
          <strong class="text-repo-blue block text-[11px]">🧩 Comp ${escapeHtml(item.compId)}: ${escapeHtml(item.name)}</strong>
          <span class="text-gray-400 block text-[10px] ${textWrap}">${escapeHtml(item.prompt || '')}</span>
        </div>
        <button onclick="event.stopPropagation(); moveItem('${item.id}', -1)" class="mobile-move-btn text-gray-400 hover:text-white px-1">↑</button>
        <button onclick="event.stopPropagation(); moveItem('${item.id}', 1)" class="mobile-move-btn text-gray-400 hover:text-white px-1">↓</button>
        <button onclick="event.stopPropagation(); toggleExpand('${item.id}')" class="text-gray-400 hover:text-white px-1">👁️</button>
        <button onclick="event.stopPropagation(); removeItem('${item.id}')" class="text-repo-salmon hover:text-white font-bold px-1">✕</button>
      </div>`;
    }
    const wrap = inGroup ? 'mx-3' : '';
    const inner = inSection ? 'border border-repo-teal/50 bg-[#161816]' : 'border border-[#444] bg-repo-dark';
    return `<div class="flex-1 p-2 flex items-start gap-2 rounded builder-pill ${inner} ${wrap}">
      <input type="checkbox" onchange="toggleGroupSelection(this, '${item.id}')" class="mt-0.5 shrink-0" ${window.builderState.selectedIds.has(item.id) ? 'checked' : ''}>
      <div class="flex-1 min-w-0 flex items-start gap-1" onclick="setActivePill('${item.id}')">
        <span>📝</span>
        <span id="text-edit-${item.id}" contenteditable="true" onblur="updateTextPill('${item.id}', this.innerText)" onkeydown="handleTextPillKeydown(event, '${item.id}')" placeholder="Empty note..." class="flex-1 outline-none focus:bg-[#333] px-1 rounded text-repo-sand italic min-h-[16px] ${textWrap}">${escapeHtml(item.text || '')}</span>
      </div>
      <button onclick="event.stopPropagation(); moveItem('${item.id}', -1)" class="mobile-move-btn text-gray-400 hover:text-white px-1">↑</button>
      <button onclick="event.stopPropagation(); moveItem('${item.id}', 1)" class="mobile-move-btn text-gray-400 hover:text-white px-1">↓</button>
      <button onclick="event.stopPropagation(); toggleExpand('${item.id}')" class="text-gray-400 hover:text-white px-1">👁️</button>
      <button onclick="event.stopPropagation(); removeItem('${item.id}')" class="text-repo-salmon hover:text-white font-bold px-1">✕</button>
    </div>`;
  }

  window.renderBuilder = renderBuilder;
  window.renderNotepad = renderBuilder;
})();
