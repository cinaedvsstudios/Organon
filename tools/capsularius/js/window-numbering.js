function refreshWindowNumbers() {
  document.querySelectorAll('#workspace-world .folder-window').forEach((windowElement, index) => {
    const label = windowElement.querySelector('.window-index');
    if (label) label.textContent = `#${index + 1}`;
  });

  document.querySelectorAll('#window-pills button').forEach((pill, index) => {
    const title = pill.textContent.replace(/^\s*#\d+\s*/, '').trim();
    pill.textContent = `#${index + 1}${title ? ` ${title}` : ''}`;
  });
}

function installWindowNumbering() {
  const world = document.getElementById('workspace-world');
  const pills = document.getElementById('window-pills');
  if (!world || !pills) {
    window.setTimeout(installWindowNumbering, 40);
    return;
  }
  const observer = new MutationObserver(refreshWindowNumbers);
  observer.observe(world, { childList:true });
  observer.observe(pills, { childList:true, subtree:true });
  refreshWindowNumbers();
}

installWindowNumbering();
