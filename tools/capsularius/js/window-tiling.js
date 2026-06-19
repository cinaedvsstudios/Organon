const VERSION_LABEL = 'Capsularius · v0.28.0 — Window Tiling & Operation Panels';

function ensureTilingStyles() {
  if (document.getElementById('capsularius-tiling-styles')) return;
  const style = document.createElement('style');
  style.id = 'capsularius-tiling-styles';
  style.textContent = `
    .folder-window.capsularius-tiled {
      min-width: 0 !important;
      min-height: 0 !important;
    }
  `;
  document.head.append(style);
}

function rowCountsFor(windowCount) {
  if (windowCount <= 3) return [windowCount];

  const preferredColumns = Math.ceil(Math.sqrt(windowCount));
  const rowCount = Math.ceil(windowCount / preferredColumns);
  const rows = [];
  let remaining = windowCount;

  for (let row = 0; row < rowCount; row += 1) {
    const rowsLeft = rowCount - row;
    const countInRow = Math.ceil(remaining / rowsLeft);
    rows.push(countInRow);
    remaining -= countInRow;
  }

  return rows;
}

export function installWindowTiling(Workspace) {
  if (Workspace.prototype.__capsulariusWindowTilingInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusWindowTilingInstalled', { value: true });

  ensureTilingStyles();
  const badge = document.querySelector('.app-badge');
  if (badge) badge.textContent = VERSION_LABEL;

  Workspace.prototype.tileVisibleWindows = function tileVisibleWindows() {
    const windows = [...this.state.windows.values()].filter((windowRecord) => !windowRecord.minimized);
    if (windows.length === 0) return;

    const outerMargin = 14;
    const gap = 12;
    const viewportWidth = Math.max(1, this.viewport.clientWidth);
    const viewportHeight = Math.max(1, this.viewport.clientHeight);
    const rows = rowCountsFor(windows.length);
    const usableWidth = Math.max(1, viewportWidth - outerMargin * 2);
    const usableHeight = Math.max(1, viewportHeight - outerMargin * 2 - gap * (rows.length - 1));
    const rowHeight = usableHeight / rows.length;

    this.state.workspace.panX = 0;
    this.state.workspace.panY = 0;
    this.applyWorkspaceTransform();

    let cursor = 0;
    let y = outerMargin;

    for (const countInRow of rows) {
      const rowWidth = Math.max(1, (usableWidth - gap * (countInRow - 1)) / countInRow);
      let x = outerMargin;

      for (let column = 0; column < countInRow; column += 1) {
        const windowRecord = windows[cursor++];
        const width = Math.max(1, Math.floor(column === countInRow - 1 ? usableWidth - (rowWidth + gap) * (countInRow - 1) : rowWidth));
        const height = Math.max(1, Math.floor(rowHeight));

        windowRecord.x = Math.round(x);
        windowRecord.y = Math.round(y);
        windowRecord.width = width;
        windowRecord.height = height;

        const element = windowRecord.element;
        if (element) {
          element.classList.add('capsularius-tiled');
          element.style.left = `${windowRecord.x}px`;
          element.style.top = `${windowRecord.y}px`;
          element.style.width = `${windowRecord.width}px`;
          element.style.height = `${windowRecord.height}px`;
        }

        x += rowWidth + gap;
      }

      y += rowHeight + gap;
    }

    this.onStateChange();
  };
}
