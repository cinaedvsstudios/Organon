function refreshWindowNumbers() {
  document.querySelectorAll('#workspace-world .folder-window').forEach((windowElement, index) => {
    const label = windowElement.querySelector('.window-index');
    if (label) label.textContent = `#${index + 1}`;
  });
}

function installWindowNumbering() {
  const world = document.getElementById('workspace-world');
  if (!world) {
    window.setTimeout(installWindowNumbering, 40);
    return;
  }
  const observer = new MutationObserver(refreshWindowNumbers);
  observer.observe(world, { childList:true });
  refreshWindowNumbers();
}

installWindowNumbering();
