export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({
    antialias: false,
    pixelRatio: 1,
    shadows: false,
    shadowSize: 1024,
    spotShadowSize: 512,
    postProcessing: false,
    samples: 0
  }),
  medium: Object.freeze({
    antialias: true,
    pixelRatio: 1.5,
    shadows: true,
    shadowSize: 2048,
    spotShadowSize: 1024,
    postProcessing: false,
    samples: 2
  }),
  high: Object.freeze({
    antialias: true,
    pixelRatio: 2,
    shadows: true,
    shadowSize: 4096,
    spotShadowSize: 1024,
    postProcessing: true,
    samples: 4
  })
});

export const QUALITY_STORAGE_KEY = "museum-quality";

export function normalizeQuality(value) {
  return Object.hasOwn(QUALITY_PROFILES, value) ? value : "auto";
}

export function selectRenderQuality({
  location = globalThis.location,
  navigator = globalThis.navigator,
  reducedMotion = false,
  savedQuality = "auto"
} = {}) {
  const params = new URLSearchParams(location?.search);
  const requested = normalizeQuality(params.has("quality") ? params.get("quality") : savedQuality);
  const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
  const memory = Number(navigator?.deviceMemory);
  const cores = Number(navigator?.hardwareConcurrency);
  const constrained = connection?.saveData
    || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType)
    || (Number.isFinite(memory) && memory <= 4)
    || (Number.isFinite(cores) && cores <= 4);
  let level = requested;
  if (level === "auto") {
    level = constrained ? "low"
      : memory >= 8 && cores >= 8 ? "high"
      : "medium";
  }
  const profile = QUALITY_PROFILES[level];
  const effectsOff = params.get("effects") === "off";
  return {
    ...profile,
    level,
    requested,
    constrained,
    reducedMotion: Boolean(reducedMotion),
    postProcessing: profile.postProcessing && !effectsOff && !reducedMotion
  };
}

export function initQualityPicker(doc = document, reducedMotion = false) {
  const view = doc.defaultView;
  const picker = doc.getElementById("museum-quality");
  let savedQuality;
  try { savedQuality = view.localStorage.getItem(QUALITY_STORAGE_KEY); } catch { /* The URL remains available. */ }
  const quality = selectRenderQuality({ location: view.location, navigator: view.navigator, reducedMotion, savedQuality });
  picker.value = quality.requested;
  picker.disabled = false;
  picker.addEventListener("change", () => {
    const value = normalizeQuality(picker.value);
    const url = new URL(view.location.href);
    try {
      view.localStorage.setItem(QUALITY_STORAGE_KEY, value);
      url.searchParams.delete("quality");
    } catch {
      url.searchParams.set("quality", value);
    }
    view.history.replaceState(view.history.state, "", url);
    view.location.reload();
  });
  return quality;
}
