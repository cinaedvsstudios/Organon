"use strict";

(async () => {
  const files = [
    "./simple-edit-core.js?v=0.01",
    "./simple-edit-timeline.js?v=0.01",
    "./simple-edit-audio.js?v=0.01",
    "./simple-edit-export.js?v=0.02",
    "./simple-edit-phase1.js?v=0.12",
    "./simple-edit-keyframes.js?v=0.10",
    "./simple-edit-keyframes-fix.js?v=0.11",
    "./simple-edit-phase3.js?v=0.13",
    "./simple-edit-layout-fix.js?v=0.14",
    "./simple-edit-effects-library.js?v=0.15"
  ];
  for (const source of files) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.head.appendChild(script);
    });
  }
})().catch((error) => {
  console.error(error);
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "Editor failed to load";
});
