function refreshWindowNumbers() {
  document.querySelectorAll('#workspace-world .folder-window').forEach((windowElement, index) => {
    const label = windowElement.querySelector('.window-index');
    const next = `#${index + 1}`;
    if (label && label.textContent !== next) label.textContent = next;
  });

  document.querySelectorAll('#window-pills button').forEach((pill, index) => {
    const title = pill.textContent.replace(/^\s*#\d+\s*/, '').trim();
    const next = `#${index + 1}${title ? ` ${title}` : ''}`;
    if (pill.textContent !== next) pill.textContent = next;
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
