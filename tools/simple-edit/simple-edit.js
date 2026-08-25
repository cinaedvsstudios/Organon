"use strict";

(async () => {
  const VERSION = "v0.33";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";

  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setFinalVersion() {
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

  function localizeSoundFxUrl(value) {
    const text = String(value || "");
    return text.startsWith(REMOTE_SOUND_FX) ? `${LOCAL_SOUND_FX}${text.slice(REMOTE_SOUND_FX.length)}` : value;
  }

  function installLocalSoundFxRouting() {
    if (!window.__orgavoxLocalSoundFxFetchPatched) {
      window.__orgavoxLocalSoundFxFetchPatched = true;
      const originalFetch = window.fetch?.bind(window);
      if (originalFetch) {
        window.fetch = function orgavoxSoundFxFetch(resource, init) {
          if (typeof resource === "string") return originalFetch(localizeSoundFxUrl(resource), init);
          if (resource && typeof resource.url === "string") {
            const localized = localizeSoundFxUrl(resource.url);
            if (localized !== resource.url) return originalFetch(localized, init);
          }
          return originalFetch(resource, init);
        };
      }
    }
    if (!window.__orgavoxLocalSoundFxAudioPatched && window.Audio) {
      window.__orgavoxLocalSoundFxAudioPatched = true;
      const NativeAudio = window.Audio;
      function OrgavoxAudio(src) { return src === undefined ? new NativeAudio() : new NativeAudio(localizeSoundFxUrl(src)); }
      OrgavoxAudio.prototype = NativeAudio.prototype;
      Object.setPrototypeOf(OrgavoxAudio, NativeAudio);
      window.Audio = OrgavoxAudio;
    }
    if (!window.__orgavoxLocalSoundFxMediaSrcPatched && window.HTMLMediaElement?.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, "src");
      if (descriptor?.get && descriptor?.set) {
        window.__orgavoxLocalSoundFxMediaSrcPatched = true;
        Object.defineProperty(window.HTMLMediaElement.prototype, "src", {
          configurable: true,
          enumerable: descriptor.enumerable,
          get() { return descriptor.get.call(this); },
          set(value) { descriptor.set.call(this, localizeSoundFxUrl(value)); }
        });
      }
    }
  }

  function restoreLateFeatureButtons() {
    try { if (typeof ui !== "undefined") window.orgavoxRefreshLayout?.(); }
    catch (error) { console.warn("ORGAVOX could not restore late feature buttons.", error); }
  }

  installLocalSoundFxRouting();

  const files = [
    "./simple-edit-core.js?v=0.01",
    "./simple-edit-timeline.js?v=0.01",
    "./simple-edit-audio.js?v=0.26",
    "./simple-edit-export.js?v=0.02",
    "./simple-edit-phase1.js?v=0.33",
    "./simple-edit-keyframes.js?v=0.10",
    "./simple-edit-keyframes-fix.js?v=0.11",
    "./simple-edit-phase3.js?v=0.13",
    "./simple-edit-effects-library.js?v=0.15",
    "./simple-edit-echo-settings.js?v=0.25",
    "./simple-edit-stretch-audiotsm.js?v=0.19",
    "./simple-edit-fade-handles.js?v=0.20",
    "./simple-edit-normalize.js?v=0.21",
    "./simple-edit-transpose-engine.js?v=0.26",
    "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28",
    "./simple-edit-eq.js?v=0.28",
    "./simple-edit-drive-engine.js?v=0.29",
    "./simple-edit-drive.js?v=0.29",
    "./simple-edit-dynamics-engine.js?v=0.30",
    "./simple-edit-dynamics.js?v=0.30"
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

  window.orgavoxRefreshLayout?.();
  restoreLateFeatureButtons();
  setFinalVersion();
  document.documentElement.classList.remove("orgavox-loading");
  document.getElementById("orgavox-boot-style")?.remove();
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX loaded");
  setTimeout(restoreLateFeatureButtons, 0);
  setTimeout(restoreLateFeatureButtons, 150);
  window.addEventListener("resize", () => setTimeout(restoreLateFeatureButtons, 0));
})().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove("orgavox-loading");
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "ORGAVOX failed to load";
});
