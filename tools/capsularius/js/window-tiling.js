export function installWindowTiling(Workspace) {
  if (Workspace.prototype.__capsulariusWindowTilingInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusWindowTilingInstalled', { value: true });

  Workspace.prototype.tileVisibleWindows = function tileVisibleWindows() {
    const windows = [...this.state.windows.values()].filter((windowRecord) => !windowRecord.minimized);
    if (windows.length === 0) return;

    const areaWidth = Math.max(720, this.viewport.clientWidth - 48);
    const areaHeight = Math.max(420, this.viewport.clientHeight - 48);
    const columns = Math.ceil(Math.sqrt((windows.length * areaWidth) / areaHeight));
    const rows = Math.ceil(windows.length / columns);
    const gap = 20;
    const cellWidth = Math.max(470, Math.floor((areaWidth - gap * (columns - 1)) / columns));
    const cellHeight = Math.max(300, Math.floor((areaHeight - gap * (rows - 1)) / rows));

    this.state.workspace.panX = 0;
    this.state.workspace.panY = 0;
    this.applyWorkspaceTransform();

    windows.forEach((windowRecord, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      windowRecord.x = column * (cellWidth + gap);
      windowRecord.y = row * (cellHeight + gap);
      windowRecord.width = cellWidth;
      windowRecord.height = cellHeight;
      const element = windowRecord.element;
      if (element) {
        element.style.left = `${windowRecord.x}px`;
        element.style.top = `${windowRecord.y}px`;
        element.style.width = `${windowRecord.width}px`;
        element.style.height = `${windowRecord.height}px`;
      }
    });

    this.onStateChange();
  };
}
