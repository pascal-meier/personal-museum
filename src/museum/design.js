export const DEFAULT_DESIGN = "walnut";
export const DESIGN_STORAGE_KEY = "museum-design";
export const DESIGN_IDS = ["atelier", "walnut", "white-cube", "sci-fi", "japanese"];

export function normalizeDesign(value) {
  return DESIGN_IDS.includes(value) ? value : DEFAULT_DESIGN;
}

export function getMuseumDesign(doc = document) {
  return normalizeDesign(doc.documentElement.dataset.design);
}

export function initDesignPicker(doc = document) {
  const picker = doc.getElementById("museum-design");
  let saved;
  try { saved = doc.defaultView.localStorage.getItem(DESIGN_STORAGE_KEY); } catch { /* Storage is optional. */ }
  function apply(value, persist = false) {
    const design = normalizeDesign(value);
    doc.documentElement.dataset.design = design;
    if (picker) picker.value = design;
    if (persist) {
      try { doc.defaultView.localStorage.setItem(DESIGN_STORAGE_KEY, design); } catch { /* Keep the in-memory choice. */ }
      doc.dispatchEvent(new doc.defaultView.CustomEvent("museum-design-change", { detail: { design } }));
    }
  }
  apply(saved);
  const change = () => apply(picker.value, true);
  picker?.addEventListener("change", change);
  return () => picker?.removeEventListener("change", change);
}
