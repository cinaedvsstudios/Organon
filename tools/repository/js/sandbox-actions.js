(function(){
  function startVisualTutorial() {
    showToast('Sandbox guide: browse components, test the preview, then add useful items to the UI Builder.');
    const first = document.querySelector('.component-card');
    if (first) {
      first.classList.add('ring-2','ring-repo-sand');
      setTimeout(() => first.classList.remove('ring-2','ring-repo-sand'), 2500);
    }
  }

  function openSandboxBlockingModal() {
    const overlay = document.getElementById('blocking-modal-overlay');
    const panel = document.getElementById('blocking-modal-panel');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      panel?.classList.remove('scale-90');
    });
  }
  function closeSandboxBlockingModal(event) {
    if (event && event.target !== document.getElementById('blocking-modal-overlay')) return;
    const overlay = document.getElementById('blocking-modal-overlay');
    const panel = document.getElementById('blocking-modal-panel');
    if (!overlay) return;
    overlay.classList.add('opacity-0');
    panel?.classList.add('scale-90');
    setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 180);
  }

  function openSandboxCommandPalette() {
    const overlay = document.getElementById('sandbox-omnibar-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
    setTimeout(() => document.getElementById('omnibar-query')?.focus(), 50);
  }
  function closeSandboxCommandPalette(event) {
    if (event && event.target !== document.getElementById('sandbox-omnibar-overlay')) return;
    const overlay = document.getElementById('sandbox-omnibar-overlay');
    if (!overlay) return;
    overlay.classList.add('opacity-0');
    setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 150);
  }
  function filterOmnibarCommands(value) {
    const needle = String(value || '').toLowerCase();
    document.querySelectorAll('#omnibar-list .omnibar-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(needle) ? '' : 'none';
    });
  }

  function hideSandboxContextMenu() {
    document.getElementById('sandbox-context-menu')?.classList.add('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run-guide-btn')?.addEventListener('click', startVisualTutorial);
    document.querySelector('[data-close-blocking-modal]')?.addEventListener('click', () => closeSandboxBlockingModal(null));
    document.querySelector('[data-confirm-blocking-modal]')?.addEventListener('click', () => { showToast('Establishing warp coordinates...'); closeSandboxBlockingModal(null); });
    document.getElementById('blocking-modal-overlay')?.addEventListener('click', closeSandboxBlockingModal);
    document.getElementById('sandbox-omnibar-overlay')?.addEventListener('click', closeSandboxCommandPalette);
    document.getElementById('omnibar-query')?.addEventListener('keyup', (e) => filterOmnibarCommands(e.target.value));
    document.querySelectorAll('.omnibar-item').forEach(item => item.addEventListener('click', () => { showToast('Command selected.'); closeSandboxCommandPalette(null); }));
    document.querySelectorAll('[data-context-action]').forEach(btn => btn.addEventListener('click', () => { showToast(btn.textContent.trim()); hideSandboxContextMenu(); }));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#sandbox-context-menu')) hideSandboxContextMenu();
    });
  });

  window.startVisualTutorial = startVisualTutorial;
  window.openSandboxBlockingModal = openSandboxBlockingModal;
  window.closeSandboxBlockingModal = closeSandboxBlockingModal;
  window.openSandboxCommandPalette = openSandboxCommandPalette;
  window.closeSandboxCommandPalette = closeSandboxCommandPalette;
  window.filterOmnibarCommands = filterOmnibarCommands;
  window.hideSandboxContextMenu = hideSandboxContextMenu;
})();
