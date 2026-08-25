"use strict";

(function installSimpleEditLayoutFix() {
  const VERSION = "v0.14";
  const STYLE_ID = "simple-edit-layout-fix-style";

  function setVisibleVersion() {
    document.title = `Organon — Simple Edit ${VERSION}`;
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (!title) return;
    let badge = brand.querySelector(".phase1-version, .simple-edit-version");
    if (!badge) {
      badge = document.createElement("span");
      title.appendChild(badge);
    }
    badge.className = "phase1-version simple-edit-version";
    badge.textContent = VERSION;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .library-panel {
        border-right: 0 !important;
      }
      body.simple-edit-phase1 .workspace {
        position: relative;
      }
      body.simple-edit-phase1 .simple-edit-library-rule {
        position: absolute;
        top: 0;
        bottom: 0;
        left: var(--simple-edit-library-rule-x, 290px);
        width: 1px;
        background: linear-gradient(180deg, rgba(224,163,96,.9), rgba(224,163,96,.55), rgba(224,163,96,.82));
        box-shadow: 1px 0 0 rgba(0,0,0,.65), 0 0 8px rgba(224,163,96,.18);
        pointer-events: none;
        z-index: 96;
      }
      body.simple-edit-phase1 .echo-settings-btn {
        width: 36px;
        min-width: 36px;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      body.simple-edit-phase1 .phase1-effects-group .range-control + .echo-settings-btn {
        margin-left: -5px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLibraryRule() {
    const workspace = document.querySelector(".workspace");
    if (!workspace) return null;
    let rule = workspace.querySelector(".simple-edit-library-rule");
    if (!rule) {
      rule = document.createElement("div");
      rule.className = "simple-edit-library-rule";
      rule.setAttribute("aria-hidden", "true");
      workspace.appendChild(rule);
    }
    return rule;
  }

  function syncLibraryRule() {
    const workspace = document.querySelector(".workspace");
    const library = document.querySelector(".library-panel");
    if (!workspace || !library) return;
    ensureLibraryRule();
    const workspaceRect = workspace.getBoundingClientRect();
    const libraryRect = library.getBoundingClientRect();
    const x = Math.round(libraryRect.right - workspaceRect.left);
    workspace.style.setProperty("--simple-edit-library-rule-x", `${x}px`);
  }

  function ensureEchoSettingsButton() {
    if (document.getElementById("echoSettingsBtn")) return;
    const echoControl = ui.echoSlider?.closest(".range-control");
    if (!echoControl) return;
    const button = document.createElement("button");
    button.id = "echoSettingsBtn";
    button.type = "button";
    button.className = "icon-button echo-settings-btn";
    button.textContent = "⚙️";
    button.title = "Echo settings";
    button.addEventListener("click", () => showToast("Echo settings are planned for the echo preset phase."));
    echoControl.insertAdjacentElement("afterend", button);
  }

  installStyles();
  setVisibleVersion();
  ensureEchoSettingsButton();
  ensureLibraryRule();
  syncLibraryRule();
  window.addEventListener("resize", syncLibraryRule);
  window.addEventListener("load", syncLibraryRule);
  requestAnimationFrame(syncLibraryRule);
  setTimeout(syncLibraryRule, 160);
  setStatus("Ready — layout divider fixed");
})();
