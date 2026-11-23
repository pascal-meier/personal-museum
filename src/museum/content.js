import { bindTranslations } from "../i18n/language.js";

export async function loadExhibition({
  url = "./exhibition.html",
  fetchContent = fetch,
  parser = new DOMParser(),
  language
} = {}) {
  const response = await fetchContent(url, { cache: "no-cache" });
  if (!response.ok) throw new Error("Exhibition content could not be loaded.");
  // Keep the catalogue and its media inert while reading it for the 3D tour.
  const html = await response.text();
  const page = parser.parseFromString("<template>" + html + "</template>", "text/html")
    .querySelector("template").content;
  const source = page.getElementById("exhibition-content")?.content;
  if (!source) throw new Error("Exhibition content template is missing.");
  const catalogue = page.getElementById("catalogue");
  if (catalogue) source.append(catalogue);

  const details = new Map();
  const gallerySources = new Map();
  const galleryImageSizes = new Map();
  const roomsById = new Map();
  source.querySelectorAll("img[data-gallery-src]").forEach(image => {
    gallerySources.set(image.getAttribute("src"), image.getAttribute("data-gallery-src"));
  });
  source.querySelectorAll(".exhibit img").forEach(image => {
    const width = Number(image.getAttribute("width"));
    const height = Number(image.getAttribute("height"));
    if (!(width > 0 && height > 0)) {
      throw new Error("Exhibit image needs width and height: " + image.getAttribute("src"));
    }
    galleryImageSizes.set(image.getAttribute("src"), { width, height });
  });
  const translate = bindTranslations(source);
  translate(language ?? document.documentElement.lang);
  source.querySelectorAll(".project-detail").forEach(article => {
    details.set(article.id.replace("project-", ""), article);
  });
  const rooms = Array.from(source.querySelectorAll(".room")).map((room, index) => {
    const works = Array.from(room.querySelectorAll(".exhibit")).map(button => {
      const image = button.querySelector(".mounted-image");
      let kind = "image";
      if (button.classList.contains("sprite-work")) kind = "sprites";
      if (button.classList.contains("kinbot-work")) kind = "kinbot";
      if (button.classList.contains("asset-board-work")) kind = "board";
      if (button.classList.contains("character-sheet-work")) kind = "characters";
      if (button.classList.contains("process-work")) kind = "process";
      return {
        source: button,
        project: button.dataset.project,
        src: image?.getAttribute("src"),
        pixelated: image?.classList.contains("pixel-image"),
        paperBackground: button.hasAttribute("data-paper-background")
          || image?.classList.contains("research-diagram"),
        sprites: Array.from(
          button.querySelectorAll(".sprite-grid img, .asset-board img, .kinbot-logo, .process-sources img"),
          image => image.getAttribute("src")
        ),
        kind,
        process: button.dataset.process,
        companion: button.hasAttribute("data-companion"),
        hideLabel: !button.querySelector(".work-label"),
        group: Number(button.dataset.wallGroup || 0)
      };
    });
    return {
      id: room.dataset.roomId,
      index,
      works,
      children: [],
      source: room,
      display: room.dataset.display,
      theme: room.dataset.roomTheme || "",
      get name() { return room.dataset.roomName; },
      get intro() { return room.querySelector(".room-intro").textContent; }
    };
  });
  rooms.forEach(room => roomsById.set(room.id, room));
  rooms.forEach(room => {
    const parentId = room.source.dataset.parent;
    if (!parentId) return;
    const parent = roomsById.get(parentId);
    if (!parent) throw new Error("Room has unknown parent: " + room.id + " → " + parentId);
    room.parent = parent;
    parent.children.push(room);
  });
  return {
    rooms,
    roomsById,
    details,
    gallerySources,
    galleryImageSizes,
    aboutSource: source.getElementById("about-view"),
    translate
  };
}
