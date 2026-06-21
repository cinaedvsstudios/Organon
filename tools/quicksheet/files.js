(() => {
  'use strict';

  const QS = window.QS;

  QS.sheetJsBookForOutput = (fileName) => {
    if (!window.XLSX) {
      throw new Error('Spreadsheet support did not load. Check your connection and reload Quicksheet.');
    }
    const ext = QS.extensionForName(fileName);
    if (ext === 'csv' && QS.state.workbook.sheets.length > 1) {
      throw new Error('CSV can save one sheet only. Use Save as and choose .xlsx to keep every sheet tab.');
    }

    const output = XLSX.utils.book_new();
    const sourceSheets = ext === 'csv' ? [QS.getSheet()] : QS.state.workbook.sheets;
    sourceSheets.forEach((sheet) => {
      const data = sheet.data.length ? sheet.data.map((row) => row.map(QS.toText)) : [[]];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(output, worksheet, (sheet.name || 'Sheet').slice(0, 31));
    });

    return XLSX.write(output, {
      bookType: ext === 'xls' ? 'biff8' : ext,
      type: 'array',
      compression: ext !== 'csv'
    });
  };

  QS.writeToHandle = async (handle, name) => {
    const outputName = QS.cleanOutputName(name || handle.name);
    const bytes = QS.sheetJsBookForOutput(outputName);
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    QS.state.fileHandle = handle;
    QS.state.sourceFileName = handle.name || outputName;
    QS.state.sourceExt = QS.extensionForName(QS.state.sourceFileName);
    QS.state.dirty = false;
    QS.updateFileUi();
    QS.setStatus(`Saved ${QS.state.sourceFileName}`);
    QS.showToast('Saved over local file');
  };

  QS.save = async () => {
    if (QS.state.fileHandle?.createWritable) {
      try {
        await QS.writeToHandle(QS.state.fileHandle, QS.state.fileHandle.name || QS.state.sourceFileName);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
        QS.showToast(error.message || 'Could not overwrite that file. Use Save as instead.');
        QS.setStatus('Save needs a new file location');
        return;
      }
    }
    await QS.saveAs();
  };

  QS.saveAs = async () => {
    const suggestedName = QS.cleanOutputName(
      QS.state.sourceFileName && QS.state.sourceFileName !== 'Pasted sheet'
        ? QS.state.sourceFileName
        : 'quicksheet.xlsx'
    );

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: 'Excel workbook',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
            },
            {
              description: 'Legacy Excel workbook',
              accept: { 'application/vnd.ms-excel': ['.xls'] }
            },
            {
              description: 'CSV file',
              accept: { 'text/csv': ['.csv'] }
            }
          ]
        });
        await QS.writeToHandle(handle, handle.name || suggestedName);
      } catch (error) {
        if (error.name !== 'AbortError') {
          QS.showToast(error.message || 'Could not save this file.');
          QS.setStatus('Save as failed');
        }
      }
      return;
    }

    try {
      const bytes = QS.sheetJsBookForOutput(suggestedName);
      const mime = QS.extensionForName(suggestedName) === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([bytes], { type: mime });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = suggestedName;
      link.click();
      URL.revokeObjectURL(link.href);
      QS.state.dirty = false;
      QS.updateFileUi();
      QS.showToast('Downloaded exported file');
    } catch (error) {
      QS.showToast(error.message || 'Could not export this sheet.');
    }
  };

  QS.openFile = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Spreadsheet files',
              accept: {
                'text/csv': ['.csv'],
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
              }
            }
          ]
        });
        await QS.loadFile(await handle.getFile(), handle);
      } catch (error) {
        if (error.name !== 'AbortError') {
          QS.showToast(error.message || 'Could not open file.');
          QS.setStatus('Open file failed');
        }
      }
      return;
    }
    QS.els.fallbackFileInput.click();
  };

  QS.loadFile = async (file, handle = null) => {
    if (!file) return;
    const ext = QS.extensionForName(file.name);
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      QS.showToast('Open a CSV, XLSX or XLS file.');
      return;
    }

    try {
      QS.setStatus(`Opening ${file.name}…`);
      const source = ext === 'csv' ? await file.text() : await file.arrayBuffer();
      const rawBook = XLSX.read(source, {
        type: ext === 'csv' ? 'string' : 'array',
        raw: false,
        cellDates: false
      });
      const sheets = rawBook.SheetNames.map((name) => {
        const rawSheet = rawBook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(rawSheet, {
          header: 1,
          defval: '',
          raw: false,
          blankrows: true
        });
        return { name, data: QS.normalizeData(data), columnWidths: [] };
      });

      QS.state.workbook = {
        sheets: sheets.length ? sheets : [{ name: 'Sheet1', data: [], columnWidths: [] }]
      };
      QS.state.activeSheet = 0;
      QS.state.fileHandle = handle;
      QS.state.sourceFileName = file.name;
      QS.state.sourceExt = ext;
      QS.state.dirty = false;
      QS.state.filters = {};
      QS.state.selection = null;
      QS.state.searchMatches = [];
      QS.state.searchIndex = -1;
      QS.els.searchInput.value = '';
      QS.clearHistory();
      QS.refreshWorkspace();
      QS.setStatus(`Opened ${file.name}`);
      QS.showToast(handle ? 'Opened with overwrite-save enabled' : 'Opened — use Save as to choose where to write');
    } catch (error) {
      console.error(error);
      QS.showToast('That file could not be read as a spreadsheet.');
      QS.setStatus('Could not read file');
    }
  };

  QS.pasteFromClipboardButton = () => {
    if (!navigator.clipboard?.readText) {
      QS.showToast('Press Ctrl+V anywhere in the blank workspace or selected grid cells.');
      return;
    }
    navigator.clipboard.readText()
      .then((text) => {
        if (!text) {
          QS.showToast('Clipboard has no text table to paste.');
          return;
        }
        QS.pasteIntoGrid(text);
      })
      .catch(() => QS.showToast('Clipboard access was blocked. Press Ctrl+V instead.'));
  };
})();
