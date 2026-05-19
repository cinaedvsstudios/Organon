(function(){
  const keys = {
    builder: 'uiRepositoryBuilderState_v002',
    ui: 'uiRepositoryUiState_v002',
    dock: 'uiRepositoryDockState_v002'
  };
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  window.repoStorage = { keys, readJson, writeJson };
})();
