"use strict";

(() => {
  let selectedFolderName = "";

  ui.addFiles.textContent = "Add folder to list";
  ui.filePicker.setAttribute("webkitdirectory", "");
  ui.filePicker.setAttribute("directory", "");
  ui.filePicker.setAttribute("multiple", "");
  ui.fileStatus.textContent = "No folder listed";

  const originalUpdate = update;
  update = function updateFolderMode() {
    originalUpdate();

    if (!selectedFolderName) {
      ui.fileStatus.textContent = "No folder listed";
      if (!state.files.length) {
        ui.summaryText.textContent = "Choose a folder to load its top-level files for renaming.";
      }
      return;
    }

    ui.fileStatus.textContent = `${selectedFolderName} · ${state.files.length} file${state.files.length === 1 ? "" : "s"}`;
    if (!state.files.length) {
      ui.summaryText.textContent = "No files were found directly inside this folder. Subfolders are disabled in File Rename.";
    } else {
      const renamed = state.files.filter((item) => item.exportName !== item.originalName).length;
      const visibleCount = visible().length;
      ui.summaryText.textContent = `${state.files.length} direct file${state.files.length === 1 ? "" : "s"} loaded.${renamed ? ` ${renamed} renamed.` : " Names are still unchanged."}${state.filterText.trim() ? ` ${visibleCount} match the filter.` : ""}`;
      ui.listLabel.textContent = "Files in selected folder";
    }
  };

  ui.moduleSelect.addEventListener("change", (event) => {
    if (ui.moduleSelect.value !== "filescan") return;
    event.stopImmediatePropagation();
    window.location.href = "./index.html?v=0.03";
  }, true);

  ui.filePicker.addEventListener("change", (event) => {
    event.stopImmediatePropagation();

    const supplied = Array.from(event.target.files || []);
    if (!supplied.length) return;

    const firstPath = (supplied[0].webkitRelativePath || supplied[0].name).replaceAll("\\", "/");
    selectedFolderName = firstPath.split("/").filter(Boolean)[0] || "Selected folder";

    const directFiles = supplied.filter((file) => {
      const rawPath = (file.webkitRelativePath || file.name).replaceAll("\\", "/");
      const parts = rawPath.split("/").filter(Boolean);
      return parts.length <= 2;
    });

    event.target.value = "";

    if (!directFiles.length) {
      revokePreviews();
      state.files = [];
      state.filterText = "";
      state.sortMode = "current";
      state.renameDraft = null;
      ui.filterInput.value = "";
      ui.sortSelect.value = "current";
      update();
      flash("No direct files were found. Subfolders are not included.");
      return;
    }

    loadFiles(directFiles);
    update();
    setHubStatus(`File Rename loaded ${directFiles.length} direct files from ${selectedFolderName}.`);
    setTimeout(clearHubStatus, 2200);
  }, true);

  ui.addFiles.addEventListener("mouseenter", () => {
    setHubStatus("Choose one local folder. File Rename loads only the files directly inside it.");
  });

  update();
})();
