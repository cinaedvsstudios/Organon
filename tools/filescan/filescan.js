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
  group: $("#group"),
  copy: $("#copy"),
  txt: $("#txt"),
  csv: $("#csv")
};

const state = {
  files: [],
  filterText: "",
  sortMode: "original",
  groupByType: false,
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
  state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2600);
}

function extensionFor(name) {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : "NO EXTENSION";
}

function makeItem(file, index) {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    file,
    index,
    selected: true,
    type: extensionFor(file.name),
    name: file.name
  };
}

function filtered() {
  const query = state.filterText.trim().toLocaleLowerCase();
  return query
    ? state.files.filter((item) => item.name.toLocaleLowerCase().includes(query))
    : state.files;
}

function sorted(items) {
  const copy = [...items];
  const nameCompare = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
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

function selectedForOutput() {
  return sorted(state.files.filter((item) => item.selected));
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

  const name = document.createElement("span");
  name.className = "file-name";
  name.title = item.name;
  name.textContent = item.name;

  label.append(check, name);
  return label;
}

function render(items) {
  ui.fileList.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.files.length
      ? "No files match this filter."
      : "Choose files above. Selected files will be checked by default.";
    ui.fileList.appendChild(empty);
    return;
  }

  if (!state.groupByType) {
    items.forEach((item) => ui.fileList.appendChild(createRow(item)));
    return;
  }

  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  });

  groups.forEach((groupItems, type) => {
    const group = document.createElement("section");
    group.className = "file-group";

    const divider = document.createElement("div");
    divider.className = "type-divider";
    const label = document.createElement("span");
    label.textContent = `${type} · ${groupItems.length}`;
    divider.appendChild(label);
    group.appendChild(divider);

    groupItems.forEach((item) => group.appendChild(createRow(item)));
    ui.fileList.appendChild(group);
  });
}

function update() {
  const visibleItems = visible();
  const selectedItems = selectedForOutput();
  const hasFiles = state.files.length > 0;

  ui.selectionCount.textContent = `${selectedItems.length} selected`;
  ui.totalLabel.textContent = `${visibleItems.length} shown`;
  ui.listLabel.textContent = "Selected files";
  ui.fileStatus.textContent = hasFiles ? `${state.files.length} files loaded` : "No files listed";
  ui.summaryText.textContent = hasFiles
    ? `${state.files.length} file${state.files.length === 1 ? "" : "s"} loaded from the file picker.${state.filterText.trim() ? ` ${visibleItems.length} match the filter.` : ""}`
    : "Choose individual files to build a selectable filename list.";

  ui.postControls.classList.toggle("show", hasFiles);
  [ui.selectAll, ui.clearAll, ui.invert, ui.group, ui.copy, ui.txt, ui.csv].forEach((button) => {
    button.disabled = !hasFiles;
  });
  ui.copy.disabled = selectedItems.length === 0;
  ui.txt.disabled = selectedItems.length === 0;
  ui.csv.disabled = selectedItems.length === 0;
  ui.group.classList.toggle("active", state.groupByType);
  ui.group.textContent = `Group: ${state.groupByType ? "on" : "off"}`;

  render(visibleItems);
}

function loadFiles(fileList) {
  const supplied = Array.from(fileList || []);
  if (!supplied.length) return;

  state.files = supplied.map(makeItem);
  state.filterText = "";
  state.sortMode = "original";
  state.groupByType = false;
  ui.filterInput.value = "";
  ui.sortSelect.value = "original";
  update();

  setHubStatus(`FileScan listed ${state.files.length} selected local files.`);
  setTimeout(clearHubStatus, 2200);
  flash(`${state.files.length} file${state.files.length === 1 ? "" : "s"} added.`);
}

function selectedText() {
  return selectedForOutput().map((item) => item.name).join("\n");
}

async function copyNames() {
  const text = selectedText();
  if (!text) {
    flash("Select at least one file first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;left:-9999px;top:-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  const count = selectedForOutput().length;
  flash(`${count} filename${count === 1 ? "" : "s"} copied.`);
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

ui.moduleSelect.addEventListener("change", () => {
  if (ui.moduleSelect.value === "file-rename") window.location.href = "./file-rename.html";
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
ui.group.addEventListener("click", () => {
  state.groupByType = !state.groupByType;
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
ui.copy.addEventListener("click", copyNames);
ui.txt.addEventListener("click", () => {
  const text = selectedText();
  if (!text) {
    flash("Select at least one file first.");
    return;
  }
  download(`filescan-${stamp()}.txt`, `${text}\n`, "text/plain;charset=utf-8");
  flash("TXT exported.");
});
ui.csv.addEventListener("click", () => {
  const items = selectedForOutput();
  if (!items.length) {
    flash("Select at least one file first.");
    return;
  }
  const csv = ["filename", ...items.map((item) => `"${item.name.replaceAll('"', '""')}"`)].join("\r\n") + "\r\n";
  download(`filescan-${stamp()}.csv`, csv, "text/csv;charset=utf-8");
  flash("CSV exported.");
});

ui.addFiles.addEventListener("mouseenter", () => setHubStatus("Choose one or more local files to add to FileScan."));
ui.filterInput.addEventListener("mouseenter", () => setHubStatus("Filter the visible filename list."));
ui.sortSelect.addEventListener("mouseenter", () => setHubStatus("Choose how the filename list is sorted."));
ui.group.addEventListener("mouseenter", () => setHubStatus("Separate the list with file-type divider headings."));
document.querySelectorAll("button,input,select").forEach((element) => element.addEventListener("mouseleave", clearHubStatus));

update();
