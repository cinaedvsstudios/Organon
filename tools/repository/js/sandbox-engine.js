(function(){
  function initSandboxEngine() {
    // Hook generic prompt copy buttons that are rendered dynamically.
    document.querySelectorAll('[data-copy-prompt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-copy-prompt');
        const el = document.getElementById(id);
        if (el) copyText(el.textContent.trim());
      });
    });
  }

  function getCurrentComponentPrompt(componentId) {
    const promptEl = document.getElementById(`prompt-${componentId}`);
    return promptEl ? promptEl.textContent.trim() : '';
  }

  window.initSandboxEngine = initSandboxEngine;
  window.getCurrentComponentPrompt = getCurrentComponentPrompt;
})();
