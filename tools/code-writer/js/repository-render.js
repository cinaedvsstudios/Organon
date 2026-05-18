(function(){
  const categoryOrder = [
    'Core Inputs', 'Logic & Layouts', 'States & Feedback', 'Dynamic Modules', 'Premium Components', 'Enterprise Architecture'
  ];

  function getCategory(component) {
    if (component.category) return component.category;
    const id = Number(component.id);
    if ([1,2,3,4,5,6,7,8,10].includes(id)) return 'Core Inputs';
    if ([9,11,12,13,14,15,18,19,20,22,23,24,25].includes(id)) return 'Logic & Layouts';
    if ([16,17,21].includes(id)) return 'States & Feedback';
    if ([26,27,28,29,30,31,32,33,34,35].includes(id)) return 'Dynamic Modules';
    if (id >= 36) return 'Premium Components';
    return 'Core Inputs';
  }

  function sortedComponents() {
    return (window.uiRepositoryComponents || [])
      .slice()
      .sort((a,b) => Number(a.id) - Number(b.id));
  }

  function renderCatalogNav() {
    const nav = document.getElementById('catalog-nav');
    if (!nav) return;
    const groups = new Map(categoryOrder.map(c => [c, []]));
    sortedComponents().forEach(c => {
      const category = getCategory(c);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(c);
    });
    let html = '';
    groups.forEach((items, category) => {
      if (category !== 'Enterprise Architecture' && items.length === 0) return;
      html += `<div class="category-heading">${category}</div>`;
      items.forEach(c => {
        const extra = Number(c.id) >= 36 ? ' text-repo-sand font-bold' : Number(c.id) >= 16 ? ' text-repo-lightblue' : '';
        html += `<a data-scroll-target="comp-${c.id}" class="block p-2 rounded hover:bg-repo-darkteal/50 cursor-pointer transition${extra}">${c.id}. ${escapeHtml(c.title)}</a>`;
      });
      if (category === 'Enterprise Architecture') {
        html += `<a data-scroll-target="architecture-blueprint" class="block p-2 rounded hover:bg-repo-darkteal/50 cursor-pointer transition text-repo-salmon font-bold">📐 Naming & Color Tokens</a>`;
      }
    });
    nav.innerHTML = html;
    nav.querySelectorAll('[data-scroll-target]').forEach(a => a.addEventListener('click', () => scrollToComponent(a.dataset.scrollTarget)));
  }

  function renderComponents() {
    const zone = document.getElementById('component-render-zone');
    if (!zone) return;
    zone.innerHTML = '';
    sortedComponents().forEach(component => zone.insertAdjacentHTML('beforeend', buildComponentCard(component)));
    zone.insertAdjacentHTML('beforeend', buildArchitectureSection());
    document.querySelectorAll('[data-add-component]').forEach(btn => {
      btn.addEventListener('click', () => {
        addToBasket(btn.dataset.componentId);
      });
    });
    initSandboxEngine();
    syncBasketBadges?.();
  }

  function buildComponentCard(c) {
    const isPremium = Number(c.id) >= 36;
    const cardClass = isPremium ? 'component-card premium' : 'component-card';
    const titleClass = isPremium ? 'text-repo-sand' : 'text-repo-blue';
    const risk = Number(c.risk) || 0;
    const codeRisk = `<span class="code-risk-stars">${stars(risk)}</span> (${risk}/5) Rating: ${escapeHtml(c.riskText || '')}`;
    return `
      <section id="comp-${c.id}" class="${cardClass} scroll-mt-24 flex flex-col lg:flex-row gap-6 p-6 transition">
        <div class="lg:w-1/2 flex flex-col gap-4 component-meta-panel p-4">
          <div class="flex items-center gap-4 mb-1">
            <button id="badge-${c.id}" data-add-component data-component-id="${c.id}" class="add-to-basket flex flex-col items-center justify-center px-2 py-1 rounded transition w-12 text-center" title="Click to add to UI Builder">
              <span class="font-sans text-sm font-bold leading-none">${c.id}</span>
              <span class="text-[11px] mt-0.5 leading-none">🛒</span>
            </button>
            <h3 class="text-lg font-bold ${titleClass} uppercase tracking-wider">${escapeHtml(c.title)}</h3>
          </div>
          <div class="text-xs space-y-3 leading-relaxed text-repo-cream selectable-content">
            <p><strong class="${titleClass}">TERMINOLOGY:</strong> ${escapeHtml(c.term || '')}</p>
            ${c.commonNames ? `<p><strong class="${titleClass}">COMMON NAMES:</strong> ${escapeHtml(c.commonNames)}</p>` : ''}
            <p><strong class="${titleClass}">WHAT IT DOES:</strong> ${escapeHtml(c.desc || '')}</p>
            <div>
              <strong class="${titleClass}">POSSIBLE APPLICATIONS:</strong>
              <details class="inline-block group cursor-pointer align-top">
                <summary class="text-repo-lightblue text-[10px] font-bold outline-none uppercase tracking-widest ml-1 hover:text-white transition">🔽</summary>
                <div class="block mt-2 pl-3 border-l-2 border-repo-blue text-gray-400 text-xs w-full mb-2">${escapeHtml(c.apps || '')}</div>
              </details>
            </div>
            <p><strong class="${titleClass} block mb-1">LIVE EXAMPLES IN THE WILD:</strong> ${c.wild || ''}</p>
            <div>
              <strong class="${titleClass}">MODIFICATIONS:</strong>
              <details class="inline-block group cursor-pointer align-top">
                <summary class="text-repo-lightblue text-[10px] font-bold outline-none uppercase tracking-widest ml-1 hover:text-white transition">🔽</summary>
                <div class="block mt-2 pl-3 border-l-2 border-repo-blue text-gray-400 text-xs w-full mb-2">${escapeHtml(c.mods || '')}</div>
              </details>
            </div>
            <p><strong class="${titleClass}">CODE RISK:</strong> ${codeRisk}</p>
          </div>
        </div>
        <div class="lg:w-1/2 component-sandbox-panel p-5 flex flex-col justify-between gap-4">
          <div>
            <span class="text-[10px] font-black text-repo-sand uppercase tracking-widest block mb-2">Live Sandbox</span>
            <div class="flex flex-col items-center justify-center p-6 bg-black border border-repo-sand/30 rounded-lg min-h-[150px] overflow-hidden">
              ${c.html || ''}
            </div>
          </div>
          <div class="border-t border-repo-sand/50 pt-3 space-y-3">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Prompt Customizer & Code Generator</span>
            <div class="text-[10px] text-repo-cream/65">Phase 1 captures the current generated prompt when this component is added to the builder.</div>
          </div>
          <div class="prompt-box p-3 rounded-lg relative mt-2">
            <p id="prompt-${c.id}" class="text-[10px] font-mono text-repo-cream/85 pr-14 leading-relaxed">${escapeHtml(c.prompt || '')}</p>
            <button data-copy-prompt="prompt-${c.id}" class="absolute right-2.5 bottom-2.5 text-repo-sand hover:text-repo-white font-bold text-[10px] tracking-widest">COPY</button>
          </div>
        </div>
      </section>`;
  }

  function buildArchitectureSection() {
    return `
      <section id="architecture-blueprint" class="scroll-mt-24 component-card p-6">
        <h2 class="text-xl font-black text-repo-salmon uppercase tracking-wider mb-4">📐 Naming & Color Tokens</h2>
        <div class="component-meta-panel p-4 text-sm text-repo-cream/85 space-y-4">
          <p><strong class="text-repo-blue">Purpose:</strong> This section keeps the shared language for describing UI patterns, colour roles, accessibility, and component behaviour so prompts stay consistent.</p>
          <p><strong class="text-repo-blue">Colour rule:</strong> red is for warning/attention, green is for active/on state, yellow/gold is for add/positive emphasis, blue is the main structural group colour.</p>
          <p><strong class="text-repo-blue">WCAG AA:</strong> Normal text should generally hit a 4.5:1 contrast ratio, while large/bold text can use 3:1. This prevents pretty but unreadable colour combinations.</p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="rounded p-3 border" style="background:#4b84bf;color:#fff;border-color:#7bb2db">Group Blue<br><code>#4b84bf</code></div>
            <div class="rounded p-3 border" style="background:#449e92;color:#fff;border-color:#56a29a">Top / Upper<br><code>#449e92</code></div>
            <div class="rounded p-3 border" style="background:#d27d6c;color:#181919;border-color:#df9f5e">Middle / Center<br><code>#d27d6c</code></div>
            <div class="rounded p-3 border" style="background:#9a2f4f;color:#fff;border-color:#d98276">Lower / Bottom<br><code>#9a2f4f</code></div>
          </div>
        </div>
      </section>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCatalogNav();
    renderComponents();
  });

  window.renderCatalogNav = renderCatalogNav;
  window.renderComponents = renderComponents;
  window.getComponentById = (id) => sortedComponents().find(c => c.id === String(id).padStart(2,'0') || c.id === String(id));
})();
