(() => {
  'use strict';

  const E = window.OrganonAnimationAdvanced;
  if (!E) return;

  const { state, $ } = E;
  const blends = [
    ['source-over', 'Normal'], ['darken', 'Darken'], ['multiply', 'Multiply'], ['color-burn', 'Color Burn'],
    ['lighten', 'Lighten'], ['screen', 'Screen'], ['color-dodge', 'Color Dodge'], ['overlay', 'Overlay'],
    ['soft-light', 'Soft Light'], ['hard-light', 'Hard Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
    ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity']
  ];

  const supportedMedia = (files) => [...files].some((file) => E.isImageFile(file) || E.isVideoFile(file));

  const importToGroup = (files, groupId) => {
    if (!supportedMedia(files)) {
      E.status('Choose an image, animated GIF/WebP, or supported video file.');
      return;
    }
    if (typeof E.importMedia === 'function') {
      E.importMedia(files, groupId);
      return;
    }
    E.importImages([...files].filter(E.isImageFile), groupId);
  };

  const addDropHandlers = (host, groupId) => {
    const clear = () => host.classList.remove('is-dragover');

    host.addEventListener('dragenter', (event) => {
      if (!supportedMedia(event.dataTransfer?.files || [])) return;
      event.preventDefault();
      host.classList.add('is-dragover');
    });

    host.addEventListener('dragover', (event) => {
      if (!supportedMedia(event.dataTransfer?.files || [])) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      host.classList.add('is-dragover');
    });

    host.addEventListener('dragleave', (event) => {
      if (event.relatedTarget && host.contains(event.relatedTarget)) return;
      clear();
    });

    host.addEventListener('drop', (event) => {
      if (!supportedMedia(event.dataTransfer?.files || [])) return;
      event.preventDefault();
      clear();
      importToGroup(event.dataTransfer.files, groupId);
    });
  };

  const makeOption = (value, label, selected) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
  };

  E.renderGroups = () => {
    E.normalize();
    const host = $('ag-groups');
    host.replaceChildren();

    state.groups.forEach((group) => {
      const section = document.createElement('section');
      section.className = `ag-group ${group.id === state.activeGroupId ? 'active' : ''}`;

      const header = document.createElement('header');
      header.className = 'ag-group-head';

      const selectButton = document.createElement('button');
      selectButton.className = 'ag-btn';
      selectButton.type = 'button';
      selectButton.textContent = group.id === state.activeGroupId ? '●' : '○';
      selectButton.title = 'Select group';
      selectButton.addEventListener('click', () => E.setActive(group.id));

      const name = document.createElement('input');
      name.className = 'ag-group-name';
      name.type = 'text';
      name.value = group.name;
      name.setAttribute('aria-label', 'Group name');
      name.addEventListener('change', () => {
        group.name = name.value.trim() || group.name;
        E.renderAll();
      });

      const count = document.createElement('span');
      count.className = 'ag-group-count';
      count.textContent = `${group.frames.length} FRAME${group.frames.length === 1 ? '' : 'S'}`;

      const blend = document.createElement('select');
      blend.className = 'ag-pill';
      blend.setAttribute('aria-label', 'Blend mode');
      blends.forEach(([value, label]) => blend.appendChild(makeOption(value, label, group.blend === value)));
      blend.addEventListener('change', () => {
        group.blend = blend.value;
        E.renderCanvas();
      });

      const layer = document.createElement('select');
      layer.className = 'ag-pill';
      layer.setAttribute('aria-label', 'Layer order');
      state.groups.forEach((_, index) => {
        const number = index + 1;
        layer.appendChild(makeOption(String(number), `LAYER ${number}${index === 0 ? ' — TOP' : ''}`, group.layer === number));
      });
      layer.addEventListener('change', () => {
        const ordered = [...state.groups].sort((left, right) => left.layer - right.layer);
        const from = ordered.indexOf(group);
        const to = E.clamp(Number(layer.value) - 1, 0, ordered.length - 1);
        ordered.splice(from, 1);
        ordered.splice(to, 0, group);
        ordered.forEach((item, index) => { item.layer = index + 1; });
        E.renderAll();
      });

      const remove = document.createElement('button');
      remove.className = 'ag-btn danger';
      remove.type = 'button';
      remove.textContent = 'REMOVE';
      remove.addEventListener('click', () => {
        if (state.groups.length === 1) {
          group.frames = [];
          state.activeFrameId = null;
        } else {
          state.groups = state.groups.filter((item) => item !== group);
          state.activeGroupId = state.groups[0].id;
          state.activeFrameId = state.groups[0].frames[0]?.id || null;
        }
        state.editCache = null;
        E.renderAll();
      });

      header.append(selectButton, name, count, blend, layer, remove);

      const frames = document.createElement('div');
      frames.className = 'ag-frames';
      addDropHandlers(frames, group.id);

      if (!group.frames.length) {
        const empty = document.createElement('button');
        empty.className = 'ag-empty';
        empty.type = 'button';
        empty.textContent = 'CLICK OR DROP IMAGE / GIF / WEBP / VIDEO FILES INTO THIS GROUP';
        empty.addEventListener('click', () => E.openImportPicker(group.id));
        frames.appendChild(empty);
      }

      group.frames.forEach((frame, index) => {
        const tile = document.createElement('div');
        tile.className = `ag-thumb ${group.id === state.activeGroupId && frame.id === state.activeFrameId ? 'active' : ''}`;
        tile.setAttribute('role', 'button');
        tile.tabIndex = 0;

        const image = document.createElement('img');
        image.src = frame.working;
        image.alt = frame.name;

        const number = document.createElement('span');
        number.textContent = String(index + 1);

        const removeFrame = document.createElement('button');
        removeFrame.type = 'button';
        removeFrame.title = 'Delete frame';
        removeFrame.textContent = '×';
        removeFrame.addEventListener('click', (event) => {
          event.stopPropagation();
          group.frames = group.frames.filter((item) => item.id !== frame.id);
          if (state.activeFrameId === frame.id) state.activeFrameId = group.frames[0]?.id || null;
          state.editCache = null;
          E.renderAll();
        });

        const selectFrame = () => E.setActive(group.id, frame.id);
        tile.addEventListener('click', selectFrame);
        tile.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectFrame();
          }
        });

        tile.append(image, number, removeFrame);
        frames.appendChild(tile);
      });

      section.append(header, frames);
      host.appendChild(section);
    });
  };

  $('ag-new-group').addEventListener('click', () => {
    const group = E.addGroup();
    state.effectTargets = new Set([group.id]);
    state.animationTargets = new Set([group.id]);
    E.status(`${group.name} created.`);
    E.renderAll();
  });

  $('ag-mode-switch').addEventListener('click', () => {
    location.href = '../animation-maker-standard/index.html';
  });
})();
