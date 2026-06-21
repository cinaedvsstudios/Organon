(() => {
  'use strict';

  const QS = window.QS;

  QS.clearWorkspace = () => {
    if (!QS.state.dirty && !QS.hasGridData() && !QS.state.sourceFileName) return;
    QS.confirmAction({
      title: 'Clear Quicksheet?',
      message: 'Close the current workbook from this tab and return to a blank paste/open workspace? Unsaved changes will be lost.',
      confirmLabel: 'Clear workspace',
      danger: true,
      onConfirm: () => {
        QS.state.workbook = { sheets: [{ name: 'Sheet1', data: [], columnWidths: [] }] };
        QS.state.activeSheet = 0;
        QS.state.fileHandle = null;
        QS.state.sourceFileName = '';
        QS.state.sourceExt = '';
        QS.state.dirty = false;
        QS.state.filters = {};
        QS.state.selection = null;
        QS.state.editing = null;
        QS.state.searchMatches = [];
        QS.state.searchIndex = -1;
        QS.els.searchInput.value = '';
        QS.clearHistory();
        QS.refreshWorkspace();
        QS.setStatus('Blank workspace — paste a table or open a file');
      }
    });
  };

  function handleKeydown(event) {
    const target = event.target;
    if (!QS.els.modalBackdrop.hidden) return;
    if (target instanceof HTMLElement && target.matches('input:not(.cell-editor), textarea')) return;
    if (QS.state.editing) return;

    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) QS.redo(); else QS.undo();
      return;
    }
    if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      QS.redo();
      return;
    }
    if (modifier && event.key.toLowerCase() === 'c' && QS.state.selection) {
      event.preventDefault();
      QS.copySelection();
      return;
    }
    if (event.key === 'ArrowUp') { event.preventDefault(); QS.moveSelection(-1, 0, event.shiftKey); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); QS.moveSelection(1, 0, event.shiftKey); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); QS.moveSelection(0, -1, event.shiftKey); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); QS.moveSelection(0, 1, event.shiftKey); return; }
    if (event.key === 'Enter' && QS.state.selection) {
      event.preventDefault();
      QS.beginEdit(QS.state.selection.focus.r, QS.state.selection.focus.c);
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && QS.state.selection) {
      event.preventDefault();
      QS.clearSelectionValues();
      return;
    }
    if (!modifier && event.key.length === 1 && QS.state.selection) {
      event.preventDefault();
      QS.beginEdit(QS.state.selection.focus.r, QS.state.selection.focus.c, event.key);
    }
  }

  function bindDropZone(zone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (zone === QS.els.emptyState) QS.els.emptyState.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      zone.addEventListener(eventName, () => QS.els.emptyState.classList.remove('drag-over'));
    });
    zone.addEventListener('drop', async (event) => {
      event.preventDefault();
      const [file] = event.dataTransfer.files;
      if (file) await QS.loadFile(file, null);
    });
  }

  function bindEvents() {
    QS.els.openFileBtn.addEventListener('click', QS.openFile);
    QS.els.emptyOpenBtn.addEventListener('click', QS.openFile);
    QS.els.pasteSheetBtn.addEventListener('click', QS.pasteFromClipboardButton);
    QS.els.emptyPasteBtn.addEventListener('click', QS.pasteFromClipboardButton);
    QS.els.undoBtn.addEventListener('click', QS.undo);
    QS.els.redoBtn.addEventListener('click', QS.redo);
    QS.els.addRowBtn.addEventListener('click', () => QS.addRow());
    QS.els.addColumnBtn.addEventListener('click', () => QS.addColumn());
    QS.els.clearBtn.addEventListener('click', QS.clearWorkspace);
    QS.els.saveBtn.addEventListener('click', QS.save);
    QS.els.saveAsBtn.addEventListener('click', QS.saveAs);
    QS.els.newSheetBtn.addEventListener('click', QS.newSheet);
    QS.els.findNextBtn.addEventListener('click', QS.findNext);

    QS.els.searchInput.addEventListener('input', () => {
      QS.state.searchIndex = -1;
      if (QS.hasGridData()) QS.renderGrid(); else QS.calculateSearchMatches();
    });
    QS.els.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        QS.findNext();
      }
    });

    QS.els.fallbackFileInput.addEventListener('change', async () => {
      await QS.loadFile(QS.els.fallbackFileInput.files[0], null);
      QS.els.fallbackFileInput.value = '';
    });

    document.addEventListener('mouseup', () => { QS.state.isSelecting = false; });
    document.addEventListener('mousemove', QS.performResize);
    document.addEventListener('mouseup', QS.finishResize);
    document.addEventListener('mousedown', (event) => {
      if (!QS.els.contextMenu.hidden && !QS.els.contextMenu.contains(event.target)) QS.hideContextMenu();
    });
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('copy', (event) => {
      const target = event.target;
      if (QS.state.editing || (target instanceof HTMLElement && target.matches('input, textarea'))) return;
      if (QS.state.selection) QS.copySelection(event);
    });
    document.addEventListener('paste', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('input, textarea')) return;
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;
      event.preventDefault();
      QS.pasteIntoGrid(text);
    });

    QS.els.modalCloseBtn.addEventListener('click', QS.closeModal);
    QS.els.modalBackdrop.addEventListener('mousedown', (event) => {
      if (event.target === QS.els.modalBackdrop) QS.closeModal();
    });

    bindDropZone(QS.els.emptyState);
    bindDropZone(QS.els.gridStage);

    window.addEventListener('beforeunload', (event) => {
      if (!QS.state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  bindEvents();
  QS.refreshWorkspace();
  QS.setStatus('Ready — open a spreadsheet or paste cells');
})();
