export function installWindowPills(Workspace) {
  if (Workspace.prototype.__capsulariusWindowPillsInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusWindowPillsInstalled', { value: true });

  const originalAddWindow = Workspace.prototype.addWindow;
  const originalDestroyWindow = Workspace.prototype.destroyWindow;
  const originalFocusWindow = Workspace.prototype.focusWindow;
  const originalRenderWindowShell = Workspace.prototype.renderWindowShell;
  const originalRotateColour = Workspace.prototype.rotateColour;

  Workspace.prototype.renderWindowPills = function renderWindowPills() {
    const strip = document.getElementById('window-pills');
    if (!strip) return;

    const fragment = document.createDocumentFragment();
    for (const windowRecord of this.state.windows.values()) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `window-pill${windowRecord.minimized ? ' minimized' : ''}${this.state.activeWindowId === windowRecord.id ? ' active' : ''}`;
      pill.title = windowRecord.minimized ? `Restore ${windowRecord.nickname}` : `Focus ${windowRecord.nickname}`;
      pill.setAttribute('aria-label', pill.title);
      pill.style.setProperty('--pill-colour', windowRecord.colour);

      const dot = document.createElement('span');
      dot.className = 'window-pill-dot';
      const label = document.createElement('span');
      label.className = 'window-pill-label';
      label.textContent = `#${windowRecord.id} ${windowRecord.nickname}`;
      pill.append(dot, label);

      pill.addEventListener('click', () => {
        if (windowRecord.minimized) this.restoreWindow(windowRecord);
        else this.focusWindow(windowRecord.id);
      });
      fragment.append(pill);
    }
    strip.replaceChildren(fragment);
  };

  Workspace.prototype.focusFirstVisibleWindow = function focusFirstVisibleWindow() {
    const next = [...this.state.windows.values()].find((record) => !record.minimized);
    if (!next) {
      this.state.activeWindowId = null;
      return;
    }
    originalFocusWindow.call(this, next.id);
  };

  Workspace.prototype.minimiseWindow = function minimiseWindow(windowRecord, { persist = true } = {}) {
    if (!windowRecord || windowRecord.minimized) return;
    windowRecord.minimized = true;
    if (windowRecord.element) {
      windowRecord.element.hidden = true;
      windowRecord.element.classList.remove('active');
    }
    if (this.state.activeWindowId === windowRecord.id) this.focusFirstVisibleWindow();
    this.renderWindowPills();
    if (persist) this.onStateChange();
  };

  Workspace.prototype.restoreWindow = function restoreWindow(windowRecord, { persist = true } = {}) {
    if (!windowRecord) return;
    windowRecord.minimized = false;
    if (windowRecord.element) windowRecord.element.hidden = false;
    originalFocusWindow.call(this, windowRecord.id);
    this.renderWindowPills();
    if (persist) this.onStateChange();
  };

  Workspace.prototype.renderWindowShell = function renderWindowShell(windowRecord) {
    originalRenderWindowShell.call(this, windowRecord);
    const actions = windowRecord.element.querySelector('.window-actions');
    const colourButton = actions.querySelector('[data-action="colour"]');
    const minimise = this.button('−', 'icon-button minimise-window', 'Minimise window');
    minimise.dataset.action = 'minimise';
    colourButton.before(minimise);
    minimise.addEventListener('click', () => this.minimiseWindow(windowRecord));

    const title = windowRecord.element.querySelector('.window-title');
    title.addEventListener('blur', () => this.renderWindowPills());

    if (windowRecord.minimized) windowRecord.element.hidden = true;
    this.renderWindowPills();
  };

  Workspace.prototype.addWindow = function addWindow(windowRecord) {
    originalAddWindow.call(this, windowRecord);
    if (windowRecord.minimized && windowRecord.element) {
      windowRecord.element.hidden = true;
      windowRecord.element.classList.remove('active');
      if (this.state.activeWindowId === windowRecord.id) this.state.activeWindowId = null;
    }
    this.renderWindowPills();
  };

  Workspace.prototype.destroyWindow = function destroyWindow(windowRecord) {
    originalDestroyWindow.call(this, windowRecord);
    this.focusFirstVisibleWindow();
    this.renderWindowPills();
  };

  Workspace.prototype.focusWindow = function focusWindow(id) {
    const windowRecord = this.state.windows.get(id);
    if (!windowRecord || windowRecord.minimized) return;
    originalFocusWindow.call(this, id);
    this.renderWindowPills();
  };

  Workspace.prototype.rotateColour = function rotateColour(windowRecord) {
    originalRotateColour.call(this, windowRecord);
    this.renderWindowPills();
  };
}
