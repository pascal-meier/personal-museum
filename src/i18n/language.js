import { german } from "./de.js";
import { english } from "./en.js";

const preferenceKey = "museum-language";
const translatedAttributes = ["alt", "aria-label", "data-room-name", "title", "label", "content"];
const bindingSelector = [
  "[data-i18n]", "[data-i18n-text]",
  ...translatedAttributes.map(name => "[data-i18n-" + name + "]")
].join(", ");

export function preferredLanguage() {
  try { return localStorage.getItem(preferenceKey) === "de" ? "de" : "en"; }
  catch { return "en"; }
}

export function saveLanguage(language) {
  try { localStorage.setItem(preferenceKey, language); }
  catch { /* Die Auswahl gilt weiterhin für die geöffnete Seite. */ }
}


export function translate(key, language, fallback) {
  return (language === "de" ? german[key] : english[key]) ?? fallback ?? english[key] ?? key;
}

export function t(key) {
  return translate(key, document.documentElement.lang);
}

// Explizite IDs statt Wortlaut-Vergleichen. Direkte Textknoten erhalten ihr Markup und ihre Abstände.
// data-i18n-text="0:copy.first 1:copy.second" bindet mehrere direkte, nichtleere Textknoten.
export function bindTranslations(root) {
  const bindings = [];
  const elements = [...root.querySelectorAll(bindingSelector)];
  if (root.nodeType === 1) elements.unshift(root);
  for (const element of elements) {
    const textNodes = [...element.childNodes].filter(node => node.nodeType === 3 && node.data.trim());
    const entries = element.hasAttribute("data-i18n")
      ? [[0, element.getAttribute("data-i18n")]]
      : (element.getAttribute("data-i18n-text") || "").split(/\s+/).filter(Boolean).map(entry => {
        const colon = entry.indexOf(":");
        return [Number(entry.slice(0, colon)), entry.slice(colon + 1)];
      });
    for (const [index, key] of entries) {
      const node = textNodes[index];
      if (!node) continue;
      const original = node.data;
      const leading = original.match(/^\s*/)[0], trailing = original.match(/\s*$/)[0];
      bindings.push(language => {
        node.data = language === "de"
          ? leading + translate(key, language, original.trim()) + trailing
          : original;
      });
    }
    for (const attribute of translatedAttributes) {
      const key = element.getAttribute("data-i18n-" + attribute);
      if (!key) continue;
      const original = element.getAttribute(attribute) || "";
      bindings.push(language => element.setAttribute(attribute,
        language === "de" ? translate(key, language, original) : original));
    }
  }
  // The original HTML already contains the English text.
  let currentLanguage = "en";
  return language => {
    if (language === currentLanguage) return;
    bindings.forEach(apply => apply(language));
    currentLanguage = language;
  };
}
