(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v029-project';
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const $ = selector => document.querySelector(selector);
  const read = () => {
    try { return JSON.parse(localStorage.getItem(PROJECT_KEY) || '{"sections":[],"tracks":[]}'); }
    catch (_) { return { sections: [], tracks: [] }; }
  };
  const write = project => localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  let sectionMemory = structuredClone(read().sections || []);

  const refreshTimeline = () => {
    const host = $('#arrangement');
    if (host) host.append(document.createComment('refresh-sections'));
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.matches('#save')) {
      const preserved = structuredClone(sectionMemory);
      setTimeout(() => {
        const current = read();
        current.sections = preserved;
        write(current);
        refreshTimeline();
      }, 20);
      return;
    }

    if (button.matches('#addSection')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const project = read();
      const sections = project.sections || [];
      const name = prompt('Section name', `Section ${sections.length + 1}`);
      if (!name?.trim()) return;
      const start = sections.length ? Math.max(...sections.map(section => Number(section.end) || 0)) : 0;
      const next = {
        id: `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(), start, end: start + 8, color: COLORS[sections.length % COLORS.length]
      };
      sectionMemory = [...sections, next];
      project.sections = sectionMemory;
      write(project);
      refreshTimeline();
      return;
    }

    if (button.closest('#sectionMenu')) {
      setTimeout(() => {
        sectionMemory = structuredClone(read().sections || []);
        refreshTimeline();
      }, 20);
    }
  }, true);

  document.addEventListener('pointerup', () => {
    setTimeout(() => {
      sectionMemory = structuredClone(read().sections || []);
    }, 20);
  }, true);
})();