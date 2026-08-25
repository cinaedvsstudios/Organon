"use strict";

(function installSimpleEditKeyframeButtonFix() {
  const VERSION = "v0.11";
  document.title = `Organon — Simple Edit ${VERSION}`;
  const brand = document.querySelector(".brand");
  const badge = brand?.querySelector(".phase1-version, .simple-edit-version");
  if (badge) badge.textContent = VERSION;

  if (ui.scissorsBtn && ui.scissorsBtn.dataset.keyframeSplitBound !== "true") {
    ui.scissorsBtn.dataset.keyframeSplitBound = "true";
    ui.scissorsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      splitSelectedClip();
    }, true);
  }
})();
