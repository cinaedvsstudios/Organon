"use strict";

(function installSimpleEditPhaseOne() {
  const TRACK_COUNT = 10;
  const PHASE_STYLE_ID = "simple-edit-phase1-style";
  const PHASE_VERSION = window.ORGAVOX_VERSION || "v0.31";

  const clampTrack = (track) => Math.max(0, Math.min(TRACK_COUNT - 1, Number(track) || 0));

  function installPhaseStyles() {
    document.getElementById(PHASE_STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = PHASE_STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 {
        --topbar-h: 144px;
        --controls-h: 0px;
        --orgavox-sidebar-w: 288px;
        --orgavox-line: rgba(224,163,96,.72);
        --lane-h: clamp(88px, calc((100vh - var(--topbar-h) - 70px) / 6), 132px);
      }
      body.simple-edit-phase1 .app {
        height: 100vh;
        grid-template-rows: var(--topbar-h) 0px minmax(0, 1fr) !important;
        overflow: hidden;
      }
      body.simple-edit-phase1 .topbar {
        display: flex !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        gap: 18px !important;
        min-height: var(--topbar-h) !important;
        height: var(--topbar-h) !important;
        padding: 12px 16px 11px !important;
        overflow: visible !important;
      }
      body.simple-edit-phase1 .brand {
        flex: 0 0 238px !important;
        min-width: 238px !important;
        max-width: 238px !important;
        display: flex !important;
        align-items: flex-start !important;
        gap: 12px !important;
        padding-top: 4px;
      }
      body.simple-edit-phase1 .brand .brand-mark {
        flex: 0 0 auto;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        font-size: 1.45rem !important;
      }
      body.simple-edit-phase1 .brand > div:not(.brand-mark) {
        min-width: 0;
        display: grid;
        gap: 0;
      }
      body.simple-edit-phase1 .brand h1 {
        display: flex;
        align-items: baseline;
        gap: 9px;
        margin: 0;
        line-height: 1;
        white-space: nowrap;
        color: var(--stone-ochre) !important;
      }
      body.simple-edit-phase1 .phase1-version,
      body.simple-edit-phase1 .simple-edit-version {
        color: #63b8ff !important;
        display: inline-flex;
        align-items: baseline;
        font: 700 .68rem var(--font-mono) !important;
        letter-spacing: .08em;
        line-height: 1 !important;
        margin: 0 0 0 8px !important;
        position: static !important;
        text-transform: uppercase;
        transform: none !important;
        vertical-align: baseline;
        white-space: nowrap;
      }
      body.simple-edit-phase1 .brand p {
        margin: 4px 0 0;
        display: block !important;
      }
      body.simple-edit-phase1 .orgavox-brand-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 9px;
      }
      body.simple-edit-phase1 .orgavox-brand-actions .tool-button {
        min-height: 34px !important;
        padding: 8px 12px !important;
      }
      body.simple-edit-phase1 .phase1-top-effects {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-rows: auto !important;
        align-content: start !important;
        gap: 0 !important;
        padding-top: 16px !important;
      }
      body.simple-edit-phase1 .phase1-top-effects > .phase1-divider,
      body.simple-edit-phase1 .phase1-top-effects > .phase1-tool-group:not(.orgavox-group) {
        display: none !important;
      }
      body.simple-edit-phase1 .orgavox-toolbar-row,
      body.simple-edit-phase1 .orgavox-effects-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        flex-wrap: wrap;
        width: 100%;
        min-width: 0;
      }
      body.simple-edit-phase1 .orgavox-effects-row { display: none !important; }
      body.simple-edit-phase1 .orgavox-group {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-width: 0;
      }
      body.simple-edit-phase1 .orgavox-transport-group { flex-wrap: nowrap; }
      body.simple-edit-phase1 .orgavox-main-controls-group {
        flex: 1 1 auto;
        min-width: 0;
      }
      body.simple-edit-phase1 .orgavox-divider,
      body.simple-edit-phase1 .phase1-divider {
        flex: 0 0 1px;
        width: 1px;
        min-height: 34px;
        align-self: stretch;
        background: linear-gradient(180deg, transparent, var(--orgavox-line), transparent);
        margin: 0 6px;
      }
      body.simple-edit-phase1 .transport,
      body.simple-edit-phase1 .toolbar-actions { display: contents; }
      body.simple-edit-phase1 .clip-controls { display: none !important; }
      body.simple-edit-phase1 .phase1-timeline-toolbar,
      body.simple-edit-phase1 .timeline-topline,
      body.simple-edit-phase1 .phase1-workspace-rule { display: none !important; }

      body.simple-edit-phase1 .topbar .range-control,
      body.simple-edit-phase1 .orgavox-toolbar-row .range-control,
      body.simple-edit-phase1 .orgavox-effects-row .range-control {
        min-width: 158px !important;
        grid-template-columns: auto minmax(60px, 96px) 42px !important;
        gap: 7px !important;
      }
      body.simple-edit-phase1 .topbar .range-control span,
      body.simple-edit-phase1 .orgavox-toolbar-row .range-control span,
      body.simple-edit-phase1 .orgavox-effects-row .range-control span { white-space: nowrap; }
      body.simple-edit-phase1 .topbar .tool-button,
      body.simple-edit-phase1 .topbar .icon-button,
      body.simple-edit-phase1 .timeline-topline .tool-button,
      body.simple-edit-phase1 .timeline-topline .icon-button {
        min-height: 36px;
      }
      body.simple-edit-phase1 .topbar .tool-button,
      body.simple-edit-phase1 .timeline-topline .tool-button {
        padding: 8px 12px !important;
      }
      body.simple-edit-phase1 .topbar .icon-button,
      body.simple-edit-phase1 .timeline-topline .icon-button {
        min-width: 36px;
        padding: 7px 10px;
      }
      body.simple-edit-phase1 .orgavox-effects-dropdown {
        position: relative;
        display: inline-flex;
        align-items: center;
        z-index: 80;
      }
      body.simple-edit-phase1 .orgavox-effects-dropdown-button {
        border-color: rgba(117,178,222,.9) !important;
        background: linear-gradient(180deg, rgba(57,132,205,.96), rgba(31,77,133,.92)) !important;
        color: #fff !important;
        box-shadow: 0 0 0 1px rgba(117,178,222,.24), 0 0 16px rgba(75,155,255,.26) !important;
      }
      body.simple-edit-phase1 .orgavox-effects-dropdown-button::after {
        content: "▾";
        margin-left: 7px;
        color: #dff5ff;
      }
      body.simple-edit-phase1 .orgavox-effects-menu {
        position: absolute;
        top: calc(100% + 7px);
        left: 0;
        display: none;
        min-width: 218px;
        padding: 8px;
        border: 1px solid rgba(117,178,222,.56);
        border-radius: 14px;
        background: rgba(8, 10, 9, .98);
        box-shadow: 0 18px 40px rgba(0,0,0,.65), inset 0 0 0 1px rgba(255,255,255,.04);
        z-index: 2500;
      }
      body.simple-edit-phase1 .orgavox-effects-dropdown.open .orgavox-effects-menu { display: grid; gap: 7px; }
      body.simple-edit-phase1 .orgavox-effects-menu .tool-button {
        width: 100%;
        justify-content: flex-start;
        min-height: 34px;
      }

      body.simple-edit-phase1 .workspace {
        min-height: 0 !important;
        height: calc(100vh - var(--topbar-h)) !important;
        display: grid !important;
        grid-template-columns: var(--orgavox-sidebar-w) minmax(0, 1fr) !important;
        overflow: hidden !important;
        background: rgba(9,11,9,.97) !important;
      }
      body.simple-edit-phase1 .workspace::before { display: none !important; }
      body.simple-edit-phase1 .library-panel {
        position: relative;
        min-width: 0 !important;
        min-height: 0 !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        padding: 16px 14px 14px !important;
        gap: 11px !important;
        overflow: hidden !important;
        border-right: 2px solid rgba(224,163,96,.58) !important;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: 8px 0 18px rgba(0,0,0,.22) !important;
        z-index: 4 !important;
      }
      body.simple-edit-phase1 .library-panel::after {
        content: "";
        position: absolute;
        top: 0;
        right: -2px;
        bottom: 0;
        width: 1px;
        background: linear-gradient(180deg,rgba(248,215,146,.75),rgba(224,163,96,.32));
        pointer-events: none;
      }
      body.simple-edit-phase1 .library-panel .panel-heading {
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 0 4px !important;
        flex: 0 0 auto !important;
        background: transparent !important;
      }
      body.simple-edit-phase1 .library-panel .panel-heading h2 {
        font-size: .9rem !important;
        line-height: 1.15 !important;
      }
      body.simple-edit-phase1 .library-panel .eyebrow { line-height: 1.2 !important; }
      body.simple-edit-phase1 .orgavox-sidebar-zoom {
        display: block;
        flex: 0 0 auto;
        border: 1px solid rgba(224,163,96,.24);
        border-radius: 13px;
        background: rgba(0,0,0,.2);
        padding: 9px 10px;
      }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control {
        width: 100%;
        min-width: 0 !important;
        grid-template-columns: 1fr !important;
        gap: 6px !important;
        margin: 0 !important;
      }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control span {
        color: var(--water-spray);
        font: 800 .58rem var(--font-mono);
        letter-spacing: .09em;
        text-transform: uppercase;
      }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control output { text-align: left; }
      body.simple-edit-phase1 .library-panel .dropzone {
        display: grid !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 0 0 auto !important;
        min-height: 92px !important;
        margin: 0 !important;
        z-index: 12 !important;
      }
      body.simple-edit-phase1 .library-help {
        display: block !important;
        flex: 0 0 auto !important;
      }
      body.simple-edit-phase1 .asset-list {
        display: flex !important;
        flex: 1 1 auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 8 !important;
        padding-top: 2px;
      }
      body.simple-edit-phase1 .asset-list .asset-item {
        display: grid !important;
        flex: 0 0 auto !important;
        min-height: 58px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      body.simple-edit-phase1 .asset-list .empty-state { min-height: 120px !important; }

      body.simple-edit-phase1 .timeline-panel {
        min-width: 0 !important;
        min-height: 0 !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        padding: 24px 8px 16px 0 !important;
        overflow: hidden !important;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        z-index: 1 !important;
      }
      body.simple-edit-phase1 .timeline-shell {
        grid-template-columns: 122px minmax(0, 1fr);
        height: 100% !important;
        max-height: none !important;
        min-height: 0 !important;
        flex: 1 1 auto !important;
        margin-top: 0 !important;
        border-left: 0 !important;
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
        box-shadow: inset 1px 0 rgba(248,215,146,.22);
      }
      body.simple-edit-phase1 .track-label-column {
        overflow: hidden;
        border-right: 1px solid rgba(224,163,96,.54) !important;
      }
      body.simple-edit-phase1 .phase1-track-label-scroll { will-change: transform; }
      body.simple-edit-phase1 .timeline-scroll {
        overflow: auto;
        overscroll-behavior: contain;
      }
      body.simple-edit-phase1 .ruler {
        position: sticky;
        top: 0;
        z-index: 9;
      }
      body.simple-edit-phase1 .track-label {
        height: var(--lane-h);
        padding: 0 12px;
      }
      body.simple-edit-phase1 .track-label span {
        width: 26px;
        height: 26px;
        font-size: .62rem;
      }
      body.simple-edit-phase1 .track-label strong { font-size: .66rem; }
      body.simple-edit-phase1 .track-lane.selected-track {
        box-shadow: inset 0 0 0 2px rgba(117,216,255,.55), inset 4px 0 rgba(117,216,255,.85);
        background-color: rgba(75,155,255,.09);
      }
      body.simple-edit-phase1 .track-lane { overflow: visible !important; }
      body.simple-edit-phase1 .audio-clip {
        top: 10px;
        height: calc(var(--lane-h) - 20px);
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 12 !important;
      }
      body.simple-edit-phase1 .audio-clip.selected {
        border-color: #75d8ff;
        background: linear-gradient(180deg, rgba(80,174,255,.78), rgba(35,111,184,.66));
        box-shadow: 0 0 0 2px rgba(117,216,255,.48), 0 0 18px rgba(75,178,255,.42), 0 5px 16px rgba(0,0,0,.5);
      }
      body.simple-edit-phase1 .clip-title {
        top: 5px;
        font-size: .58rem;
      }
      body.simple-edit-phase1 .clip-effect-badges { bottom: 5px; }

      @media (max-width: 1380px) {
        body.simple-edit-phase1 {
          --topbar-h: 196px;
          --orgavox-sidebar-w: 270px;
        }
        body.simple-edit-phase1 .brand {
          flex-basis: 210px !important;
          min-width: 210px !important;
          max-width: 210px !important;
        }
        body.simple-edit-phase1 .phase1-top-effects { padding-top: 8px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeDivider() {
    const divider = document.createElement("span");
    divider.className = "orgavox-divider";
    divider.setAttribute("aria-hidden", "true");
    return divider;
  }

  function makeGroup(name, nodes) {
    const group = document.createElement("div");
    group.className = `orgavox-group orgavox-${name}-group`;
    nodes.filter(Boolean).forEach((node) => group.appendChild(node));
    return group;
  }

  function ensureContainer(className, parent) {
    let node = parent.querySelector(`.${className}`);
    if (!node) {
      node = document.createElement("div");
      node.className = className;
      parent.appendChild(node);
    }
    return node;
  }

  function ensureBrand() {
    const brand = document.querySelector(".brand");
    const mark = brand?.querySelector(".brand-mark");
    const title = brand?.querySelector("h1");
    if (mark) mark.textContent = "Φ";
    if (title) {
      let badge = title.querySelector(".phase1-version, .simple-edit-version");
      title.textContent = "ORGAVOX";
      if (!badge) badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = PHASE_VERSION;
      title.appendChild(badge);
    }
    const subtitle = brand?.querySelector("p");
    if (subtitle) subtitle.textContent = "Browser audio workstation";
    document.title = `Organon — ORGAVOX ${PHASE_VERSION}`;
  }

  function ensureBrandActions() {
    const brand = document.querySelector(".brand");
    const brandText = brand?.querySelector("div:not(.brand-mark)");
    if (!brandText) return null;
    let actions = brandText.querySelector(".orgavox-brand-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "orgavox-brand-actions";
      brandText.appendChild(actions);
    }
    return actions;
  }

  function findEffectsLibraryButton() {
    return document.querySelector(".effects-library-button") ||
      [...document.querySelectorAll("button")].find((button) => /effects library/i.test(button.textContent || ""));
  }

  function findEchoSettingsButton() {
    return document.getElementById("echoSettingsBtn") || document.querySelector(".echo-settings-button");
  }

  function closeEffectsMenu() {
    document.querySelector(".orgavox-effects-dropdown")?.classList.remove("open");
  }

  function ensureEffectsDropdown() {
    let wrap = document.querySelector(".orgavox-effects-dropdown");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "orgavox-effects-dropdown";
      const button = document.createElement("button");
      button.id = "orgavoxEffectsButton";
      button.type = "button";
      button.className = "tool-button primary orgavox-effects-dropdown-button";
      button.textContent = "Effects";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        wrap.classList.toggle("open");
      });
      const menu = document.createElement("div");
      menu.className = "orgavox-effects-menu";
      menu.setAttribute("role", "menu");
      menu.addEventListener("click", (event) => {
        if (event.target.closest("button")) setTimeout(closeEffectsMenu, 0);
      });
      wrap.append(button, menu);
    }
    const button = wrap.querySelector("#orgavoxEffectsButton");
    if (button) button.textContent = "Effects";
    if (!window.__orgavoxEffectsMenuCloseBound) {
      window.__orgavoxEffectsMenuCloseBound = true;
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".orgavox-effects-dropdown")) closeEffectsMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeEffectsMenu();
      });
    }
    return wrap;
  }

  function moveButtonsIntoEffectsDropdown(wrap) {
    const menu = wrap?.querySelector(".orgavox-effects-menu");
    if (!menu) return;
    const menuButtons = [
      ui.gateBtn,
      ui.stretchBtn,
      ui.normalizeBtn,
      ui.transposeBtn,
      ui.eqBtn,
      ui.driveBtn,
      ui.dynamicsBtn
    ].filter(Boolean);
    menuButtons.forEach((button) => {
      button.classList.add("orgavox-menu-effect-item");
      menu.appendChild(button);
    });
  }

  function updateButtonEmojiLabels() {
    if (ui.importBtn) ui.importBtn.textContent = "📥 Import";
    if (ui.exportBtn) ui.exportBtn.textContent = "💾 Export";
    const effectsButton = findEffectsLibraryButton();
    if (effectsButton) effectsButton.textContent = "🎧 Effects Library";
    if (ui.jumpStartBtn) {
      ui.jumpStartBtn.textContent = "⏮";
      ui.jumpStartBtn.title = "Return to start";
    }
    if (ui.playBtn && !state.playing) {
      ui.playBtn.textContent = "▶️";
      ui.playBtn.title = "Play or pause";
    }
    if (ui.stopBtn) {
      ui.stopBtn.textContent = "⏹";
      ui.stopBtn.title = "Stop";
    }
    if (ui.scissorsBtn) ui.scissorsBtn.textContent = "Cut";
    if (ui.deleteBtn) ui.deleteBtn.textContent = "DEL";
    if (ui.fullscreenBtn) {
      ui.fullscreenBtn.textContent = "⛶";
      ui.fullscreenBtn.title = "Toggle fullscreen";
    }
    if (ui.gateBtn) ui.gateBtn.textContent = "🚪 Noise gate";
    if (ui.stretchBtn) {
      const applyStretchText = () => {
        const active = ui.stretchBtn.getAttribute("aria-pressed") === "true";
        ui.stretchBtn.textContent = active ? "↔️ Stretch on" : "↔️ Stretch off";
      };
      applyStretchText();
      if (ui.stretchBtn.dataset.phase1EmojiBound !== "true") {
        ui.stretchBtn.dataset.phase1EmojiBound = "true";
        ui.stretchBtn.addEventListener("click", () => setTimeout(applyStretchText, 0));
      }
    }
    if (ui.fadeInBtn) ui.fadeInBtn.textContent = "↗ Fade in";
    if (ui.fadeOutBtn) ui.fadeOutBtn.textContent = "↘ Fade out";
    if (ui.resetFadesBtn) ui.resetFadesBtn.textContent = "✕ Fades";
    if (ui.normalizeBtn) ui.normalizeBtn.textContent = "⚖ Normalize";
    if (ui.transposeBtn) ui.transposeBtn.textContent = "🎼 Transpose";
    if (ui.eqBtn) ui.eqBtn.textContent = "🎚 EQ / Filter";
    if (ui.driveBtn) ui.driveBtn.textContent = "🔥 Drive";
    if (ui.dynamicsBtn) ui.dynamicsBtn.textContent = "📊 Dynamics";
    const volumeLabel = ui.volumeSlider?.closest(".range-control")?.querySelector("span");
    if (volumeLabel) volumeLabel.textContent = "🔊 Volume";
    const echoLabel = ui.echoSlider?.closest(".range-control")?.querySelector("span");
    if (echoLabel) echoLabel.textContent = "🔁 Echo";
    const zoomLabel = ui.zoomSlider?.closest(".range-control")?.querySelector("span");
    if (zoomLabel) zoomLabel.textContent = "🔍 Timeline zoom";
  }

  function ensureHiddenTimelineToolbar() {
    const timelineTopline = document.querySelector(".timeline-topline");
    if (!timelineTopline) return null;
    let toolbar = timelineTopline.querySelector(".phase1-timeline-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "phase1-timeline-toolbar";
      timelineTopline.appendChild(toolbar);
    }
    return toolbar;
  }

  function rebuildTopBar() {
    const topbar = document.querySelector(".topbar");
    const brand = document.querySelector(".brand");
    if (!topbar || !brand) return;
    document.body.classList.add("simple-edit-phase1");
    topbar.classList.add("phase1-effects-ready");

    let deck = topbar.querySelector(".phase1-top-effects");
    if (!deck) {
      deck = document.createElement("div");
      deck.className = "phase1-top-effects";
      topbar.appendChild(deck);
    }

    const brandActions = ensureBrandActions();
    const effectsButton = findEffectsLibraryButton();
    const echoSettingsButton = findEchoSettingsButton();
    const volumeControl = ui.volumeSlider?.closest(".range-control");
    const echoControl = ui.echoSlider?.closest(".range-control");
    const effectsMenu = ensureEffectsDropdown();

    const row1 = ensureContainer("orgavox-toolbar-row", deck);
    const row2 = ensureContainer("orgavox-effects-row", deck);
    row1.innerHTML = "";
    row2.innerHTML = "";

    if (brandActions) brandActions.append(ui.importBtn, ui.exportBtn);
    moveButtonsIntoEffectsDropdown(effectsMenu);

    row1.append(
      makeGroup("transport", [ui.jumpStartBtn, ui.playBtn, ui.stopBtn, ui.timeReadout]),
      makeDivider(),
      makeGroup("edit", [ui.scissorsBtn, ui.deleteBtn, ui.fullscreenBtn, effectsMenu]),
      makeDivider(),
      makeGroup("main-controls", [
        volumeControl,
        echoControl,
        echoSettingsButton,
        ui.fadeInBtn,
        ui.fadeOutBtn,
        ui.resetFadesBtn,
        effectsButton
      ])
    );
  }

  function moveZoomToSidebar() {
    const panel = document.querySelector(".library-panel");
    const heading = panel?.querySelector(".panel-heading");
    const zoomControl = ui.zoomSlider?.closest(".range-control");
    if (!panel || !heading || !zoomControl) return;
    let zoomWrap = panel.querySelector(".orgavox-sidebar-zoom");
    if (!zoomWrap) {
      zoomWrap = document.createElement("div");
      zoomWrap.className = "orgavox-sidebar-zoom";
      heading.insertAdjacentElement("afterend", zoomWrap);
    }
    if (zoomControl.parentElement !== zoomWrap) zoomWrap.appendChild(zoomControl);
  }

  function restoreLibraryOrder() {
    const panel = document.querySelector(".library-panel");
    if (!panel) return;
    const heading = panel.querySelector(".panel-heading");
    const zoom = panel.querySelector(".orgavox-sidebar-zoom");
    const dropzone = ui.dropzone || panel.querySelector(".dropzone");
    const help = panel.querySelector(".library-help");
    const list = ui.assetList || panel.querySelector(".asset-list");
    [heading, zoom, dropzone, help, list].filter(Boolean).forEach((node) => panel.appendChild(node));
    if (dropzone) {
      dropzone.hidden = false;
      dropzone.style.display = "grid";
    }
  }

  function refreshOrgavoxLayout() {
    ensureBrand();
    updateButtonEmojiLabels();
    rebuildTopBar();
    moveZoomToSidebar();
    restoreLibraryOrder();
    document.querySelectorAll(".phase1-workspace-rule").forEach((rule) => { rule.hidden = true; });
  }

  function ensureTenTracks() {
    const labelColumn = document.querySelector(".track-label-column");
    const tracks = document.querySelector("#tracks");
    if (!labelColumn || !tracks) return;

    const newLanes = [];
    const newLabels = [];

    for (let index = 0; index < TRACK_COUNT; index += 1) {
      if (!labelColumn.querySelector(`[data-track-label="${index}"]`)) {
        const label = document.createElement("button");
        label.className = "track-label";
        label.dataset.trackLabel = String(index);
        label.type = "button";
        label.innerHTML = `<span>${index + 1}</span><strong>Track ${index + 1}</strong>`;
        labelColumn.appendChild(label);
        newLabels.push(label);
      }
      if (!tracks.querySelector(`[data-track="${index}"]`)) {
        const lane = document.createElement("div");
        lane.className = "track-lane";
        lane.dataset.track = String(index);
        tracks.appendChild(lane);
        newLanes.push(lane);
      }
    }

    ui.lanes = [...document.querySelectorAll(".track-lane")];
    ui.trackLabels = [...document.querySelectorAll(".track-label")];
    newLanes.forEach(bindLaneEvents);
    newLabels.forEach(bindTrackLabel);
  }

  function ensureTrackLabelScroller() {
    const labelColumn = document.querySelector(".track-label-column");
    if (!labelColumn) return;
    let scroller = labelColumn.querySelector(".phase1-track-label-scroll");
    if (!scroller) {
      scroller = document.createElement("div");
      scroller.className = "phase1-track-label-scroll";
      [...labelColumn.querySelectorAll(".track-label")].forEach((label) => scroller.appendChild(label));
      labelColumn.appendChild(scroller);
    }
    ui.trackLabels = [...scroller.querySelectorAll(".track-label")];
    const sync = () => {
      scroller.style.transform = `translateY(${-ui.timelineScroll.scrollTop}px)`;
    };
    if (ui.timelineScroll && ui.timelineScroll.dataset.phase1ScrollBound !== "true") {
      ui.timelineScroll.dataset.phase1ScrollBound = "true";
      ui.timelineScroll.addEventListener("scroll", sync);
    }
    sync();
  }

  function bindLaneEvents(lane) {
    if (lane.dataset.phase1Bound === "true") return;
    lane.dataset.phase1Bound = "true";
    lane.addEventListener("click", (event) => {
      if (event.target.closest(".audio-clip")) return;
      selectTrack(Number(lane.dataset.track));
      setPlayhead(pointerTime(event));
      state.selectedClipId = null;
      syncSelectedControls();
      renderTimeline();
    });
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drag-target");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-target"));
    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("drag-target");
      const assetId = state.dragAssetId || event.dataTransfer.getData("text/plain");
      addClipFromAsset(assetId, Number(lane.dataset.track), pointerTime(event));
    });
  }

  function bindTrackLabel(label) {
    if (label.dataset.phase1Bound === "true") return;
    label.dataset.phase1Bound = "true";
    label.addEventListener("click", () => selectTrack(label.dataset.trackLabel));
  }

  function verifyClipWasDrawn(clipId) {
    if (!clipId) return;
    requestAnimationFrame(() => {
      const clip = state.clips.find((item) => item.id === clipId);
      if (!clip) return;
      if (!document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clipId)}"]`)) {
        renderTimeline();
      }
    });
  }

  function patchTrackAwareFunctions() {
    selectTrack = function orgavoxSelectTrack(track) {
      state.selectedTrack = clampTrack(track);
      ui.lanes.forEach((lane) => lane.classList.toggle("selected-track", Number(lane.dataset.track) === state.selectedTrack));
      ui.trackLabels.forEach((label) => label.classList.toggle("active", Number(label.dataset.trackLabel) === state.selectedTrack));
      renderAssets();
    };

    addClipFromAsset = function orgavoxAddClipFromAsset(assetId, track, start) {
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) return;
      const clip = {
        id: makeId("clip"),
        assetId,
        name: asset.name,
        track: clampTrack(track),
        start: Math.max(0, start),
        sourceStart: 0,
        sourceEnd: asset.duration,
        stretchDuration: null,
        volume: 100,
        echo: 0,
        fadeIn: 0,
        fadeOut: 0,
        gate: null,
        bufferOverride: null,
        cacheVersion: 0,
        volumeKeyframes: []
      };
      state.clips.push(clip);
      selectClip(clip.id);
      renderTimeline();
      verifyClipWasDrawn(clip.id);
      showToast(`${asset.name} added to Track ${clip.track + 1}.`);
    };

    moveClipPointer = function orgavoxMoveClipPointer(event) {
      const drag = state.clipDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const clip = state.clips.find((item) => item.id === drag.clipId);
      if (!clip) return;
      const deltaSeconds = (event.clientX - drag.startX) / state.pixelsPerSecond;
      if (drag.type === "move") {
        clip.start = Math.max(0, drag.original.start + deltaSeconds);
        const laneRect = ui.tracks.getBoundingClientRect();
        const laneHeight = laneRect.height / TRACK_COUNT;
        const nextTrack = clampTrack(Math.floor((event.clientY - laneRect.top) / laneHeight));
        if (clip.track !== nextTrack) {
          clip.track = nextTrack;
          selectTrack(clip.track);
          ui.lanes[clip.track].appendChild(drag.element);
        }
      } else if (state.stretchMode) {
        const originalDuration = drag.original.stretchDuration || Math.max(.01, drag.original.sourceEnd - drag.original.sourceStart);
        if (drag.edge === "right") {
          clip.stretchDuration = Math.max(.05, originalDuration + deltaSeconds);
        } else {
          const originalGateExtra = gateExtraDuration(clip, originalDuration);
          const rightEdge = drag.original.start + originalDuration + originalGateExtra;
          const newStart = Math.max(0, drag.original.start + deltaSeconds);
          clip.start = newStart;
          clip.stretchDuration = Math.max(.05, rightEdge - newStart - originalGateExtra);
        }
        invalidateClip(clip);
      } else {
        const buffer = clipBuffer(clip);
        if (!buffer) return;
        if (drag.edge === "right") {
          clip.sourceEnd = Math.max(drag.original.sourceStart + .05, Math.min(buffer.duration, drag.original.sourceEnd + deltaSeconds));
        } else {
          const maxSource = drag.original.sourceEnd - .05;
          const nextSourceStart = Math.max(0, Math.min(maxSource, drag.original.sourceStart + deltaSeconds));
          const sourceDelta = nextSourceStart - drag.original.sourceStart;
          clip.sourceStart = nextSourceStart;
          clip.start = Math.max(0, drag.original.start + sourceDelta);
        }
        clip.stretchDuration = null;
        invalidateClip(clip);
      }
      drag.element.style.left = `${clip.start * state.pixelsPerSecond}px`;
      drag.element.style.width = `${Math.max(12, clipDuration(clip) * state.pixelsPerSecond)}px`;
      const canvas = drag.element.querySelector(".clip-wave");
      if (canvas) drawClipWaveform(canvas, clip);
      syncSelectedControls();
      updatePlayheadVisual();
    };
  }

  function configureZoom() {
    if (!ui.zoomSlider || !ui.zoomOut) return;
    ui.zoomSlider.min = "25";
    ui.zoomSlider.max = "500";
    ui.zoomSlider.step = "1";
    if (Number(ui.zoomSlider.value) < 100) ui.zoomSlider.value = "100";
    state.pixelsPerSecond = Number(ui.zoomSlider.value) || 100;
    ui.zoomOut.textContent = `${state.pixelsPerSecond}%`;
    if (ui.zoomSlider.dataset.orgavoxZoomBound !== "true") {
      ui.zoomSlider.dataset.orgavoxZoomBound = "true";
      ui.zoomSlider.addEventListener("input", () => {
        state.pixelsPerSecond = Number(ui.zoomSlider.value) || 100;
        ui.zoomOut.textContent = `${state.pixelsPerSecond}%`;
        renderTimeline();
      });
    }
  }

  function updateExportCopy() {
    if (ui.exportTitle) ui.exportTitle.textContent = "Export mix";
    if (ui.exportConfirmBtn && ui.exportFormat && ui.exportConfirmBtn.dataset.orgavoxExportCopyBound !== "true") {
      ui.exportConfirmBtn.dataset.orgavoxExportCopyBound = "true";
      const originalUpdateExportFormat = updateExportFormat;
      updateExportFormat = function orgavoxUpdateExportFormat() {
        originalUpdateExportFormat();
        ui.exportConfirmBtn.textContent = ui.exportFormat.value === "mp3" ? "Render MP3" : "Render WAV";
      };
    }
  }

  function patchRenderForLayoutRefresh() {
    if (window.__orgavoxRenderRefreshPatched) return;
    window.__orgavoxRenderRefreshPatched = true;
    const previousRenderAssets = renderAssets;
    renderAssets = function orgavoxRenderAssets() {
      previousRenderAssets();
      restoreLibraryOrder();
    };
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxRenderTimeline() {
      previousRenderTimeline();
      restoreLibraryOrder();
    };
  }

  installPhaseStyles();
  window.orgavoxRefreshLayout = refreshOrgavoxLayout;
  ensureHiddenTimelineToolbar();
  refreshOrgavoxLayout();
  ensureTenTracks();
  ensureTrackLabelScroller();
  patchTrackAwareFunctions();
  patchRenderForLayoutRefresh();
  configureZoom();
  updateExportCopy();
  selectTrack(state.selectedTrack || 0);
  renderTimeline();
  refreshOrgavoxLayout();
  window.addEventListener("resize", refreshOrgavoxLayout);
  setTimeout(refreshOrgavoxLayout, 0);
  setTimeout(refreshOrgavoxLayout, 120);
  setStatus("Ready — ORGAVOX layout active");
})();
