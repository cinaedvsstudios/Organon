"use strict";

(function installOrgavoxV053ViewRestore() {
  const STYLE_ID = "orgavox-v053-view-restore-style";
  const VIEW_ID = "orgavoxViewDropdown";

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 #${VIEW_ID}.orgavox-view-dropdown{
        display:inline-flex!important;
        align-items:center!important;
        position:relative!important;
        visibility:visible!important;
        opacity:1!important;
        flex:0 0 auto!important;
        order:30!important;
      }
      body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-button{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        min-height:36px!important;
        border-color:rgba(117,178,222,.86)!important;
        background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;
        color:#e1f7ff!important;
        box-shadow:0 0 0 1px rgba(117,178,222,.2),0 0 14px rgba(75,155,255,.18)!important;
      }
      body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-menu{
        position:absolute!important;
        top:calc(100% + 8px)!important;
        left:0!important;
        z-index:4300!important;
        min-width:205px!important;
        display:grid!important;
        gap:6px!important;
        padding:8px!important;
        border:1px solid rgba(117,178,222,.68)!important;
        border-radius:14px!important;
        background:rgba(10,11,10,.98)!important;
        box-shadow:0 18px 44px rgba(0,0,0,.72)!important;
      }
      body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-menu[hidden]{display:none!important}
      body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-menu .tool-button{
        width:100%!important;
        justify-content:flex-start!important;
        min-height:32px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function tip(button, text) {
    if (!button || !text) return;
    button.title = text;
    button.setAttribute("aria-label", text);
  }

  function closeOtherMenus(panel) {
    document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((other) => {
      if (other !== panel) other.hidden = true;
    });
    document.querySelectorAll(".orgavox-edit-button,.orgavox-effects-dropdown-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function ensureViewShell() {
    let wrap = document.getElementById(VIEW_ID);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = VIEW_ID;
      wrap.className = "orgavox-view-dropdown";
      wrap.innerHTML = `<button class="tool-button orgavox-view-button" type="button" aria-expanded="false">👁 View ▾</button><div class="orgavox-view-menu" hidden></div>`;
    }
    wrap.classList.add("orgavox-view-dropdown");
    let button = wrap.querySelector(".orgavox-view-button");
    let panel = wrap.querySelector(".orgavox-view-menu");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "tool-button orgavox-view-button";
      wrap.prepend(button);
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "orgavox-view-menu";
      panel.hidden = true;
      wrap.appendChild(panel);
    }
    button.textContent = "👁 View ▾";
    tip(button, "Open marker, alignment and analysis tools");
    if (button.dataset.orgavoxV053ViewClick !== "true") {
      button.dataset.orgavoxV053ViewClick = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const open = panel.hidden;
        closeOtherMenus(panel);
        panel.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
      });
    }
    return { wrap, button, panel };
  }

  function openMarkersPanel() {
    const modal = document.getElementById("markersModal");
    if (!modal) return showToast("Markers panel is still loading.");
    modal.hidden = false;
    const input = modal.querySelector("[data-marker-name]");
    if (input && !input.value.trim()) input.value = `Marker ${(state.markers?.length || 0) + 1}`;
    window.orgavoxRenderMarkers?.();
    showToast("Markers panel opened.");
  }

  function ensurePanelButton(panel, id, label, title, handler) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "tool-button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        panel.hidden = true;
        handler();
      });
    }
    button.textContent = label;
    tip(button, title);
    if (button.parentElement !== panel) panel.appendChild(button);
    return button;
  }

  function refillViewMenu(panel) {
    ensurePanelButton(panel, "orgavoxMarkerPanelBtn", "🏷 Markers Panel", "Open marker names, colors and cue list", openMarkersPanel);

    if (ui.alignPlayheadBtn) {
      ui.alignPlayheadBtn.textContent = "⤓ Align to Playhead";
      tip(ui.alignPlayheadBtn, "Align selected clip start to the playhead");
      if (ui.alignPlayheadBtn.parentElement !== panel) panel.appendChild(ui.alignPlayheadBtn);
    }

    if (ui.analysisBtn) {
      ui.analysisBtn.textContent = "📈 Analyze";
      tip(ui.analysisBtn, "Analyze the selected clip");
      if (ui.analysisBtn.parentElement !== panel) panel.appendChild(ui.analysisBtn);
    }
  }

  function placeViewMenu() {
    if (typeof ui === "undefined") return;
    installStyles();
    window.orgavoxApplyMenuCleanup?.();
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return;
    const { wrap, panel } = ensureViewShell();
    const edit = document.getElementById("orgavoxEditDropdown");
    const effects = editGroup.querySelector(".orgavox-effects-dropdown");
    const reference = edit?.nextSibling || effects || editGroup.firstChild;
    if (wrap.parentElement !== editGroup || wrap.previousElementSibling !== edit) {
      editGroup.insertBefore(wrap, reference);
    }
    refillViewMenu(panel);
  }

  function installOutsideClose() {
    if (window.__orgavoxV053ViewOutsideClose) return;
    window.__orgavoxV053ViewOutsideClose = true;
    document.addEventListener("click", (event) => {
      const wrap = document.getElementById(VIEW_ID);
      if (!wrap || wrap.contains(event.target)) return;
      const panel = wrap.querySelector(".orgavox-view-menu");
      const button = wrap.querySelector(".orgavox-view-button");
      if (panel) panel.hidden = true;
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  function patchRender() {
    if (window.__orgavoxV053ViewRenderPatch) return;
    window.__orgavoxV053ViewRenderPatch = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxV053RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      placeViewMenu();
      return result;
    };
  }

  window.orgavoxRestoreViewMenu = placeViewMenu;
  installStyles();
  installOutsideClose();
  patchRender();
  placeViewMenu();
  setTimeout(placeViewMenu, 0);
  setTimeout(placeViewMenu, 200);
  setTimeout(placeViewMenu, 650);
})();
