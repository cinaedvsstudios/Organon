import './restore-special-windows.js';
import { persistence } from './persistence.js';

function saveNow(workspace) {
  void persistence.saveDesktopWorkspaceFromApp(workspace.state).catch((error) => {
    console.error('Capsularius desktop JSON save failed.', error);
  });
}

function attachDesktopAutosave() {
  const workspace = window.__capsulariusWorkspace;
  if (!workspace) {
    window.setTimeout(attachDesktopAutosave, 40);
    return;
  }
  if (workspace.__desktopAutosaveAttached) return;
  workspace.__desktopAutosaveAttached = true;

  const originalStateChange = workspace.onStateChange;
  workspace.onStateChange = (...args) => {
    originalStateChange?.(...args);
    saveNow(workspace);
  };

  for (const methodName of ['addWindow', 'destroyWindow']) {
    const original = workspace[methodName].bind(workspace);
    workspace[methodName] = (...args) => {
      const result = original(...args);
      saveNow(workspace);
      return result;
    };
  }

  window.addEventListener('beforeunload', () => saveNow(workspace));
  window.addEventListener('pagehide', () => saveNow(workspace));
}

attachDesktopAutosave();
