import { bindTranslations, preferredLanguage, saveLanguage } from "./i18n/language.js";

const list = document.getElementById("catalogue-links");
const toggle = document.getElementById("catalogue-language");
const index = document.getElementById("work-index");
const about = document.getElementById("about-view");
const translate = bindTranslations(document);
const works = new Map();
for (const article of document.querySelectorAll("#catalogue .project-detail")) {
  works.set(article.id, article);
  article.hidden = true;
}
about.hidden = true;
let current = index;

// Use the wall order first, then include every additional detail article once.
const exhibits = document.getElementById("exhibition-content").content.querySelectorAll(".exhibit[data-project]");
const ids = new Set(Array.from(exhibits, exhibit => "project-" + exhibit.dataset.project));
for (const id of works.keys()) ids.add(id);
const labels = new Map();
const items = document.createDocumentFragment();
for (const id of ids) {
  const article = works.get(id);
  if (!article) continue;
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = "#" + id;
  labels.set(link, article.querySelector("h2"));
  item.append(link);
  items.append(item);
}
list.replaceChildren(items);

function updateTitle() {
  document.title = current.querySelector("h1, h2").textContent + " · Pascal Meier";
}

function setLanguage(language) {
  document.documentElement.lang = language;
  translate(language);
  toggle.textContent = language === "de" ? "English" : "Deutsch";
  toggle.lang = language === "de" ? "en" : "de";
  for (const [link, heading] of labels) link.textContent = heading.textContent;
  updateTitle();
}

function showSelection() {
  const id = location.hash.slice(1);
  const next = works.get(id) || (id === about.id ? about : index);
  if (current === next) return;
  current.querySelectorAll("video").forEach(video => video.pause());
  current.hidden = true;
  current = next;
  current.hidden = false;
  updateTitle();
}

setLanguage(preferredLanguage());
showSelection();
toggle.hidden = false;
toggle.addEventListener("click", () => {
  const language = document.documentElement.lang === "de" ? "en" : "de";
  setLanguage(language);
  saveLanguage(language);
});
window.addEventListener("hashchange", () => {
  showSelection();
  current.tabIndex = -1;
  current.focus({ preventScroll: true });
  window.scrollTo(0, 0);
});
