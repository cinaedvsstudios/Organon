(() => {
  'use strict';

  const QS = window.QS;

  QS.clearSelectionValues = () => {
    const range = QS.selectionBounds();
    if (!range) return;
    QS.pushUndo();
    for (let row = range.top; row <= range.bottom; row += 1) {
      for (let column = range.left; column <= range.right; column += 1) {
        QS.ensureCell(row, column);
        QS.getSheet().data[row][column] = '';
      }
    }
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Cleared selected cells');
  };

  QS.addRow = (afterRow = null) => {
    QS.pushUndo();
    QS.ensureGridExists();
    const sheet = QS.getSheet();
    const columns = QS.getColumnCount(sheet);
    const requested = afterRow === null
      ? (QS.state.selection ? QS.state.selection.focus.r + 1 : sheet.data.length)
      : afterRow + 1;
    const insertAt = Math.max(1, Math.min(requested, sheet.data.length));
    sheet.data.splice(insertAt, 0, Array(columns).fill(''));
    QS.state.selection = { anchor: { r: insertAt, c: 0 }, focus: { r: insertAt, c: 0 } };
    QS.markDirty();
    QS.refreshWorkspace();
    QS.setStatus('Added row');
  };

  QS.insertRowAt = (row) => {
    QS.pushUndo();
    QS.ensureGridExists();
    const sheet = QS.getSheet();
    const insertAt = Math.max(1, Math.min(row, sheet.data.length));
    sheet.data.splice(insertAt, 0, Array(QS.getColumnCount(sheet)).fill(''));
    QS.state.selection = { anchor: { r: insertAt, c: 0 }, focus: { r: insertAt, c: 0 } };
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Inserted row');
  };

  QS.duplicateRow = (row) => {
    const sheet = QS.getSheet();
    if (!sheet.data[row]) return;
    QS.pushUndo();
    sheet.data.splice(row + 1, 0, [...sheet.data[row]]);
    QS.state.selection = { anchor: { r: row + 1, c: 0 }, focus: { r: row + 1, c: 0 } };
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Duplicated row');
  };

  QS.deleteRow = (row) => {
    const sheet = QS.getSheet();
    if (row <= 0 || !sheet.data[row]) return;
    QS.pushUndo();
    sheet.data.splice(row, 1);
    QS.state.selection = null;
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Deleted row');
  };

  QS.reorderRow = (from, to) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from <= 0 || to <= 0) return;
    const sheet = QS.getSheet();
    if (!sheet.data[from] || !sheet.data[to]) return;
    QS.pushUndo();
    const [moved] = sheet.data.splice(from, 1);
    const destination = from < to ? to - 1 : to;
    sheet.data.splice(destination, 0, moved);
    QS.state.selection = { anchor: { r: destination, c: 0 }, focus: { r: destination, c: 0 } };
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Reordered row');
  };

  QS.addColumn = (afterColumn = null) => {
    QS.pushUndo();
    QS.ensureGridExists();
    const sheet = QS.getSheet();
    const columns = QS.getColumnCount(sheet);
    const requested = afterColumn === null
      ? (QS.state.selection ? QS.state.selection.focus.c + 1 : columns)
      : afterColumn + 1;
    const insertAt = Math.max(0, Math.min(requested, columns));
    sheet.data.forEach((row) => row.splice(Math.min(insertAt, row.length), 0, ''));
    sheet.data[0][insertAt] = `Column ${QS.columnLetter(insertAt)}`;
    sheet.columnWidths.splice(insertAt, 0, 150);
    const row = Math.min(1, sheet.data.length - 1);
    QS.state.selection = { anchor: { r: row, c: insertAt }, focus: { r: row, c: insertAt } };
    QS.markDirty();
    QS.refreshWorkspace();
    QS.setStatus('Added column');
  };

  QS.insertColumnAt = (column) => {
    QS.pushUndo();
    QS.ensureGridExists();
    const sheet = QS.getSheet();
    sheet.data.forEach((row) => row.splice(column, 0, ''));
    sheet.data[0][column] = `Column ${QS.columnLetter(column)}`;
    sheet.columnWidths.splice(column, 0, 150);
    const row = Math.min(1, sheet.data.length - 1);
    QS.state.selection = { anchor: { r: row, c: column }, focus: { r: row, c: column } };
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Inserted column');
  };

  QS.deleteColumn = (column) => {
    const sheet = QS.getSheet();
    if (QS.getColumnCount(sheet) <= 1) {
      QS.pushUndo();
      sheet.data = [['Column A'], ...sheet.data.slice(1).map(() => [''])];
      sheet.columnWidths = [150];
    } else {
      QS.pushUndo();
      sheet.data.forEach((row) => row.splice(column, 1));
      sheet.columnWidths.splice(column, 1);
    }
    QS.state.selection = null;
    delete QS.state.filters[column];
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus('Deleted column');
  };

  QS.sortColumn = (column, direction) => {
    const sheet = QS.getSheet();
    if (sheet.data.length <= 2) return;
    QS.pushUndo();
    const header = sheet.data[0];
    const rows = sheet.data.slice(1);
    rows.sort((leftRow, rightRow) => {
      const left = QS.toText(leftRow[column]);
      const right = QS.toText(rightRow[column]);
      const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? result : -result;
    });
    sheet.data = [header, ...rows];
    QS.state.selection = null;
    QS.markDirty();
    QS.renderGrid();
    QS.setStatus(`Sorted ${QS.getHeaderName(column)} ${direction === 'asc' ? 'A–Z' : 'Z–A'}`);
  };

  QS.renameColumn = (column) => {
    QS.openTextModal({
      title: `Rename ${QS.columnLetter(column)}`,
      label: 'Column name',
      initialValue: QS.getCellValue(0, column),
      confirmLabel: 'Rename',
      onConfirm: (value) => {
        QS.pushUndo();
        QS.ensureCell(0, column);
        QS.getSheet().data[0][column] = value.trim() || `Column ${QS.columnLetter(column)}`;
        QS.markDirty();
        QS.renderGrid();
        QS.setStatus('Renamed column');
      }
    });
  };

  QS.openFilter = (column) => {
    QS.openTextModal({
      title: `Filter ${QS.getHeaderName(column)}`,
      label: 'Show rows containing this text',
      initialValue: QS.state.filters[column] || '',
      confirmLabel: 'Apply filter',
      secondaryLabel: 'Clear filter',
      onSecondary: () => {
        delete QS.state.filters[column];
        QS.state.selection = null;
        QS.renderGrid();
        QS.setStatus('Filter cleared');
      },
      onConfirm: (value) => {
        if (value.trim()) QS.state.filters[column] = value.trim();
        else delete QS.state.filters[column];
        QS.state.selection = null;
        QS.renderGrid();
        QS.setStatus(value.trim() ? 'Filter applied' : 'Filter cleared');
      }
    });
  };

  QS.clearFilters = () => {
    QS.state.filters = {};
    QS.state.selection = null;
    QS.renderGrid();
    QS.setStatus('All filters cleared');
  };

  QS.newSheet = () => {
    const initial = QS.uniqueSheetName('Sheet');
    QS.openTextModal({
      title: 'New sheet',
      label: 'Sheet name',
      initialValue: initial,
      confirmLabel: 'Create',
      onConfirm: (value) => {
        QS.pushUndo();
        QS.state.workbook.sheets.push(QS.createSheet(value || initial, []));
        QS.state.activeSheet = QS.state.workbook.sheets.length - 1;
        QS.state.selection = null;
        QS.state.filters = {};
        QS.markDirty();
        QS.refreshWorkspace();
        QS.setStatus(`Created ${QS.getSheet().name}`);
      }
    });
  };

  QS.renameSheet = (index) => {
    const sheet = QS.state.workbook.sheets[index];
    if (!sheet) return;
    QS.openTextModal({
      title: 'Rename sheet',
      label: 'Sheet name',
      initialValue: sheet.name,
      confirmLabel: 'Rename',
      onConfirm: (value) => {
        QS.pushUndo();
        sheet.name = QS.uniqueSheetName(value || 'Sheet', index);
        QS.markDirty();
        QS.renderSheetTabs();
        QS.setStatus('Renamed sheet');
      }
    });
  };

  QS.duplicateSheet = (index) => {
    const sheet = QS.state.workbook.sheets[index];
    if (!sheet) return;
    QS.pushUndo();
    const copy = JSON.parse(JSON.stringify(sheet));
    copy.name = QS.uniqueSheetName(`${sheet.name} copy`);
    QS.state.workbook.sheets.splice(index + 1, 0, copy);
    QS.state.activeSheet = index + 1;
    QS.state.filters = {};
    QS.markDirty();
    QS.refreshWorkspace();
    QS.setStatus(`Duplicated ${sheet.name}`);
  };

  QS.deleteSheet = (index) => {
    const sheet = QS.state.workbook.sheets[index];
    if (!sheet) return;
    QS.confirmAction({
      title: 'Delete sheet?',
      message: `Delete “${sheet.name}”? This can be undone before saving.`,
      confirmLabel: 'Delete sheet',
      danger: true,
      onConfirm: () => {
        QS.pushUndo();
        if (QS.state.workbook.sheets.length === 1) {
          QS.state.workbook.sheets = [{ name: 'Sheet1', data: [], columnWidths: [] }];
          QS.state.activeSheet = 0;
        } else {
          QS.state.workbook.sheets.splice(index, 1);
          QS.state.activeSheet = Math.min(index, QS.state.workbook.sheets.length - 1);
        }
        QS.state.selection = null;
        QS.state.filters = {};
        QS.markDirty();
        QS.refreshWorkspace();
        QS.setStatus('Deleted sheet');
      }
    });
  };

  QS.showColumnMenu = (column, x, y) => {
    QS.showContextMenu(x, y, [
      { label: 'Sort A–Z', action: () => QS.sortColumn(column, 'asc') },
      { label: 'Sort Z–A', action: () => QS.sortColumn(column, 'desc') },
      { label: 'Filter column…', action: () => QS.openFilter(column) },
      { label: 'Clear this filter', action: () => { delete QS.state.filters[column]; QS.renderGrid(); } },
      { divider: true },
      { label: 'Rename column…', action: () => QS.renameColumn(column) },
      { label: 'Insert column left', action: () => QS.insertColumnAt(column) },
      { label: 'Insert column right', action: () => QS.insertColumnAt(column + 1) },
      {
        label: 'Delete column',
        danger: true,
        action: () => QS.confirmAction({
          title: 'Delete column?',
          message: `Delete “${QS.getHeaderName(column)}” and all its cell values? This can be undone before saving.`,
          confirmLabel: 'Delete column',
          danger: true,
          onConfirm: () => QS.deleteColumn(column)
        })
      }
    ]);
  };

  QS.showRowMenu = (row, x, y) => {
    QS.showContextMenu(x, y, [
      { label: 'Insert row above', action: () => QS.insertRowAt(row) },
      { label: 'Insert row below', action: () => QS.insertRowAt(row + 1) },
      { label: 'Duplicate row', action: () => QS.duplicateRow(row) },
      { divider: true },
      {
        label: 'Delete row',
        danger: true,
        action: () => QS.confirmAction({
          title: 'Delete row?',
          message: 'Delete this row? This can be undone before saving.',
          confirmLabel: 'Delete row',
          danger: true,
          onConfirm: () => QS.deleteRow(row)
        })
      }
    ]);
  };

  QS.showSheetMenu = (index, x, y) => {
    QS.showContextMenu(x, y, [
      { label: 'Rename sheet…', action: () => QS.renameSheet(index) },
      { label: 'Duplicate sheet', action: () => QS.duplicateSheet(index) },
      { divider: true },
      { label: 'Delete sheet', danger: true, action: () => QS.deleteSheet(index) }
    ]);
  };

  QS.beginResize = (event, column) => {
    event.preventDefault();
    event.stopPropagation();
    const sheet = QS.getSheet();
    QS.state.resizeState = {
      column,
      startX: event.clientX,
      startWidth: sheet.columnWidths[column] || 150
    };
    event.currentTarget.classList.add('active');
    document.body.style.cursor = 'col-resize';
  };

  QS.performResize = (event) => {
    if (!QS.state.resizeState) return;
    const { column, startX, startWidth } = QS.state.resizeState;
    const width = Math.max(80, Math.min(500, startWidth + event.clientX - startX));
    const col = QS.els.sheetGrid.querySelector(`col[data-column="${column}"]`);
    if (col) col.style.width = `${width}px`;
    QS.getSheet().columnWidths[column] = width;
  };

  QS.finishResize = () => {
    if (!QS.state.resizeState) return;
    QS.state.resizeState = null;
    document.body.style.cursor = '';
    QS.markDirty();
    QS.setStatus('Resized column');
  };
})();
