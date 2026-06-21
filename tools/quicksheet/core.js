(() => {
  'use strict';

  const QS = window.QS = window.QS || {};
  const byId = (id) => document.getElementById(id);

  QS.els = {
    openFileBtn: byId('open-file-btn'),
    pasteSheetBtn: byId('paste-sheet-btn'),
    undoBtn: byId('undo-btn'),
    redoBtn: byId('redo-btn'),
    addRowBtn: byId('add-row-btn'),
    addColumnBtn: byId('add-column-btn'),
    clearBtn: byId('clear-btn'),
    saveBtn: byId('save-btn'),
    saveAsBtn: byId('save-as-btn'),
    emptyOpenBtn: byId('empty-open-btn'),
    emptyPasteBtn: byId('empty-paste-btn'),
    fallbackFileInput: byId('fallback-file-input'),
    emptyState: byId('empty-state'),
    gridStage: byId('grid-stage'),
    gridScroll: byId('grid-scroll'),
    sheetGrid: byId('sheet-grid'),
    sheetTabs: byId('sheet-tabs'),
    newSheetBtn: byId('new-sheet-btn'),
    fileName: byId('file-name'),
    dirtyIndicator: byId('dirty-indicator'),
    statusText: byId('status-text'),
    contextMenu: byId('context-menu'),
    searchInput: byId('search-input'),
    findNextBtn: byId('find-next-btn'),
    searchCount: byId('search-count'),
    filterSummary: byId('filter-summary'),
    modalBackdrop: byId('modal-backdrop'),
    modalTitle: byId('modal-title'),
    modalBody: byId('modal-body'),
    modalActions: byId('modal-actions'),
    modalCloseBtn: byId('modal-close-btn'),
    toast: byId('toast')
  };

  QS.state = {
    workbook: { sheets: [{ name: 'Sheet1', data: [], columnWidths: [] }] },
    activeSheet: 0,
    fileHandle: null,
    sourceFileName: '',
    sourceExt: '',
    dirty: false,
    undoStack: [],
    redoStack: [],
    selection: null,
    isSelecting: false,
    editing: null,
    filters: {},
    searchMatches: [],
    searchIndex: -1,
    dragSourceRow: null,
    resizeState: null,
    toastTimer: null
  };

  QS.toText = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };

  QS.normalizeData = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map((row) => Array.isArray(row) ? row.map(QS.toText) : []);
  };

  QS.cloneWorkbook = () => JSON.parse(JSON.stringify(QS.state.workbook));
  QS.cloneFilters = () => ({ ...QS.state.filters });

  QS.getSheet = () => QS.state.workbook.sheets[QS.state.activeSheet];
  QS.hasGridData = () => !!QS.getSheet() && QS.getSheet().data.length > 0;

  QS.getColumnCount = (sheet = QS.getSheet()) => {
    if (!sheet || !sheet.data.length) return 0;
    return Math.max(1, ...sheet.data.map((row) => row.length));
  };

  QS.columnLetter = (index) => {
    let value = index + 1;
    let output = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      output = String.fromCharCode(65 + remainder) + output;
      value = Math.floor((value - 1) / 26);
    }
    return output;
  };

  QS.uniqueSheetName = (proposed, skipIndex = -1) => {
    const base = (proposed || 'Sheet').trim().slice(0, 31) || 'Sheet';
    const names = QS.state.workbook.sheets
      .filter((_, index) => index !== skipIndex)
      .map((sheet) => sheet.name.toLowerCase());
    if (!names.includes(base.toLowerCase())) return base;
    let number = 2;
    while (names.includes(`${base} ${number}`.toLowerCase())) number += 1;
    return `${base} ${number}`;
  };

  QS.createSheet = (name = 'Sheet1', data = []) => ({
    name: QS.uniqueSheetName(name),
    data: QS.normalizeData(data),
    columnWidths: []
  });

  QS.setStatus = (text) => {
    QS.els.statusText.textContent = text || 'Ready';
  };

  QS.showToast = (text) => {
    clearTimeout(QS.state.toastTimer);
    QS.els.toast.textContent = text;
    QS.els.toast.classList.add('show');
    QS.state.toastTimer = setTimeout(() => QS.els.toast.classList.remove('show'), 2800);
  };

  QS.updateFileUi = () => {
    QS.els.fileName.textContent = QS.state.sourceFileName || 'Unsaved sheet';
    QS.els.dirtyIndicator.hidden = !QS.state.dirty;
  };

  QS.updateToolbar = () => {
    QS.els.undoBtn.disabled = QS.state.undoStack.length === 0;
    QS.els.redoBtn.disabled = QS.state.redoStack.length === 0;
    QS.els.saveBtn.disabled = !QS.state.workbook.sheets.length;
  };

  QS.markDirty = () => {
    QS.state.dirty = true;
    QS.updateFileUi();
    QS.updateToolbar();
  };

  QS.snapshot = () => ({
    workbook: QS.cloneWorkbook(),
    activeSheet: QS.state.activeSheet,
    filters: QS.cloneFilters(),
    sourceFileName: QS.state.sourceFileName,
    sourceExt: QS.state.sourceExt,
    dirty: QS.state.dirty
  });

  QS.pushUndo = () => {
    QS.state.undoStack.push(QS.snapshot());
    if (QS.state.undoStack.length > 60) QS.state.undoStack.shift();
    QS.state.redoStack = [];
    QS.updateToolbar();
  };

  QS.clearHistory = () => {
    QS.state.undoStack = [];
    QS.state.redoStack = [];
    QS.updateToolbar();
  };

  QS.restoreSnapshot = (saved) => {
    QS.state.workbook = saved.workbook;
    QS.state.activeSheet = Math.min(saved.activeSheet, QS.state.workbook.sheets.length - 1);
    QS.state.filters = saved.filters || {};
    QS.state.sourceFileName = saved.sourceFileName || QS.state.sourceFileName;
    QS.state.sourceExt = saved.sourceExt || QS.state.sourceExt;
    QS.state.dirty = true;
    QS.state.selection = null;
    QS.state.editing = null;
    QS.refreshWorkspace();
  };

  QS.undo = () => {
    if (!QS.state.undoStack.length) return;
    QS.state.redoStack.push(QS.snapshot());
    QS.restoreSnapshot(QS.state.undoStack.pop());
    QS.setStatus('Undid last edit');
    QS.updateToolbar();
  };

  QS.redo = () => {
    if (!QS.state.redoStack.length) return;
    QS.state.undoStack.push(QS.snapshot());
    QS.restoreSnapshot(QS.state.redoStack.pop());
    QS.setStatus('Restored edit');
    QS.updateToolbar();
  };

  QS.getCellValue = (row, column) => {
    const sheet = QS.getSheet();
    return QS.toText(sheet && sheet.data[row] ? sheet.data[row][column] : '');
  };

  QS.getHeaderName = (column) => {
    const value = QS.getCellValue(0, column).trim();
    return value || `Column ${QS.columnLetter(column)}`;
  };

  QS.ensureGridExists = () => {
    const sheet = QS.getSheet();
    if (sheet.data.length) return;
    sheet.data = [['Column A']];
    sheet.columnWidths = [150];
  };

  QS.ensureCell = (row, column) => {
    const sheet = QS.getSheet();
    while (sheet.data.length <= row) sheet.data.push([]);
    while (sheet.data[row].length <= column) sheet.data[row].push('');
  };

  QS.closeModal = () => {
    QS.els.modalBackdrop.hidden = true;
    QS.els.modalBody.innerHTML = '';
    QS.els.modalActions.innerHTML = '';
  };

  QS.makeModalButton = (label, handler, primary = false, danger = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tool-button${primary ? ' primary' : ''}${danger ? ' danger' : ''}`;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  };

  QS.openTextModal = ({ title, label, initialValue = '', confirmLabel = 'Save', secondaryLabel = '', onConfirm, onSecondary }) => {
    QS.els.modalTitle.textContent = title;
    QS.els.modalBody.innerHTML = '';
    const field = document.createElement('label');
    field.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    field.appendChild(input);
    QS.els.modalBody.appendChild(field);
    QS.els.modalActions.innerHTML = '';
    if (secondaryLabel) {
      QS.els.modalActions.appendChild(QS.makeModalButton(secondaryLabel, () => {
        QS.closeModal();
        onSecondary?.();
      }));
    }
    const cancel = QS.makeModalButton('Cancel', QS.closeModal);
    const confirm = QS.makeModalButton(confirmLabel, () => {
      const value = input.value;
      QS.closeModal();
      onConfirm?.(value);
    }, true);
    QS.els.modalActions.append(cancel, confirm);
    QS.els.modalBackdrop.hidden = false;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') confirm.click();
    });
  };

  QS.confirmAction = ({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) => {
    QS.els.modalTitle.textContent = title;
    QS.els.modalBody.textContent = message;
    QS.els.modalActions.innerHTML = '';
    const cancel = QS.makeModalButton('Cancel', QS.closeModal);
    const confirm = QS.makeModalButton(confirmLabel, () => {
      QS.closeModal();
      onConfirm?.();
    }, true, danger);
    QS.els.modalActions.append(cancel, confirm);
    QS.els.modalBackdrop.hidden = false;
    requestAnimationFrame(() => confirm.focus());
  };

  QS.hideContextMenu = () => {
    QS.els.contextMenu.hidden = true;
    QS.els.contextMenu.innerHTML = '';
  };

  QS.showContextMenu = (x, y, items) => {
    QS.hideContextMenu();
    items.forEach((item) => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'menu-divider';
        QS.els.contextMenu.appendChild(divider);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      if (item.danger) button.classList.add('menu-danger');
      button.addEventListener('click', () => {
        QS.hideContextMenu();
        item.action();
      });
      QS.els.contextMenu.appendChild(button);
    });
    QS.els.contextMenu.hidden = false;
    const maxX = window.innerWidth - QS.els.contextMenu.offsetWidth - 8;
    const maxY = window.innerHeight - QS.els.contextMenu.offsetHeight - 8;
    QS.els.contextMenu.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
    QS.els.contextMenu.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
  };

  QS.extensionForName = (name) => {
    const match = /\.([^.]+)$/.exec(name || '');
    const ext = match ? match[1].toLowerCase() : '';
    return ['csv', 'xlsx', 'xls'].includes(ext) ? ext : 'xlsx';
  };

  QS.cleanOutputName = (name) => {
    const base = (name || 'quicksheet.xlsx').trim();
    return /\.(csv|xlsx|xls)$/i.test(base) ? base : `${base}.xlsx`;
  };
})();
