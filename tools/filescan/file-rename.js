"use strict";

const $ = (selector) => document.querySelector(selector);

const ui = {
  moduleSelect: $("#moduleSelect"),
  filePicker: $("#filePicker"),
  addFiles: $("#addFiles"),
  fileStatus: $("#fileStatus"),
  fileList: $("#fileList"),
  selectionCount: $("#selectionCount"),
  summaryText: $("#summaryText"),
  listLabel: $("#listLabel"),
  totalLabel: $("#totalLabel"),
  toast: $("#toast"),
  postControls: $("#postControls"),
  filterInput: $("#filterInput"),
  sortSelect: $("#sortSelect"),
  selectAll: $("#selectAll"),
  clearAll: $("#clearAll"),
  invert: $("#invert"),
  openRename: $("#openRename"),
  reset: $("#reset"),
  downloadZip: $("#downloadZip"),
  renameModal: $("#renameModal"),
  renameClose: $("#renameClose"),
  renameCancel: $("#renameCancel"),
  renameSave: $("#renameSave"),
  sequenceBaseName: $("#sequenceBaseName"),
  applySequence: $("#applySequence"),
  renameStatus: $("#renameStatus"),
  renameList: $("#renameList")
};

const state = {
  files: [],
  filterText: "",
  sortMode: "current",
  renameDraft: null,
  renameDragId: null,
  renamePointerTargetId: null,
  toastTimer: null
};

function setHubStatus(text) {
  window.parent?.postMessage?.({ type: "set-status", text }, "*");
}

function clearHubStatus() {
  window.parent?.postMessage?.({ type: "clear-status" }, "*");
}

