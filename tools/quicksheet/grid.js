(() => {
  'use strict';

  const QS = window.QS;

  QS.selectionBounds = () => {
    if (!QS.state.selection) return null;
    const { anchor, focus } = QS.state.selection;
    return {
      top: Math.min(anchor.r, focus.r),
      bottom: Math.max(anchor.r, focus.r),
      left: Math.min(anchor.c, focus.c),
      right: Math.max(anchor.c, focus.c)
    };
  };

  QS.isSelected = (row, column) => {
    const range = QS.selectionBounds();
    return !!range && row >= range.top && row <= range.bottom && column >= range.left && column <= range.right;
  };

  QS.isActiveCell = (row, column) => !!QS.state.selection
    && QS.state.selection.focus.r === row
    && QS.state.selection.focus.c === column;

  QS.setSelection = (row, column, extend = false) => {
    if (!extend || !QS.state.selection) {
      QS.state.selection = { anchor: { r: row, c: column }, focus: { r: row, c: column } };
    } else {
      QS.state.selection.focus = { r: row, c: column };
    }
  };

  QS.getVisibleRows = () => {
    const sheet = QS.getSheet();
    if (!sheet || sheet.data.length <= 1) return [];
    const filters = Object.entries(QS.state.filters).filter(([, value]) => value.trim());
    const rows = [];
    for (let rowIndex = 1; rowIndex < sheet.data.length; rowIndex += 1) {
      const row = sheet.data[rowIndex] || [];
      const matches = filters.every(([column, needle]) => {
        const value = QS.toText(row[Number(column)]).toLowerCase();
        return value.includes(needle.toLowerCase());
      });
      if (matches) rows.push(rowIndex);
    }
    return rows;
  };

  QS.calculateSearchMatches = () => {
    const query = QS.els.searchInput.value.trim().toLowerCase();
    QS.state.searchMatches = [];
    QS.state.searchIndex = -1;
    if (!query || !QS.hasGridData()) {
      QS.els.searchCount.textContent = '0';
      return;
    }
    const sheet = QS.getSheet();
    const columnCount = QS.getColumnCount(sheet);
    for (let row = 1; row < sheet.data.length; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        if (QS.getCellValue(row, column).toLowerCase().includes(query)) {
          QS.state.searchMatches.push({ r: row, c: column });
        }
      }
    }
    QS.els.searchCount.textContent = String(QS.state.searchMatches.length);
  };

  QS.isSearchMatch = (row, column) => QS.state.searchMatches
    .some((match) => match.r === row && match.c === column);

  QS.renderSheetTabs = () => {
    QS.els.sheetTabs.innerHTML = '';
    QS.state.workbook.sheets.forEach((sheet, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `sheet-tab${index === QS.state.activeSheet ? ' active' : ''}`;
      tab.role = 'tab';
      tab.ariaSelected = String(index === QS.state.activeSheet);
      tab.textContent = sheet.name;
      tab.title = `${sheet.name} — double-click to rename`;
      tab.addEventListener('click', () => QS.switchSheet(index));
      tab.addEventListener('dblclick', () => QS.renameSheet(index));
      tab.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        QS.showSheetMenu(index, event.clientX, event.clientY);
      });
      QS.els.sheetTabs.appendChild(tab);
    });
  };

  QS.switchSheet = (index) => {
    if (index === QS.state.activeSheet) return;
    QS.state.activeSheet = index;
    QS.state.selection = null;
    QS.state.filters = {};
    QS.state.searchMatches = [];
    QS.state.searchIndex = -1;
    QS.els.searchInput.value = '';
    QS.refreshWorkspace();
    QS.setStatus(`Opened ${QS.getSheet().name}`);
  };

  QS.renderFilterSummary = () => {
    const entries = Object.entries(QS.state.filters).filter(([, value]) => value.trim());
    if (!entries.length) {
      QS.els.filterSummary.hidden = true;
      QS.els.filterSummary.textContent = '';
      return;
    }
    QS.els.filterSummary.hidden = false;
    QS.els.filterSummary.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = `Filtered: ${entries.map(([column, value]) => `${QS.getHeaderName(Number(column))} contains “${value}”`).join(' · ')}`;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear filters';
    clear.addEventListener('click', QS.clearFilters);
    QS.els.filterSummary.append(text, clear);
  };

  QS.refreshWorkspace = () => {
    QS.updateFileUi();
    QS.renderSheetTabs();
    if (QS.hasGridData()) {
      QS.els.emptyState.hidden = true;
      QS.els.gridStage.hidden = false;
      QS.renderGrid();
    } else {
      QS.els.gridStage.hidden = true;
      QS.els.emptyState.hidden = false;
      QS.renderFilterSummary();
    }
    QS.updateToolbar();
  };

  QS.renderGrid = () => {
    if (!QS.hasGridData()) return;
    QS.calculateSearchMatches();
    QS.renderFilterSummary();

    const sheet = QS.getSheet();
    const columns = QS.getColumnCount(sheet);
    const visibleRows = QS.getVisibleRows();
    const table = QS.els.sheetGrid;
    table.innerHTML = '';

    const colgroup = document.createElement('colgroup');
    const rowHeaderCol = document.createElement('col');
    rowHeaderCol.style.width = '50px';
    colgroup.appendChild(rowHeaderCol);
    for (let column = 0; column < columns; column += 1) {
      const col = document.createElement('col');
      col.dataset.column = String(column);
      col.style.width = `${sheet.columnWidths[column] || 150}px`;
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'corner-cell';
    corner.scope = 'col';
    corner.title = 'Rows';
    corner.textContent = '#';
    headerRow.appendChild(corner);

    for (let column = 0; column < columns; column += 1) {
      const heading = document.createElement('th');
      heading.scope = 'col';
      heading.dataset.column = String(column);
      heading.title = `${QS.columnLetter(column)} — ${QS.getHeaderName(column)}`;

      const inner = document.createElement('div');
      inner.className = 'column-heading';
      const label = document.createElement('span');
      label.textContent = QS.getHeaderName(column);
      const actions = document.createElement('button');
      actions.type = 'button';
      actions.className = 'header-actions';
      actions.textContent = '⋮';
      actions.title = `Column ${QS.columnLetter(column)} actions`;
      actions.addEventListener('click', (event) => {
        event.stopPropagation();
        const rect = actions.getBoundingClientRect();
        QS.showColumnMenu(column, rect.left, rect.bottom + 4);
      });
      const resizeHandle = document.createElement('span');
      resizeHandle.className = 'resize-handle';
      resizeHandle.addEventListener('mousedown', (event) => QS.beginResize(event, column));
      inner.append(label, actions, resizeHandle);
      heading.appendChild(inner);
      heading.addEventListener('dblclick', () => QS.renameColumn(column));
      heading.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        QS.showColumnMenu(column, event.clientX, event.clientY);
      });
      headerRow.appendChild(heading);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    visibleRows.forEach((sourceRow, visibleIndex) => {
      const tr = document.createElement('tr');
      const rowHeading = document.createElement('th');
      rowHeading.scope = 'row';
      rowHeading.className = 'row-heading';
      rowHeading.textContent = String(visibleIndex + 1);
      rowHeading.draggable = true;
      rowHeading.dataset.row = String(sourceRow);
      rowHeading.title = 'Right-click for row actions. Drag to reorder.';
      rowHeading.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        QS.showRowMenu(sourceRow, event.clientX, event.clientY);
      });
      rowHeading.addEventListener('dragstart', () => { QS.state.dragSourceRow = sourceRow; });
      rowHeading.addEventListener('dragover', (event) => {
        event.preventDefault();
        rowHeading.classList.add('drag-target');
      });
      rowHeading.addEventListener('dragleave', () => rowHeading.classList.remove('drag-target'));
      rowHeading.addEventListener('drop', (event) => {
        event.preventDefault();
        rowHeading.classList.remove('drag-target');
        QS.reorderRow(QS.state.dragSourceRow, sourceRow);
      });
      rowHeading.addEventListener('dragend', () => { QS.state.dragSourceRow = null; });
      tr.appendChild(rowHeading);

      for (let column = 0; column < columns; column += 1) {
        const td = document.createElement('td');
        td.dataset.row = String(sourceRow);
        td.dataset.column = String(column);
        td.classList.toggle('selected', QS.isSelected(sourceRow, column));
        td.classList.toggle('active-cell', QS.isActiveCell(sourceRow, column));
        td.classList.toggle('match-cell', QS.isSearchMatch(sourceRow, column));

        const value = document.createElement('span');
        value.className = 'cell-value';
        value.textContent = QS.getCellValue(sourceRow, column);
        td.appendChild(value);

        td.addEventListener('mousedown', (event) => {
          if (event.button !== 0 || QS.state.editing) return;
          QS.state.isSelecting = true;
          QS.setSelection(sourceRow, column, event.shiftKey);
          QS.renderGrid();
          event.preventDefault();
        });
        td.addEventListener('mouseenter', () => {
          if (!QS.state.isSelecting || !QS.state.selection || QS.state.editing) return;
          QS.setSelection(sourceRow, column, true);
          QS.renderGrid();
        });
        td.addEventListener('dblclick', () => QS.beginEdit(sourceRow, column));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  };

  QS.beginEdit = (row, column, initialValue = null) => {
    const td = QS.els.sheetGrid.querySelector(`td[data-row="${row}"][data-column="${column}"]`);
    if (!td) return;
    if (QS.state.editing) QS.commitEdit();
    const previous = QS.getCellValue(row, column);
    QS.state.editing = { row, column, previous };
    td.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.value = initialValue === null ? previous : initialValue;
    td.appendChild(input);
    input.focus();
    input.select();
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        QS.commitEdit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        QS.cancelEdit();
      }
    });
    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain').replace(/[\r\n\t]+/g, ' ');
      input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
    });
    input.addEventListener('blur', QS.commitEdit);
  };

  QS.commitEdit = () => {
    if (!QS.state.editing) return;
    const { row, column, previous } = QS.state.editing;
    const input = QS.els.sheetGrid.querySelector(`td[data-row="${row}"][data-column="${column}"] .cell-editor`);
    const next = input ? input.value : previous;
    QS.state.editing = null;
    if (next !== previous) {
      QS.pushUndo();
      QS.ensureCell(row, column);
      QS.getSheet().data[row][column] = next;
      QS.markDirty();
      QS.setStatus(`Edited ${QS.columnLetter(column)}${row}`);
    }
    QS.renderGrid();
  };

  QS.cancelEdit = () => {
    if (!QS.state.editing) return;
    QS.state.editing = null;
    QS.renderGrid();
  };

  QS.moveSelection = (rowDelta, columnDelta, extend = false) => {
    if (!QS.hasGridData()) return;
    const rows = QS.getVisibleRows();
    if (!rows.length) return;
    const columns = QS.getColumnCount();
    const current = QS.state.selection ? QS.state.selection.focus : { r: rows[0], c: 0 };
    const index = Math.max(0, rows.indexOf(current.r));
    const row = rows[Math.max(0, Math.min(rows.length - 1, index + rowDelta))];
    const column = Math.max(0, Math.min(columns - 1, current.c + columnDelta));
    QS.setSelection(row, column, extend);
    QS.renderGrid();
    QS.els.sheetGrid.querySelector(`td[data-row="${row}"][data-column="${column}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  QS.copySelection = (event) => {
    const range = QS.selectionBounds();
    if (!range) return;
    const text = [];
    for (let row = range.top; row <= range.bottom; row += 1) {
      const output = [];
      for (let column = range.left; column <= range.right; column += 1) {
        output.push(QS.getCellValue(row, column).replace(/\t/g, ' ').replace(/\r?\n/g, ' '));
      }
      text.push(output.join('\t'));
    }
    const clipboardText = text.join('\n');
    if (event?.clipboardData) {
      event.clipboardData.setData('text/plain', clipboardText);
      event.preventDefault();
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clipboardText).catch(() => {});
    }
    QS.showToast('Selected cells copied');
  };

  QS.parseClipboardTable = (text) => {
    const cleaned = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
    const rows = cleaned.split('\n');
    if (rows.length && rows[rows.length - 1] === '') rows.pop();
    return rows.map((line) => line.includes('\t') ? line.split('\t') : [line]);
  };

  QS.loadPastedSheet = (matrix) => {
    QS.state.workbook = { sheets: [QS.createSheet('Pasted Sheet', matrix)] };
    QS.state.activeSheet = 0;
    QS.state.fileHandle = null;
    QS.state.sourceFileName = 'Pasted sheet';
    QS.state.sourceExt = 'xlsx';
    QS.state.filters = {};
    QS.state.selection = null;
    QS.clearHistory();
    QS.markDirty();
    QS.refreshWorkspace();
    QS.showToast('Pasted table opened in Quicksheet');
    QS.setStatus('Pasted sheet — choose Save as when ready');
  };

  QS.pasteIntoGrid = (text) => {
    const matrix = QS.parseClipboardTable(text);
    if (!matrix.length || !matrix.some((row) => row.length)) return;
    if (!QS.hasGridData()) {
      QS.loadPastedSheet(matrix);
      return;
    }
    const origin = QS.state.selection ? QS.state.selection.focus : { r: 1, c: 0 };
    QS.pushUndo();
    matrix.forEach((row, rowOffset) => {
      row.forEach((value, columnOffset) => {
        const targetRow = origin.r + rowOffset;
        const targetColumn = origin.c + columnOffset;
        QS.ensureCell(targetRow, targetColumn);
        QS.getSheet().data[targetRow][targetColumn] = QS.toText(value);
      });
    });
    const widestRow = Math.max(...matrix.map((row) => row.length));
    QS.state.selection = {
      anchor: origin,
      focus: { r: origin.r + matrix.length - 1, c: origin.c + widestRow - 1 }
    };
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus(`Pasted ${matrix.length} row${matrix.length === 1 ? '' : 's'}`);
  };

  QS.findNext = () => {
    if (!QS.state.searchMatches.length) {
      QS.showToast('No search results in this sheet.');
      return;
    }
    QS.state.searchIndex = (QS.state.searchIndex + 1) % QS.state.searchMatches.length;
    const match = QS.state.searchMatches[QS.state.searchIndex];
    QS.setSelection(match.r, match.c);
    QS.renderGrid();
    QS.els.sheetGrid.querySelector(`td[data-row="${match.r}"][data-column="${match.c}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    QS.setStatus(`Search result ${QS.state.searchIndex + 1} of ${QS.state.searchMatches.length}`);
  };
})();
