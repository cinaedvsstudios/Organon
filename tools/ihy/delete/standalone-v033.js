(() => {
  'use strict';

  const close = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = true;
  };

  document.getElementById('analysisCloseFloating')?.addEventListener('click', () => close('analysisWindow'));
})();