function flash(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

function makeId(index) {
  return `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
}

function extensionParts(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { base: name, extension: "", type: "NO EXTENSION" };
  return {
    base: name.slice(0, dot),
    extension: name.slice(dot),
    type: name.slice(dot + 1).toUpperCase()
  };
}

function safeBaseName(value) {
  const source = String(value || "").trim();
  const withoutExtension = extensionParts(source).base;
  return withoutExtension
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "file";
}

function isImageFile(file) {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name);
}

function makeItem(file, index) {
  const parts = extensionParts(file.name);
  return {
    id: makeId(index),
    file,
    originalName: file.name,
    exportName: file.name,
    originalIndex: index,
    selected: true,
    type: parts.type,
    previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null
  };
}

function revokePreviews() {
  state.files.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
}

function filtered() {
  const query = state.filterText.trim().toLocaleLowerCase();
  return query
    ? state.files.filter((item) =>
        item.originalName.toLocaleLowerCase().includes(query) ||
        item.exportName.toLocaleLowerCase().includes(query))
    : state.files;
}

function sorted(items) {
  const copy = [...items];
  const nameCompare = (a, b) => a.exportName.localeCompare(b.exportName, undefined, { numeric: true, sensitivity: "base" });
  const typeCompare = (a, b) => a.type.localeCompare(b.type, undefined, { numeric: true, sensitivity: "base" }) || nameCompare(a, b);

  if (state.sortMode === "name-asc") copy.sort(nameCompare);
  if (state.sortMode === "name-desc") copy.sort((a, b) => nameCompare(b, a));
  if (state.sortMode === "type-asc") copy.sort(typeCompare);
  if (state.sortMode === "type-desc") copy.sort((a, b) => typeCompare(b, a));
  return copy;
}

function visible() {
  return sorted(filtered());
}

function selectedFiles() {
  return state.files.filter((item) => item.selected);
}

function createRow(item) {
  const label = document.createElement("label");
  label.className = "file";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = item.selected;
  check.addEventListener("change", () => {
    item.selected = check.checked;
    update();
  });

  const index = document.createElement("span");
  index.className = "file-index";
  index.textContent = String(state.files.indexOf(item) + 1).padStart(2, "0");

  const wrap = document.createElement("span");
  wrap.className = "file-name-wrap";

  const name = document.createElement("span");
  name.className = "file-name";
  name.title = item.exportName;
  name.textContent = item.exportName;
  wrap.appendChild(name);

  if (item.exportName !== item.originalName) {
    const original = document.createElement("span");
    original.className = "file-original";
    original.title = item.originalName;
    original.textContent = `Original: ${item.originalName}`;
    wrap.appendChild(original);
  }

  label.append(check, index, wrap);
  return label;
}

function render(items) {
  ui.fileList.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.files.length
      ? "No files match this filter."
      : "Choose files above. Only the files you select will be loaded.";
    ui.fileList.appendChild(empty);
    return;
  }

  items.forEach((item) => ui.fileList.appendChild(createRow(item)));
}

function update() {
  const visibleItems = visible();
  const selected = selectedFiles();
  const hasFiles = state.files.length > 0;
  const renamed = state.files.filter((item) => item.exportName !== item.originalName).length;

  ui.selectionCount.textContent = `${selected.length} selected`;
  ui.totalLabel.textContent = `${visibleItems.length} shown`;
  ui.listLabel.textContent = "Current filenames";
  ui.fileStatus.textContent = hasFiles ? `${state.files.length} files loaded` : "No files listed";
  ui.summaryText.textContent = hasFiles
    ? `${state.files.length} file${state.files.length === 1 ? "" : "s"} loaded.${renamed ? ` ${renamed} renamed.` : " Names are still unchanged."}${state.filterText.trim() ? ` ${visibleItems.length} match the filter.` : ""}`
    : "Choose the files you want to rename and package into a ZIP.";

  ui.postControls.classList.toggle("show", hasFiles);
  [ui.selectAll, ui.clearAll, ui.invert, ui.reset].forEach((button) => {
    button.disabled = !hasFiles;
  });
  ui.openRename.disabled = selected.length === 0;
  ui.downloadZip.disabled = selected.length === 0;

  render(visibleItems);
}

function loadFiles(fileList) {
  const supplied = Array.from(fileList || []);
  if (!supplied.length) return;

  revokePreviews();
  state.files = supplied.map(makeItem);
  state.filterText = "";
  state.sortMode = "current";
  state.renameDraft = null;
  ui.filterInput.value = "";
  ui.sortSelect.value = "current";
  update();

  setHubStatus(`File Rename loaded ${state.files.length} selected local files.`);
  setTimeout(clearHubStatus, 2200);
  flash(`${state.files.length} file${state.files.length === 1 ? "" : "s"} added.`);
}

function resetFiles() {
  if (!state.files.length) return;
  state.files.sort((a, b) => a.originalIndex - b.originalIndex);
  state.files.forEach((item) => {
    item.exportName = item.originalName;
    item.selected = true;
  });
  state.filterText = "";
  state.sortMode = "current";
  ui.filterInput.value = "";
  ui.sortSelect.value = "current";
  update();
  flash("Original filenames and selection order restored.");
}

function getDraftAsset(id) {
  return state.files.find((item) => item.id === id) || null;
}

function openRenameDialog() {
  const selected = selectedFiles();
  if (!selected.length) {
    flash("Select at least one file first.");
    return;
  }

  state.renameDraft = selected.map((item) => ({
    id: item.id,
    proposedName: item.exportName
  }));
  ui.sequenceBaseName.value = "";
  ui.renameStatus.textContent = "Names are not changed until you press Save.";
  renderRenameList();
  ui.renameModal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => ui.sequenceBaseName.focus(), 0);
}

function closeRenameDialog() {
  ui.renameModal.hidden = true;
  document.body.style.overflow = "";
  state.renameDraft = null;
  state.renameDragId = null;
  state.renamePointerTargetId = null;
}

function moveDraftItem(id, targetIndex) {
  if (!state.renameDraft) return;
  const fromIndex = state.renameDraft.findIndex((entry) => entry.id === id);
  if (fromIndex < 0) return;
  const [entry] = state.renameDraft.splice(fromIndex, 1);
  let adjusted = Math.max(0, Math.min(targetIndex, state.renameDraft.length));
  if (fromIndex < targetIndex) adjusted -= 1;
  adjusted = Math.max(0, Math.min(adjusted, state.renameDraft.length));
  state.renameDraft.splice(adjusted, 0, entry);
}

function moveDraftByOffset(id, offset) {
  if (!state.renameDraft) return;
  const index = state.renameDraft.findIndex((entry) => entry.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= state.renameDraft.length) return;
  const [entry] = state.renameDraft.splice(index, 1);
  state.renameDraft.splice(target, 0, entry);
  renderRenameList();
}

function createPreview(asset) {
  if (asset.previewUrl) {
    const image = document.createElement("img");
    image.className = "rename-thumb";
    image.src = asset.previewUrl;
    image.alt = asset.originalName;
    return image;
  }

  const icon = document.createElement("div");
  icon.className = "rename-file-icon";
  icon.textContent = asset.type;
  return icon;
}

function renderRenameList() {
  ui.renameList.replaceChildren();
  if (!state.renameDraft) return;

  state.renameDraft.forEach((entry, index) => {
    const asset = getDraftAsset(entry.id);
    if (!asset) return;

    const item = document.createElement("div");
    item.className = "rename-item";
    item.dataset.id = entry.id;
    item.draggable = true;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "rename-drag-handle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-label", `Drag ${asset.originalName}`);

    const preview = createPreview(asset);

    const info = document.createElement("div");
    info.className = "rename-file-info";

    const original = document.createElement("div");
    original.className = "rename-original";
    const position = document.createElement("span");
    position.className = "rename-position";
    position.textContent = String(index + 1).padStart(2, "0");
    const originalText = document.createElement("span");
    originalText.textContent = asset.originalName;
    original.append(position, originalText);

    const proposed = document.createElement("div");
    proposed.className = "rename-proposed";
    proposed.textContent = entry.proposedName;
    info.append(original, proposed);

    const moveButtons = document.createElement("div");
    moveButtons.className = "rename-move-buttons";

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.title = "Move up";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveDraftByOffset(entry.id, -1));

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.title = "Move down";
    down.disabled = index === state.renameDraft.length - 1;
    down.addEventListener("click", () => moveDraftByOffset(entry.id, 1));

    moveButtons.append(up, down);
    item.append(handle, preview, info, moveButtons);

    item.addEventListener("dragstart", (event) => {
      state.renameDragId = entry.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", entry.id);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      state.renameDragId = null;
      document.querySelectorAll(".rename-item").forEach((node) => node.classList.remove("dragging", "drop-target"));
    });
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      item.classList.add("drop-target");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drop-target"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedId = state.renameDragId || event.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === entry.id) return;
      const rect = item.getBoundingClientRect();
      let targetIndex = state.renameDraft.findIndex((draftItem) => draftItem.id === entry.id);
      if (event.clientY > rect.top + rect.height / 2) targetIndex += 1;
      moveDraftItem(draggedId, targetIndex);
      state.renameDragId = null;
      renderRenameList();
    });

    handle.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      state.renameDragId = entry.id;
      state.renamePointerTargetId = entry.id;
      handle.setPointerCapture(event.pointerId);
      item.classList.add("dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!state.renameDragId || event.pointerType === "mouse") return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".rename-item");
      document.querySelectorAll(".rename-item").forEach((node) => node.classList.remove("drop-target"));
      if (target) {
        state.renamePointerTargetId = target.dataset.id;
        target.classList.add("drop-target");
      }
    });

    const finishPointerDrag = (event) => {
      if (!state.renameDragId || event.pointerType === "mouse") return;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      const draggedId = state.renameDragId;
      const targetId = state.renamePointerTargetId;
      if (targetId && targetId !== draggedId) {
        const targetIndex = state.renameDraft.findIndex((draftItem) => draftItem.id === targetId);
        moveDraftItem(draggedId, targetIndex);
      }
      state.renameDragId = null;
      state.renamePointerTargetId = null;
      renderRenameList();
    };

    handle.addEventListener("pointerup", finishPointerDrag);
    handle.addEventListener("pointercancel", finishPointerDrag);

    ui.renameList.appendChild(item);
  });
}

function applySequenceNames() {
  if (!state.renameDraft) return;
  const rawBase = ui.sequenceBaseName.value.trim();
  if (!rawBase) {
    ui.renameStatus.textContent = "Enter a sequence name before pressing Apply.";
    ui.sequenceBaseName.focus();
    return;
  }

  const base = safeBaseName(rawBase);
  const digits = Math.max(2, String(state.renameDraft.length).length);
  state.renameDraft.forEach((entry, index) => {
    const asset = getDraftAsset(entry.id);
    const extension = asset ? extensionParts(asset.originalName).extension : "";
    entry.proposedName = `${base}_${String(index + 1).padStart(digits, "0")}${extension}`;
  });

  ui.renameStatus.textContent = `Applied “${base}” to ${state.renameDraft.length} files. Reorder and press Apply again to recalculate the numbers.`;
  renderRenameList();
}

function saveRenameSequence() {
  if (!state.renameDraft) return;

  const selectedIds = new Set(state.renameDraft.map((entry) => entry.id));
  const selectedSlots = state.files
    .map((item, index) => selectedIds.has(item.id) ? index : -1)
    .filter((index) => index >= 0);
  const fileMap = new Map(state.files.map((item) => [item.id, item]));

  state.renameDraft.forEach((entry) => {
    const asset = fileMap.get(entry.id);
    if (asset) asset.exportName = entry.proposedName;
  });

  const reorderedSelected = state.renameDraft.map((entry) => fileMap.get(entry.id)).filter(Boolean);
  selectedSlots.forEach((slot, index) => {
    state.files[slot] = reorderedSelected[index];
  });

  state.sortMode = "current";
  ui.sortSelect.value = "current";
  closeRenameDialog();
  update();
  flash("File order and renamed filenames saved.");
}

function uniqueZipName(name, used) {
  if (!used.has(name.toLocaleLowerCase())) {
    used.add(name.toLocaleLowerCase());
    return name;
  }

  const parts = extensionParts(name);
  let counter = 2;
  let candidate = `${parts.base}_${counter}${parts.extension}`;
  while (used.has(candidate.toLocaleLowerCase())) {
    counter += 1;
    candidate = `${parts.base}_${counter}${parts.extension}`;
  }
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadZip() {
  const selected = selectedFiles();
  if (!selected.length) {
    flash("Select at least one file first.");
    return;
  }
  if (typeof JSZip === "undefined") {
    flash("ZIP support is unavailable in this browser.");
    return;
  }

  const originalText = ui.downloadZip.textContent;
  ui.downloadZip.disabled = true;
  ui.downloadZip.textContent = "Building ZIP…";

  try {
    const zip = new JSZip();
    const used = new Set();
    selected.forEach((item) => {
      zip.file(uniqueZipName(item.exportName, used), item.file);
    });
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    downloadBlob(blob, "renamed-files.zip");
    flash(`${selected.length} renamed file${selected.length === 1 ? "" : "s"} downloaded in a ZIP.`);
  } catch (error) {
    console.error(error);
    flash("The ZIP could not be created.");
  } finally {
    ui.downloadZip.textContent = originalText;
    ui.downloadZip.disabled = selectedFiles().length === 0;
  }
}

ui.moduleSelect.addEventListener("change", () => {
  if (ui.moduleSelect.value === "filescan") window.location.href = "./index.html";
});
ui.addFiles.addEventListener("click", () => ui.filePicker.click());
ui.filePicker.addEventListener("change", (event) => {
  loadFiles(event.target.files);
  event.target.value = "";
});
ui.filterInput.addEventListener("input", (event) => {
  state.filterText = event.target.value;
  update();
});
ui.sortSelect.addEventListener("change", (event) => {
  state.sortMode = event.target.value;
  update();
});
ui.selectAll.addEventListener("click", () => {
  visible().forEach((item) => { item.selected = true; });
  update();
});
ui.clearAll.addEventListener("click", () => {
  visible().forEach((item) => { item.selected = false; });
  update();
});
ui.invert.addEventListener("click", () => {
  visible().forEach((item) => { item.selected = !item.selected; });
  update();
});
ui.openRename.addEventListener("click", openRenameDialog);
ui.reset.addEventListener("click", resetFiles);
ui.downloadZip.addEventListener("click", downloadZip);
ui.renameClose.addEventListener("click", closeRenameDialog);
ui.renameCancel.addEventListener("click", closeRenameDialog);
ui.renameSave.addEventListener("click", saveRenameSequence);
ui.applySequence.addEventListener("click", applySequenceNames);
ui.sequenceBaseName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applySequenceNames();
});
ui.renameModal.addEventListener("click", (event) => {
  if (event.target === ui.renameModal) closeRenameDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.renameModal.hidden) closeRenameDialog();
});

ui.addFiles.addEventListener("mouseenter", () => setHubStatus("Choose the exact local files to load into File Rename."));
ui.openRename.addEventListener("mouseenter", () => setHubStatus("Open the sequence rename window for the selected files."));
ui.reset.addEventListener("mouseenter", () => setHubStatus("Restore the original filenames and original selection order."));
ui.downloadZip.addEventListener("mouseenter", () => setHubStatus("Download renamed copies without changing the original files."));
document.querySelectorAll("button,input,select").forEach((element) => element.addEventListener("mouseleave", clearHubStatus));
window.addEventListener("beforeunload", revokePreviews);

update();
