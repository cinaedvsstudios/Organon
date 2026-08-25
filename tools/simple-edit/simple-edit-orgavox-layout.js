"use strict";

(function installOrgavoxLayoutPatch() {
  const VERSION = "v0.22";
  const STYLE_ID = "simple-edit-orgavox-layout-style";

  function setBrand() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const mark = document.querySelector(".brand-mark");
    if (mark) mark.textContent = "Φ";
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (title) {
      let badge = title.querySelector(".phase1-version, .simple-edit-version");
      title.textContent = "ORGAVOX";
      if (!badge) badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
    const subtitle = brand?.querySelector("p");
    if (subtitle) subtitle.textContent = "Browser audio workstation";
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 { --topbar-h:136px; --orgavox-sidebar-w:288px; --orgavox-line:rgba(224,163,96,.72); }
      body.simple-edit-phase1 .app { grid-template-rows:var(--topbar-h) 0px 1fr !important; }
      body.simple-edit-phase1 .topbar { min-height:var(--topbar-h) !important; height:var(--topbar-h) !important; align-items:flex-start !important; gap:14px !important; padding:12px 16px 11px !important; overflow:visible !important; }
      body.simple-edit-phase1 .brand { min-width:212px !important; max-width:212px !important; padding-top:4px; }
      body.simple-edit-phase1 .brand-mark { font-size:1.45rem !important; }
      body.simple-edit-phase1 .brand h1 { gap:9px !important; color:var(--stone-ochre) !important; }
      body.simple-edit-phase1 .phase1-top-effects { flex:1 1 auto !important; min-width:0 !important; display:grid !important; grid-template-rows:auto auto !important; align-content:start !important; gap:8px !important; padding-top:0 !important; }
      body.simple-edit-phase1 .orgavox-toolbar-row, body.simple-edit-phase1 .orgavox-effects-row { display:flex; align-items:center; justify-content:flex-start; gap:8px; flex-wrap:wrap; width:100%; min-width:0; }
      body.simple-edit-phase1 .orgavox-effects-row { gap:9px; }
      body.simple-edit-phase1 .orgavox-group { display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0; }
      body.simple-edit-phase1 .orgavox-transport-group { flex-wrap:nowrap; }
      body.simple-edit-phase1 .orgavox-divider { flex:0 0 1px; width:1px; align-self:stretch; min-height:34px; background:linear-gradient(180deg, transparent, var(--orgavox-line), transparent); margin:0 6px; }
      body.simple-edit-phase1 .orgavox-effects-row .range-control { min-width:178px !important; grid-template-columns:auto minmax(72px,112px) 46px !important; }
      body.simple-edit-phase1 .orgavox-toolbar-row .tool-button, body.simple-edit-phase1 .orgavox-effects-row .tool-button { padding-left:12px !important; padding-right:12px !important; }
      body.simple-edit-phase1 .phase1-timeline-toolbar, body.simple-edit-phase1 .timeline-topline, body.simple-edit-phase1 .phase1-workspace-rule { display:none !important; }
      body.simple-edit-phase1 .workspace { grid-template-columns:var(--orgavox-sidebar-w) minmax(0,1fr) !important; min-height:0 !important; background:rgba(9,11,9,.97) !important; }
      body.simple-edit-phase1 .library-panel { min-width:0 !important; padding:16px 14px 14px !important; gap:11px !important; overflow:visible !important; border-right:2px solid rgba(224,163,96,.58) !important; box-shadow:8px 0 18px rgba(0,0,0,.22) !important; z-index:4 !important; }
      body.simple-edit-phase1 .library-panel::after { content:""; position:absolute; top:0; right:-2px; bottom:0; width:1px; background:linear-gradient(180deg,rgba(248,215,146,.75),rgba(224,163,96,.32)); pointer-events:none; }
      body.simple-edit-phase1 .library-panel .panel-heading { min-height:auto !important; margin:0 !important; padding:0 0 4px !important; flex:0 0 auto !important; }
      body.simple-edit-phase1 .library-panel .panel-heading h2 { font-size:.9rem !important; line-height:1.15 !important; }
      body.simple-edit-phase1 .library-panel .eyebrow { line-height:1.2 !important; }
      body.simple-edit-phase1 .orgavox-sidebar-zoom { display:block; flex:0 0 auto; border:1px solid rgba(224,163,96,.24); border-radius:13px; background:rgba(0,0,0,.2); padding:9px 10px; }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control { width:100%; min-width:0 !important; grid-template-columns:1fr !important; gap:6px !important; margin:0 !important; }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control span { color:var(--water-spray); font:800 .58rem var(--font-mono); letter-spacing:.09em; text-transform:uppercase; }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control output { text-align:left; }
      body.simple-edit-phase1 .library-panel .dropzone { display:grid !important; visibility:visible !important; opacity:1 !important; flex:0 0 auto !important; min-height:92px !important; margin:0 !important; z-index:12 !important; }
      body.simple-edit-phase1 .library-help { display:block !important; flex:0 0 auto !important; }
      body.simple-edit-phase1 .asset-list { flex:1 1 auto !important; min-height:145px !important; overflow-y:auto !important; overflow-x:hidden !important; }
      body.simple-edit-phase1 .timeline-panel { padding:24px 8px 16px 0 !important; min-width:0 !important; z-index:1 !important; }
      body.simple-edit-phase1 .timeline-shell { margin-top:0 !important; border-left:0 !important; border-top-left-radius:0 !important; border-bottom-left-radius:0 !important; box-shadow:inset 1px 0 rgba(248,215,146,.22); }
      body.simple-edit-phase1 .track-label-column { border-right:1px solid rgba(224,163,96,.54) !important; }
      @media (max-width:1380px) { body.simple-edit-phase1 { --topbar-h:176px; --orgavox-sidebar-w:270px; } body.simple-edit-phase1 .brand { min-width:180px !important; max-width:180px !important; } }
    `;
    document.head.appendChild(style);
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

  function divider() {
    const line = document.createElement("span");
    line.className = "orgavox-divider";
    line.setAttribute("aria-hidden", "true");
    return line;
  }

  function group(name, nodes) {
    const wrap = document.createElement("div");
    wrap.className = `orgavox-group orgavox-${name}-group`;
    nodes.filter(Boolean).forEach((node) => wrap.appendChild(node));
    return wrap;
  }

  function findEffectsLibraryButton() {
    return document.querySelector(".effects-library-button") ||
      [...document.querySelectorAll("button")].find((button) => /effects library/i.test(button.textContent || ""));
  }

  function labelButtons() {
    if (ui.importBtn) ui.importBtn.textContent = "📥 Import";
    if (ui.exportBtn) ui.exportBtn.textContent = "💾 Export";
    const effectsButton = findEffectsLibraryButton();
    if (effectsButton) effectsButton.textContent = "🎧 Effects Library";
    if (ui.jumpStartBtn) ui.jumpStartBtn.textContent = "⏮";
    if (ui.playBtn && !state.playing) ui.playBtn.textContent = "▶️";
    if (ui.stopBtn) ui.stopBtn.textContent = "⏹";
    if (ui.scissorsBtn) ui.scissorsBtn.textContent = "✂️ Scissors";
    if (ui.deleteBtn) ui.deleteBtn.textContent = "🗑 Delete";
    if (ui.gateBtn) ui.gateBtn.textContent = "🚪 Noise gate";
    if (ui.stretchBtn) ui.stretchBtn.textContent = ui.stretchBtn.getAttribute("aria-pressed") === "true" ? "↔️ Stretch on" : "↔️ Stretch off";
    if (ui.fadeInBtn) ui.fadeInBtn.textContent = "↗ Fade in";
    if (ui.fadeOutBtn) ui.fadeOutBtn.textContent = "↘ Fade out";
    if (ui.resetFadesBtn) ui.resetFadesBtn.textContent = "✕ Fades";
    if (ui.normalizeBtn) ui.normalizeBtn.textContent = "⚖ Normalize";
  }

  function rebuildTopBar() {
    const topbar = document.querySelector(".topbar");
    const brand = document.querySelector(".brand");
    if (!topbar || !brand) return;
    document.body.classList.add("simple-edit-phase1");

    let deck = topbar.querySelector(".phase1-top-effects");
    if (!deck) {
      deck = document.createElement("div");
      deck.className = "phase1-top-effects";
      topbar.appendChild(deck);
    }
    const row1 = ensureContainer("orgavox-toolbar-row", deck);
    const row2 = ensureContainer("orgavox-effects-row", deck);
    row1.innerHTML = "";
    row2.innerHTML = "";

    const effectsButton = findEffectsLibraryButton();
    const echoSettingsButton = document.getElementById("echoSettingsBtn");
    const volumeControl = ui.volumeSlider?.closest(".range-control");
    const echoControl = ui.echoSlider?.closest(".range-control");

    row1.append(
      group("file", [ui.importBtn, ui.exportBtn]),
      divider(),
      group("transport", [ui.jumpStartBtn, ui.playBtn, ui.stopBtn, ui.timeReadout]),
      divider(),
      group("edit", [ui.scissorsBtn, ui.deleteBtn, ui.fullscreenBtn])
    );
    row2.append(group("effects", [
      volumeControl,
      echoControl,
      echoSettingsButton,
      ui.gateBtn,
      ui.stretchBtn,
      ui.fadeInBtn,
      ui.fadeOutBtn,
      ui.resetFadesBtn,
      ui.normalizeBtn,
      effectsButton
    ]));
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

  function applyLayout() {
    setBrand();
    labelButtons();
    rebuildTopBar();
    moveZoomToSidebar();
    restoreLibraryOrder();
    document.querySelectorAll(".phase1-workspace-rule").forEach((rule) => { rule.hidden = true; });
  }

  installStyles();
  applyLayout();
  requestAnimationFrame(applyLayout);
  setTimeout(applyLayout, 80);
  setTimeout(applyLayout, 350);
  window.addEventListener("resize", applyLayout);
  document.addEventListener("click", () => setTimeout(applyLayout, 0), true);
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX layout active");
})();
