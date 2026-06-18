export function openWindowSettingsDialog(windowRecord, workspace) {
  const template = document.getElementById('window-settings-template');
  const node = template.content.firstElementChild.cloneNode(true);
  const settings = workspace.getWindowSettings(windowRecord);
  const applyAll = node.querySelector('[data-window-settings-all]');
  const view = node.querySelector('[data-window-settings-view]');
  const sortBy = node.querySelector('[data-window-settings-sort]');
  const direction = node.querySelector('[data-window-settings-direction]');

  node.querySelector('[data-window-settings-name]').textContent = windowRecord.nickname;
  applyAll.checked = windowRecord.settings?.scope === 'window';
  view.value = settings.viewMode;
  sortBy.value = settings.sortBy;
  direction.value = settings.sortDirection;

  const close = () => node.remove();
  node.querySelector('[data-window-settings-cancel]').addEventListener('click', close);
  node.querySelector('[data-window-settings-save]').addEventListener('click', () => {
    workspace.applyWindowSettings(windowRecord, {
      viewMode: view.value,
      sortBy: sortBy.value,
      sortDirection: direction.value
    }, applyAll.checked);
    close();
  });

  document.getElementById('dialog-layer').append(node);
  window.setTimeout(() => view.focus(), 0);
}
