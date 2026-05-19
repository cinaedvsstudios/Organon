(function(){
  let toastTimeout;
  function showToast(message) {
    const toast = document.getElementById('toast-wrapper');
    const text = document.getElementById('toast-text');
    if (!toast || !text) return;
    text.textContent = message;
    clearTimeout(toastTimeout);
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    toastTimeout = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-10', 'opacity-0');
    }, 2800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
        return true;
      }
    } catch (err) {}
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard!');
      document.body.removeChild(el);
      return true;
    } catch (err) {
      document.body.removeChild(el);
      showOutputFallback(text);
      return false;
    }
  }

  function showOutputFallback(text) {
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4';
    wrap.innerHTML = `<div class="bg-repo-card border border-repo-blue rounded-xl p-4 max-w-3xl w-full shadow-2xl">
      <div class="flex items-center justify-between mb-3"><strong class="text-repo-sand uppercase text-sm">Copy fallback</strong><button class="text-repo-salmon font-bold" data-close>✕</button></div>
      <p class="text-xs text-repo-cream/70 mb-2">Clipboard access failed. Select/copy the text below.</p>
      <textarea class="w-full h-[50vh] bg-black border border-[#444] text-repo-cream font-mono text-xs p-3 rounded">${escapeHtml(text)}</textarea>
    </div>`;
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.dataset.close !== undefined) wrap.remove(); });
    document.body.appendChild(wrap);
    wrap.querySelector('textarea').focus();
    wrap.querySelector('textarea').select();
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function createId(prefix='item') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  }

  function stars(risk) {
    const n = Math.max(0, Math.min(5, Number(risk) || 0));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function scrollToComponent(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function debounce(fn, wait=200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  window.showToast = showToast;
  window.copyText = copyText;
  window.copyPrompt = copyText;
  window.downloadText = downloadText;
  window.escapeHtml = escapeHtml;
  window.createId = createId;
  window.stars = stars;
  window.scrollToComponent = scrollToComponent;
  window.debounce = debounce;
})();
