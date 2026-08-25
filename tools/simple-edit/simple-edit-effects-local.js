"use strict";

(function installSimpleEditLocalEffectsPatch() {
  const LOCAL_EFFECTS_VERSION = "v0.16";
  const REMOTE_BASE = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_BASE = "./soundeffects/";

  function localizeSoundfxUrl(value) {
    const text = String(value || "");
    if (!text.startsWith(REMOTE_BASE)) return value;
    return `${LOCAL_BASE}${text.slice(REMOTE_BASE.length)}`;
  }

  if (!window.__simpleEditLocalSoundFxFetchPatched) {
    window.__simpleEditLocalSoundFxFetchPatched = true;
    const originalFetch = window.fetch?.bind(window);
    if (originalFetch) {
      window.fetch = function patchedSoundFxFetch(resource, init) {
        if (typeof resource === "string") {
          return originalFetch(localizeSoundfxUrl(resource), init);
        }
        if (resource && typeof resource.url === "string") {
          const localized = localizeSoundfxUrl(resource.url);
          if (localized !== resource.url) return originalFetch(localized, init);
        }
        return originalFetch(resource, init);
      };
    }
  }

  if (!window.__simpleEditLocalSoundFxAudioPatched && window.Audio) {
    window.__simpleEditLocalSoundFxAudioPatched = true;
    const NativeAudio = window.Audio;
    function LocalSoundFxAudio(src) {
      return src === undefined ? new NativeAudio() : new NativeAudio(localizeSoundfxUrl(src));
    }
    LocalSoundFxAudio.prototype = NativeAudio.prototype;
    Object.setPrototypeOf(LocalSoundFxAudio, NativeAudio);
    window.Audio = LocalSoundFxAudio;
  }

  if (!window.__simpleEditLocalSoundFxMediaSrcPatched && window.HTMLMediaElement?.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, "src");
    if (descriptor?.get && descriptor?.set) {
      window.__simpleEditLocalSoundFxMediaSrcPatched = true;
      Object.defineProperty(window.HTMLMediaElement.prototype, "src", {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          descriptor.set.call(this, localizeSoundfxUrl(value));
        }
      });
    }
  }

  function setVersionBadge() {
    document.title = `Organon — Simple Edit ${LOCAL_EFFECTS_VERSION}`;
    const badge = document.querySelector(".phase1-version, .simple-edit-version");
    if (badge) badge.textContent = LOCAL_EFFECTS_VERSION;
  }

  function markEffectsLibraryAsLocal() {
    const footer = document.querySelector(".effects-library-footer");
    if (footer && !footer.dataset.localSoundfx) {
      footer.dataset.localSoundfx = "true";
      const note = document.createElement("span");
      note.textContent = "Using local /tools/simple-edit/soundeffects files.";
      footer.appendChild(note);
    }

    document.querySelectorAll(".effects-library-card").forEach((card) => {
      if (card.dataset.localSoundfx) return;
      card.dataset.localSoundfx = "true";
      card.title = `${card.title ? `${card.title} ` : ""}Loaded from Organon/tools/simple-edit/soundeffects.`;
    });
  }

  setVersionBadge();
  setStatus?.("Ready — effects library uses local soundeffects files");
  setTimeout(clearHubStatus, 2600);

  document.addEventListener("click", () => setTimeout(markEffectsLibraryAsLocal, 0), true);
  const observer = new MutationObserver(markEffectsLibraryAsLocal);
  observer.observe(document.body, { childList: true, subtree: true });
})();
