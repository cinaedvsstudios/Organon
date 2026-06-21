(() => {
  'use strict';

  const QS = window.QS;

  document.addEventListener('click', (event) => {
    const rowHeading = event.target.closest('.row-heading');
    if (!rowHeading || QS.state.editing || QS.state.dragSourceRow !== null) return;

    const row = Number(rowHeading.dataset.row);
    if (!Number.isInteger(row)) return;

    const lastColumn = Math.max(0, QS.getColumnCount() - 1);
    const startRow = event.shiftKey && QS.state.selection
      ? QS.state.selection.anchor.r
      : row;

    QS.state.selection = {
      anchor: { r: startRow, c: 0 },
      focus: { r: row, c: lastColumn }
    };
    QS.renderGrid();
    QS.setStatus(startRow === row ? `Selected row ${row}` : `Selected rows ${Math.min(startRow, row)}–${Math.max(startRow, row)}`);
  });
})();
