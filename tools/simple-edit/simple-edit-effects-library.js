"use strict";

(function installSimpleEditEffectsLibrary() {
  const EFFECTS_LIBRARY_VERSION = "v0.15";
  const STYLE_ID = "simple-edit-effects-library-style";
  const RAW_BASE = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";

  const EFFECTS = [
    { id: "alarm1", category: "alarm", name: "Alarm 1", explanation: "A warning/alarm sound. Use it when something urgent or dramatic happens.", tooltip: "Alarm sound for warning, danger, or attention.", origin: "guitarguy1985 @ FreeSound (2008)" },
    { id: "alarm4", category: "alarm", name: "Alarm 4", explanation: "A short alarm sound. Use it for alert moments or error-style warnings.", tooltip: "Short alarm for warnings or attention.", origin: "Leszek_Szary @ FreeSound (2012)" },
    { id: "beep4", category: "beep", name: "Beep 4", explanation: "A tiny electronic beep. Good for UI clicks, small confirmations, or button feedback.", tooltip: "Small electronic beep for simple feedback.", origin: "KevanGC @ Soundbible (2010)" },
    { id: "beep5", category: "beep", name: "Beep 5", explanation: "A quick digital beep. Good when the app needs to say done without being dramatic.", tooltip: "Quick beep for small confirmations.", origin: "Soundwarf @ FreeSound (2017)" },
    { id: "beep6", category: "beep", name: "Beep 6", explanation: "A slightly longer beep. Good for a notification or small alert.", tooltip: "Notification beep for small alerts.", origin: "kickhat @ FreeSound (2015)" },
    { id: "cannon1", category: "impact", name: "Cannon 1", explanation: "A cannon or explosion-like hit. Good for dramatic impacts.", tooltip: "Big cannon impact sound.", origin: "nps.gov @ Soundbible (2009)" },
    { id: "cannon2", category: "impact", name: "Cannon 2", explanation: "Another cannon hit. Useful for explosions or heavy hits.", tooltip: "Heavy cannon sound for impacts.", origin: "Isaac200000 @ FreeSound (2013)" },
    { id: "chime1", category: "chime", name: "Chime 1", explanation: "A pleasant ringing sound. Good for success, magic, or confirmation.", tooltip: "Soft chime for success or magic moments.", origin: "husky70 @ FreeSound (2008)" },
    { id: "chime2", category: "chime", name: "Chime 2", explanation: "A clean tone or chime. Good for UI success or notification.", tooltip: "Clean chime tone for confirmations.", origin: "His Self @ Soundbible (2011)" },
    { id: "chime4", category: "chime", name: "Chime 4", explanation: "A small ringing chime. Good for gentle alerts or successful actions.", tooltip: "Small chime for gentle alerts.", origin: "mpaol2023 @ FreeSound (2016)" },
    { id: "click3", category: "click", name: "Click 3", explanation: "A short click. Good for buttons and interface feedback.", tooltip: "Short click for button feedback.", origin: "coobek @ FreeSound (2013)" },
    { id: "click4", category: "click", name: "Click 4", explanation: "A button-like click. Good for menus, toggles, and small selections.", tooltip: "Button click for UI actions.", origin: "waveplay. @ FreeSound (2013)" },
    { id: "click6", category: "click", name: "Click 6", explanation: "A crisp click. Good for selecting items or snapping controls.", tooltip: "Crisp click for selections.", origin: "Breviceps @ FreeSound (2018)" },
    { id: "click7", category: "click", name: "Click 7", explanation: "A small click. Good for light interface sounds.", tooltip: "Light click for small UI actions.", origin: "JarredGibb @ FreeSound (2014)" },
    { id: "error1", category: "error", name: "Error 1", explanation: "An error or failure sound. Use when something goes wrong.", tooltip: "Error sound for failed actions.", origin: "Splashdust @ FreeSound (2009)" },
    { id: "jingle3", category: "jingle", name: "Jingle 3", explanation: "A short musical success sound. Good when an export or operation finishes.", tooltip: "Short jingle for success or completion.", origin: "Tuben @ FreeSound (2015)" },
    { id: "laugh1", category: "voice-creepy", name: "Evil Laugh 1", explanation: "An evil laugh sound. Good for spooky or game-style effects.", tooltip: "Evil laugh for creepy or joke effects.", origin: "Himan @ Soundbible (2013)" },
    { id: "punch1", category: "impact", name: "Punch 1", explanation: "A punch or whack sound. Good for hits, impacts, or comic effects.", tooltip: "Punch hit sound.", origin: "Vladimir @ Soundbible (2011)" },
    { id: "punch2", category: "impact", name: "Punch 2", explanation: "Another impact punch. Useful for collisions and hits.", tooltip: "Impact punch sound.", origin: "steveuk87 @ FreeSound (2019)" },
    { id: "punch3", category: "impact", name: "Punch 3", explanation: "A harder hit sound. Good for slapstick or fighting effects.", tooltip: "Hard hit sound.", origin: "thefsoundman @ FreeSound (2011)" },
    { id: "resonance1", category: "resonance", name: "Resonance 1", explanation: "A magical appearing sound. Good for reveal, spawn, or transition effects.", tooltip: "Magical appearance sound.", origin: "KP @ Soundbible (2011)" },
    { id: "resonance2", category: "resonance", name: "Resonance 2", explanation: "A power-up style sound. Good for successful actions or energy effects.", tooltip: "Power-up style sound.", origin: "KP @ Soundbible (2010)" },
    { id: "resonance3", category: "resonance", name: "Resonance 3", explanation: "A comet or space-like sound. Good for sci-fi or magical motion.", tooltip: "Spacey resonance sound.", origin: "unknown @ Soundbible (2009)" },
    { id: "scale1", category: "scale", name: "Scale 1", explanation: "A rising magical computer-like sound. Good for progress or transformation.", tooltip: "Rising magic/computer sound.", origin: "Microsift @ Soundbible (2010)" },
    { id: "scale2", category: "scale", name: "Scale 2", explanation: "An electrical sweep. Good for transitions or energy movement.", tooltip: "Electrical sweep sound.", origin: "Sweeper @ Soundbible (2011)" },
    { id: "scale3", category: "scale", name: "Scale 3", explanation: "A music-box style sound. Good for magical, cute, or eerie moments.", tooltip: "Music-box style scale.", origin: "Big Daddy @ Soundbible (2010)" },
    { id: "slide1", category: "slide", name: "Slide 1", explanation: "A sliding motion sound. Good for moving objects or UI panels.", tooltip: "Slide movement sound.", origin: "Sethroph @ FreeSound (2015)" },
    { id: "slide2", category: "slide", name: "Slide 2", explanation: "Another quick slide sound. Good for swipes and transitions.", tooltip: "Quick slide sound.", origin: "_micro @ FreeSound (2013)" },
    { id: "slide4", category: "slide-throw", name: "Slide 4", explanation: "A throw or knife-like movement sound. Good for quick motion or weapon-style effects.", tooltip: "Sharp sliding throw sound.", origin: "Anonymous @ Soundbible (2010)" },
    { id: "slide5", category: "slide", name: "Slide 5", explanation: "A light sliding sound. Good for panels, objects, or transitions.", tooltip: "Light slide movement sound.", origin: "lmbubec @ FreeSound (2011)" },
    { id: "splash1", category: "water", name: "Splash 1", explanation: "A water splash. Good for water, liquids, or comic splats.", tooltip: "Water splash sound.", origin: "Ploor @ Soundbible (2016)" },
    { id: "splash2", category: "water", name: "Splash 2", explanation: "Another splash sound. Good for wet impact effects.", tooltip: "Wet splash impact sound.", origin: "swordofkings128 @ FreeSound (2017)" },
    { id: "throw1", category: "throw", name: "Throw 1", explanation: "A throw or movement sound. Good for tossing or fast motion.", tooltip: "Throw movement sound.", origin: "G-rant @ Soundbible (2011)" },
    { id: "throw2", category: "throw-impact", name: "Throw 2", explanation: "A sharp throw or impact sound. Good for snaps, hits, or dark effects.", tooltip: "Sharp throw or snap sound.", origin: "Vladimir @ Soundbible (2011)" },
    { id: "whoosh2", category: "whoosh", name: "Whoosh 2", explanation: "A fast air movement sound. Good for transitions or objects flying past.", tooltip: "Whoosh sound for fast movement.", origin: "moogy73 @ FreeSound (2018)" },
    { id: "whoosh3", category: "whoosh", name: "Whoosh 3", explanation: "A softer whoosh. Good for scene transitions or magical movement.", tooltip: "Soft whoosh transition.", origin: "snowflakes @ FreeSound (2009)" },
    { id: "whoosh4", category: "whoosh", name: "Whoosh 4", explanation: "A quick whoosh. Good for swipes, cuts, and transitions.", tooltip: "Quick whoosh for transitions.", origin: "qubodup @ FreeSound (2008)" },
    { id: "whoosh5", category: "whoosh", name: "Whoosh 5", explanation: "A spin or jump style whoosh. Good for movement, jumps, or energetic UI.", tooltip: "Spin-jump whoosh sound.", origin: "Brandino480 @ Soundbible (2011)" }
  ].map((item) => ({
    ...item,
    file: `${item.id}.mp3`,
    url: `${RAW_BASE}${item.id}.mp3`,
    license: "CC0",
    attributionRequired: false
  }));

  let previewAudio = null;
  let currentCategory = "all";
  let currentSearch = "";

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .effects-library-button { white-space: nowrap; }
      .effects-library-backdrop { position: fixed; inset: 0; z-index: 2500; display: none; align-items: center; justify-content: center; padding: 20px; background: rgba(6, 8, 8, .72); backdrop-filter: blur(7px); }
      .effects-library-backdrop.open { display: flex; }
      .effects-library-modal { width: min(1080px, 96vw); max-height: min(760px, 92vh); display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 14px; border: 1px solid rgba(224, 163, 96, .58); border-radius: 22px; background: linear-gradient(180deg, rgba(39, 36, 28, .98), rgba(18, 21, 19, .98)), radial-gradient(circle at top left, rgba(117, 178, 222, .12), transparent 45%); box-shadow: 0 26px 80px rgba(0,0,0,.52), inset 0 0 0 1px rgba(255,255,255,.04); color: #f5f0db; padding: 18px; }
      .effects-library-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
      .effects-library-header h3 { margin: 4px 0 6px; font-family: var(--font-headers); font-size: 1.35rem; letter-spacing: .04em; }
      .effects-library-header p { margin: 0; color: rgba(245, 240, 219, .72); max-width: 780px; line-height: 1.45; }
      .effects-library-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .effects-library-search { min-width: min(360px, 100%); flex: 1 1 280px; border: 1px solid rgba(224, 163, 96, .34); border-radius: 999px; background: rgba(0,0,0,.28); color: #f5f0db; padding: 10px 14px; font: 600 .9rem var(--font-body); outline: none; }
      .effects-library-search:focus { border-color: rgba(117, 178, 222, .85); box-shadow: 0 0 0 3px rgba(117, 178, 222, .14); }
      .effects-library-categories { display: flex; flex-wrap: wrap; gap: 7px; }
      .effects-library-chip { border: 1px solid rgba(224, 163, 96, .32); border-radius: 999px; background: rgba(0,0,0,.22); color: rgba(245, 240, 219, .78); padding: 7px 10px; font: 700 .72rem var(--font-mono); letter-spacing: .04em; cursor: pointer; }
      .effects-library-chip.active { background: linear-gradient(135deg, rgba(224,163,96,.28), rgba(117,178,222,.16)); border-color: rgba(224, 163, 96, .72); color: #fff6d9; }
      .effects-library-list { overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(245px, 1fr)); gap: 10px; padding: 2px 3px 4px 0; }
      .effects-library-card { display: grid; grid-template-rows: auto 1fr auto; gap: 9px; border: 1px solid rgba(224, 163, 96, .26); border-radius: 16px; background: rgba(10, 12, 10, .48); padding: 12px; }
      .effects-library-card h4 { margin: 0; font: 800 .95rem var(--font-body); color: #fff7df; }
      .effects-library-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; color: rgba(245,240,219,.66); font: 700 .67rem var(--font-mono); text-transform: uppercase; letter-spacing: .05em; }
      .effects-library-card p { margin: 0; color: rgba(245, 240, 219, .76); font-size: .82rem; line-height: 1.42; }
      .effects-library-actions { display: flex; gap: 8px; align-items: center; }
      .effects-library-actions .tool-button { flex: 1; justify-content: center; }
      .effects-library-empty { grid-column: 1 / -1; border: 1px dashed rgba(224, 163, 96, .34); border-radius: 16px; padding: 22px; color: rgba(245,240,219,.68); text-align: center; }
      .effects-library-footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; color: rgba(245,240,219,.62); font-size: .76rem; }
      @media (max-width: 760px) { .effects-library-modal { padding: 14px; } .effects-library-header { flex-direction: column; } .effects-library-list { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function setVisibleVersion() {
    document.title = `Organon — Simple Edit ${EFFECTS_LIBRARY_VERSION}`;
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (!title) return;
    let badge = brand.querySelector(".phase1-version, .simple-edit-version");
    if (!badge) {
      badge = document.createElement("span");
      title.appendChild(badge);
    }
    badge.className = "phase1-version simple-edit-version";
    badge.textContent = EFFECTS_LIBRARY_VERSION;
  }

  function categoryLabel(category) {
    return category.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function filteredEffects() {
    const needle = currentSearch.trim().toLowerCase();
    return EFFECTS.filter((effect) => {
      const categoryMatch = currentCategory === "all" || effect.category === currentCategory;
      const text = `${effect.id} ${effect.name} ${effect.category} ${effect.explanation} ${effect.tooltip}`.toLowerCase();
      return categoryMatch && (!needle || text.includes(needle));
    });
  }

  function ensureButton() {
    if (document.getElementById("effectsLibraryBtn")) return;
    const button = document.createElement("button");
    button.className = "tool-button effects-library-button";
    button.id = "effectsLibraryBtn";
    button.type = "button";
    button.textContent = "🎧 Effects Library";
    button.title = "Open the CC0 sound effects library.";
    button.addEventListener("click", openLibrary);
    const importButton = document.getElementById("importBtn");
    if (importButton) importButton.insertAdjacentElement("afterend", button);
    else document.querySelector(".transport, .phase1-timeline-toolbar, .toolbar-actions")?.prepend(button);
    ui.effectsLibraryBtn = button;
  }

  function ensureModal() {
    if (document.getElementById("effectsLibraryBackdrop")) return;
    const backdrop = document.createElement("div");
    backdrop.id = "effectsLibraryBackdrop";
    backdrop.className = "effects-library-backdrop";
    backdrop.innerHTML = `
      <div class="effects-library-modal" role="dialog" aria-modal="true" aria-labelledby="effectsLibraryTitle">
        <div class="effects-library-header">
          <div>
            <span class="eyebrow">CC0 source effects</span>
            <h3 id="effectsLibraryTitle">Effects Library</h3>
            <p>These are CC0 SoundFX sounds only, so they do not need attribution. Preview a sound, then add it to the selected track at the playhead.</p>
          </div>
          <button class="icon-button" id="effectsLibraryCloseBtn" type="button" title="Close">×</button>
        </div>
        <div class="effects-library-tools">
          <input class="effects-library-search" id="effectsLibrarySearch" type="search" placeholder="Search alarms, clicks, whooshes, impacts...">
          <div class="effects-library-categories" id="effectsLibraryCategories"></div>
        </div>
        <div class="effects-library-list" id="effectsLibraryList"></div>
        <div class="effects-library-footer"><span id="effectsLibraryCount"></span><span>Source: rse/soundfx · CC0 files only · loaded from raw GitHub MP3s</span></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) closeLibrary(); });
    backdrop.querySelector("#effectsLibraryCloseBtn")?.addEventListener("click", closeLibrary);
    backdrop.querySelector("#effectsLibrarySearch")?.addEventListener("input", (event) => { currentSearch = event.target.value; renderEffects(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && backdrop.classList.contains("open")) closeLibrary(); });
    renderCategories();
    renderEffects();
  }

  function renderCategories() {
    const target = document.getElementById("effectsLibraryCategories");
    if (!target) return;
    const categories = ["all", ...new Set(EFFECTS.map((effect) => effect.category))];
    target.innerHTML = "";
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `effects-library-chip${category === currentCategory ? " active" : ""}`;
      button.textContent = category === "all" ? `All ${EFFECTS.length}` : categoryLabel(category);
      button.addEventListener("click", () => { currentCategory = category; renderCategories(); renderEffects(); });
      target.appendChild(button);
    });
  }

  function renderEffects() {
    const list = document.getElementById("effectsLibraryList");
    const count = document.getElementById("effectsLibraryCount");
    if (!list) return;
    const effects = filteredEffects();
    if (count) count.textContent = `${effects.length} of ${EFFECTS.length} CC0 sounds shown`;
    list.innerHTML = "";
    if (!effects.length) {
      list.innerHTML = '<div class="effects-library-empty">No matching effects.</div>';
      return;
    }
    effects.forEach((effect) => {
      const card = document.createElement("article");
      card.className = "effects-library-card";
      card.innerHTML = `
        <div><h4>${escapeHtml(effect.name)}</h4><div class="effects-library-meta"><span>${escapeHtml(categoryLabel(effect.category))}</span><span>${effect.license}</span></div></div>
        <p title="${escapeHtml(effect.tooltip)}">${escapeHtml(effect.explanation)}</p>
        <div class="effects-library-actions"><button class="tool-button" type="button" data-preview="${effect.id}">▶ Preview</button><button class="tool-button primary" type="button" data-add="${effect.id}">＋ Add</button></div>
      `;
      card.querySelector("[data-preview]")?.addEventListener("click", () => previewEffect(effect));
      card.querySelector("[data-add]")?.addEventListener("click", () => addEffectToTimeline(effect));
      list.appendChild(card);
    });
  }

  function openLibrary() {
    ensureModal();
    const backdrop = document.getElementById("effectsLibraryBackdrop");
    backdrop?.classList.add("open");
    backdrop?.querySelector("#effectsLibrarySearch")?.focus();
  }

  function closeLibrary() {
    document.getElementById("effectsLibraryBackdrop")?.classList.remove("open");
    stopPreview();
  }

  function stopPreview() {
    if (!previewAudio) return;
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio = null;
  }

  function previewEffect(effect) {
    stopPreview();
    previewAudio = new Audio(effect.url);
    previewAudio.preload = "auto";
    previewAudio.play().catch((error) => {
      console.error(error);
      showToast(`${effect.name} preview could not be played.`);
    });
  }

  async function addEffectToTimeline(effect) {
    if (!audioContext) {
      showToast("This browser does not provide the Web Audio engine required by Simple Edit.");
      return;
    }
    try {
      stopPreview();
      setStatus(`Loading ${effect.name}…`);
      const response = await fetch(effect.url, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const asset = {
        id: makeId("asset"),
        file: null,
        name: `${effect.name}.mp3`,
        kind: `CC0 ${categoryLabel(effect.category)}`,
        buffer,
        duration: buffer.duration,
        peaks: makePeaks(buffer),
        source: { library: "rse/soundfx", soundId: effect.id, license: "CC0", attributionRequired: false, origin: effect.origin, url: effect.url, tooltip: effect.tooltip, explanation: effect.explanation }
      };
      state.assets.push(asset);
      state.selectedAssetId = asset.id;
      renderAssets();
      addClipFromAsset(asset.id, state.selectedTrack, state.playhead);
      setStatus(`${effect.name} added to Track ${state.selectedTrack + 1}`);
      setTimeout(clearHubStatus, 3200);
    } catch (error) {
      console.error(error);
      setStatus("Ready");
      showToast(`${effect.name} could not be loaded from the effects library.`);
    }
  }

  installStyles();
  ensureButton();
  ensureModal();
  setVisibleVersion();
  window.simpleEditEffectsLibrary = { version: EFFECTS_LIBRARY_VERSION, items: EFFECTS.map((effect) => ({ ...effect })) };
})();
