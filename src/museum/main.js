import { createPlaneProjector, createOcclusionTester, isWorldVisible } from "./projection.js";
import { findGuidedRoute, isWalkBlocked } from "./routing.js";
import { createWalkControls } from "./walk.js";
import { watchGamepads } from "./gamepad.js";
import { createTextureQueue, createMediaViewport } from "./media.js";
import { HALL_BAY, distributeWallGroups, distributeEntranceGroups, fitHallExhibitScale, galleryFurnitureLayout, hallWallTitleLayout, spaceExhibitColumns, photoWallLayout, gameWallStyle } from "./layout.js";
import { createPosterRenderer } from "../scene/exhibit-posters.js";
import { createHallDisplays } from "../scene/hall-displays.js";
import { createHallAtmosphere, HALL_RUG_THICKNESS, roundedBoxGeometry, WALNUT_DADO_RAIL_TOP } from "../scene/hall-atmosphere.js";
import * as THREE from "../../vendor/three/three.module.min.js";
import { shareSpotlightCalculation } from "./lighting.js";
import { createDaylightArchitecture } from "../scene/daylight-architecture.js";
import { bindTranslations, preferredLanguage, saveLanguage, t } from "../i18n/language.js";
import { getMuseumDesign, initDesignPicker } from "./design.js";
import { initQualityPicker } from "./quality.js";
import { loadExhibition } from "./content.js";
import { createMuseumNavigation } from "./navigation.js";
import { createMuseumEffects } from "./effects.js";

/*
  1. Inhalte aus exhibition.html lesen: Texte und Werkbeschreibungen nur einmal pflegen.
  2. Lobby, Themenräume und Projekträume mit beschrifteten Türen verbinden.
  3. Kamerafahrten laufen nur auf Klick. Im Stillstand wird nicht weiter gezeichnet.
*/
const stage = document.getElementById("gallery-stage");
const canvas = document.getElementById("gallery-canvas");
const status = document.getElementById("gallery-status");
const loadingScreen = document.getElementById("museum-loading");
const loadingHint = document.getElementById("museum-loading-hint");
const mouseLookButton = document.getElementById("mouse-look");
const mouseLookStatus = document.getElementById("mouse-look-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const renderQuality = initQualityPicker(document, reducedMotion.matches);
const workDialog = document.getElementById("work-dialog");
const roomSignButton = document.getElementById("open-room-sign");
const previousButton = document.getElementById("previous-room");
const roomDoors = document.getElementById("room-doors");
const heading = document.getElementById("room-heading");
const labels = document.getElementById("work-labels");
const languageToggle = document.getElementById("language-toggle");
initDesignPicker();
const translatePage = bindTranslations(document);
let exhibition;
let rooms, roomsById;
let currentRoom = 0;
let photoStop = 0;
let travelling = false;
let navigate = null;
let finishWalk = null;
let repaintMuseumCopy = null;
let museumNavigation = null;
let statusMessage = "copy.preparing-the-exhibition";
const loadingHintTimer = window.setTimeout(() => {
  if (!stage.classList.contains("is-ready") && !stage.classList.contains("has-startup-error")) {
    loadingHint.hidden = false;
  }
}, 8000);


function setLanguage(language) {
  document.documentElement.lang = language;
  translatePage(language);
  exhibition?.translate(language);
  languageToggle.textContent = language === "de" ? "EN" : "DE";
  languageToggle.lang = language === "de" ? "en" : "de";
  languageToggle.setAttribute("aria-label", language === "de" ? "Switch to English" : "Auf Deutsch wechseln");
  status.textContent = t(statusMessage);
  museumNavigation?.refreshCopy();
  repaintMuseumCopy?.();
}

setLanguage(preferredLanguage());
languageToggle.disabled = false;
languageToggle.addEventListener("click", function () {
  const language = document.documentElement.lang === "de" ? "en" : "de";
  setLanguage(language);
  saveLanguage(language);
});

try {
  exhibition = await loadExhibition();
  ({ rooms, roomsById } = exhibition);
  const { details, aboutSource } = exhibition;
  museumNavigation = createMuseumNavigation({
    document, history, location, rooms, roomsById, details, aboutSource, t,
    getCurrentRoom: () => currentRoom,
    getPhotoStop: () => photoStop,
    getTravelling: () => travelling,
    getNavigate: () => navigate,
    finishWalk: () => finishWalk?.(),
    sectionEntry,
    onCopyRefreshed: updateRoomCopy
  });
  currentRoom = museumNavigation.roomFromHash();
  museumNavigation.prepare();
  const linkedWork = /^#work\/([\w-]+)$/.exec(location.hash)?.[1];
  if (linkedWork && details.has(linkedWork) && !history.state?.museumPopups?.length) {
    // A fresh direct link gets a local room underneath, so closing it never leaves the site.
    history.replaceState({museumPopups:[], photoStop}, "", "#" + rooms[currentRoom].id);
    openWork(linkedWork, heading.querySelector("h1"));
  } else {
    if (!linkedWork || !details.has(linkedWork)) history.replaceState(history.state, "", "#" + rooms[currentRoom].id);
    museumNavigation.restorePopups();
  }
  // A work link can be read immediately, even on devices without WebGL.
  if (document.querySelector("dialog[open]")) {
    await new Promise(resolve => {
      function onClose() {
        if (document.querySelector("dialog[open]")) return;
        document.removeEventListener("close", onClose, true);
        resolve();
      }
      document.addEventListener("close", onClose, true);
    });
  }
  await createMuseum(exhibition);
} catch (error) {
  window.clearTimeout(loadingHintTimer);
  stage.classList.add("has-startup-error");
  stage.removeAttribute("aria-busy");
  loadingScreen.hidden = true;
  statusMessage = "copy.the-museum-view-could-not-be-loaded-please-reload";
  status.hidden = false;
  status.textContent = t(statusMessage);
  console.error("Museum:", error);
}

function openWork(project, button) {
  museumNavigation?.openWork(project, button);
}

function compactGallery() {
  return new URLSearchParams(location.search).get("view") === "compact";
}

function sectionEntry(room) {
  if (compactGallery()) return room;
  return room && ["games", "web-design", "graphic-design"].includes(room.id) ? room.children.find(child => child.works.length) || room : room;
}
function goToRoom(room, animate = true, photo = 0) {
  museumNavigation?.goToRoom(room, animate, photo);
}

function categoryFor(room) {
  return ["photos", "games", "web-design", "graphic-design"].includes(room.id) ? room.id : room.parent?.id;
}
function categoryStops(room) {
  const category = categoryFor(room);
  if (category === "photos") {
    const photos = roomsById.get("photos");
    if (!compactGallery()) return [{room:photos, photo:photoStop, name:photos.name}];
    return photos.works.map((work, photo) => ({ room: photos, photo, name: work.source.querySelector(".work-label strong").textContent }));
  }
  return rooms.filter(item => item.parent?.id === category && item.works.length)
    .map(item => ({ room: item, photo: 0, name: item.name }));
}
function updateHallGuide() {
  const de = document.documentElement.lang === "de";
  const room = rooms[currentRoom];
  if (!room) return;
  const category = categoryFor(room), stops = categoryStops(room);
  const at = stops.findIndex(stop => stop.room === room && stop.photo === photoStop);
  document.querySelectorAll("[data-guide-de]").forEach(element => {
    element.textContent = element.dataset[de ? "guideDe" : "guideEn"];
  });
  document.getElementById("hall-welcome").hidden = false;
  document.getElementById("hall-welcome").setAttribute("aria-label", de ? "Bereich wählen" : "Choose a section");
  document.querySelector(".hall-directions").setAttribute("aria-label", de ? "Ausstellungsbereiche" : "Exhibition sections");
  const stepCaption = document.querySelector(".hall-controls .nav-caption");
  if (stepCaption) {
    const categoryButton = document.querySelector('[data-guide-target][data-category="' + category + '"]');
    const categoryName = categoryButton?.dataset[de ? "guideDe" : "guideEn"] || "";
    stepCaption.textContent = (de ? "Im Bereich " : "In ") + categoryName + (at >= 0 && stops.length > 1 ? " · " + (at + 1) + " / " + stops.length : "");
  }
  document.querySelectorAll("[data-guide-target]").forEach(button => {
    button.disabled = !navigate || travelling;
    button.setAttribute("aria-pressed", String(button.dataset.category === category));
  });
  document.querySelectorAll("[data-tour-step]").forEach(button => {
    const step = Number(button.dataset.tourStep), destination = stops[at + step];
    button.textContent = step < 0 ? (de ? "← Zurück" : "← Previous") : step === 0 ? (de ? "Zur Lobby" : "To lobby") : (de ? "Weiter →" : "Next →");
    button.setAttribute("aria-label", button.textContent + (step && destination ? ": " + destination.name : ""));
    button.disabled = !navigate || travelling || (step !== 0 && (at < 0 || !destination));
  });

}

function updateRoomCopy() {
  const room = rooms[currentRoom];
  roomSignButton.textContent = room.name;
  roomSignButton.setAttribute("aria-label", t("copy.read-room-sign") + ": " + room.name);
  heading.querySelector("h1").textContent = room.name;
  heading.querySelector(".room-intro").textContent = room.intro;
  stage.setAttribute("aria-label", room.name);
  previousButton.hidden = !room.parent || room.display === "hub";
  if (room.parent) {
    document.getElementById("back-room-name").textContent = room.parent.name;
    previousButton.setAttribute("aria-label", museumNavigation.returnTo(room.parent));
  }
  document.title = room.id === "lobby" ? "Pascal Meier · Museum" : room.name + " — Pascal Meier / " + t("copy.museum");
  updateHallGuide();
}

function showRoom(index) {
  const roomChanged = index !== currentRoom;
  currentRoom = index;
  const room = rooms[index];
  stage.dataset.layout = room.display;
  stage.dataset.theme = room.theme;
  stage.dataset.room = room.id;
  stage.dispatchEvent(new Event("museum-room-change"));
  rooms.forEach(item => { item.labels.hidden = item !== room; });
  roomSignButton.disabled = previousButton.disabled = false;
  roomDoors.replaceChildren(...room.doorButtons);
  roomDoors.hidden = !room.doorButtons.length;
  updateRoomCopy();
  rooms.forEach(function (item) {
    if (item === room) item.listButton.setAttribute("aria-current", "location");
    else item.listButton.removeAttribute("aria-current");
  });
  // Auf dem Handy führt die Navigation unter dem langen Raum wieder zum neuen Eingang.
  if (roomChanged && window.matchMedia("(max-width: 900px)").matches) stage.scrollIntoView({ block: "start", behavior: "instant" });
}

// A small procedural interior (no HDR file) gives glass, wood and metal something to reflect.
function createGalleryEnvironment(renderer) {
  const room = new THREE.Scene();
  const panel = (color, intensity, w, h, position, rotation) => {
    const light = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    light.position.set(...position); light.rotation.set(...rotation); room.add(light);
  };
  room.add(new THREE.Mesh(new THREE.BoxGeometry(60, 24, 60),
    new THREE.MeshBasicMaterial({ color: "#b9b1a3", side: THREE.BackSide })));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: "#6f5f4b" }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -11.9; room.add(floor);
  for (let row = -2; row <= 2; row++) panel("#fff1dc", 7, 40, 1.2, [0, 11.9, row * 9], [Math.PI / 2, 0, 0]);
  panel("#dbe8f5", 5, 52, 2.4, [-29.9, 7, 0], [0, Math.PI / 2, 0]);
  panel("#dbe8f5", 5, 52, 2.4, [29.9, 7, 0], [0, Math.PI / 2, 0]);
  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(room, .04).texture;
  generator.dispose();
  room.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  return texture;
}

async function createMuseum({ gallerySources, galleryImageSizes }) {
  // 2. Einfache, gemeinsam verwendete Geometrien halten die Szene klein.
  performance.mark("museum:scene-build-start");
  THREE.ShaderChunk.lights_fragment_begin = shareSpotlightCalculation(THREE.ShaderChunk.lights_fragment_begin);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: renderQuality.antialias });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // All geometry and lights are static between layout changes. Walking changes
  // only the view, so reuse the depth map instead of redrawing 4096² per frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e9e2d5");
  scene.environment = createGalleryEnvironment(renderer);
  scene.environmentIntensity = .4;
  const camera = new THREE.PerspectiveCamera(44, 1, 0.2, 500);
  const plane = new THREE.PlaneGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const roomHeight = 8;
  const hallBay = HALL_BAY;
  const backZ = -2.1;
  const cameraZ = backZ + roomHeight / (2 * Math.tan(THREE.MathUtils.degToRad(22)) * 0.78);
  const frontZ = cameraZ + 2;
  const depth = frontZ - backZ;
  let width = 0, height = 0, roomWidth = 0, narrow = false;
  // A tighter lens keeps the lobby view on the works instead of floor and ceiling.
  const LOBBY_FOV = 38;
  let japaneseGallery = getMuseumDesign() === "japanese";
  let whiteCube = getMuseumDesign() === "white-cube";
  let seatsOnRugs = !["white-cube", "sci-fi", "japanese"].includes(getMuseumDesign());
  let frame = null, lastTime = 0, bounds = null, walk = null;
  let sceneNeedsRender = false;
  let pointerInside = false, hovered = null, contextLost = false;
  let firstFrameRendered = false, renderPixelRatio = 1;
  const effects = createMuseumEffects({
    document, window, performance, renderer, scene, camera, stage,
    quality: renderQuality,
    isNarrow: () => narrow,
    requestRender
  });
  const targetPosition = new THREE.Vector3();
  const entranceTarget = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const projectPlane = createPlaneProjector(camera);
  const localCamera = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();

  function surface(color, map = null) {
    return new THREE.MeshBasicMaterial({ color, map, side: THREE.DoubleSide });
  }
  const wallSurface = surface("#eae3d6");
  const floorSurface = surface("#d6cebf");
  const ceilingSurface = surface("#faf7ef");
  const trimSurface = surface("#b4a997");
  const darkSurface = surface("#302e29");
  function mesh(group, geometry, material) {
    const object = new THREE.Mesh(geometry, material);
    group.add(object);
    return object;
  }
  function size(object, x, y, z, w, h, d = 1) {
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
  }
  const translatedTextures = new Map();
  function canvasTexture(draw, w = 1024, h = 512, localized = false) {
    const picture = document.createElement("canvas");
    // Auch bei extremen Seitenverhältnissen nie riesige GPU-Texturen anlegen.
    const scale = Math.min(1, 2048 / Math.max(w, h));
    picture.width = Math.max(1, Math.round(w * scale));
    picture.height = Math.max(1, Math.round(h * scale));
    const context = picture.getContext("2d");
    const texture = new THREE.CanvasTexture(picture);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    function repaint() {
      context.save();
      context.scale(scale, scale);
      draw(context, w, h);
      context.restore();
      texture.needsUpdate = true;
    }
    repaint();
    if (localized) translatedTextures.set(texture, repaint);
    return texture;
  }
  const wallTexture = canvasTexture(function (context, w, h) {
    const glow = context.createRadialGradient(w * .46, h * .2, 15, w * .5, h * .45, w * .7);
    glow.addColorStop(0, "#fffef9"); glow.addColorStop(1, "#e4dccf");
    context.fillStyle = glow; context.fillRect(0, 0, w, h);
  }, 512, 512);
  function gradientWall(stops, decorate = null, width = 512) {
    return canvasTexture((context, w, h) => {
      const wash = context.createLinearGradient(0, 0, 0, h);
      for (const [position, color] of stops) wash.addColorStop(position, color);
      context.fillStyle = wash; context.fillRect(0, 0, w, h);
      decorate?.(context, w, h);
    }, width, 512);
  }
  // Raum 1: Perlmutt, gebürstetes Metall und ein sehr zurückhaltender Blauton.
  const researchWall = gradientWall([[0, "#f0f3f1"], [1, "#d5dfe1"]], (context, w, h) => {
    context.fillStyle = "rgba(115, 139, 153, .22)";
    [.055, .59, .94].forEach(x => context.fillRect(w * x, 0, 1, h));
    context.fillRect(0, h * .84, w, 1);
    // Kleine Passmarken statt eines dichten Rasters auf der Ausstellungswand.
    context.strokeStyle = "rgba(92, 122, 139, .3)"; context.lineWidth = 1;
    [.055, .59, .94].forEach(function (x) {
      context.beginPath(); context.moveTo(w * x - 5, h * .84);
      context.lineTo(w * x + 5, h * .84); context.stroke();
    });
  }, 1024);
  const defaultFinish = { wall: wallSurface, floor: floorSurface, ceiling: ceilingSurface,
    trim: trimSurface, metal: darkSurface };
  function finish(wall, floor, ceiling, trim, metal) {
    return { wall: surface(wall), floor: floor ? surface(floor) : floorSurface,
      ceiling: surface(ceiling), trim: surface(trim), metal: surface(metal) };
  }
  // Wand, Boden, Decke, Leisten und Metall je Raum; null teilt den Standardboden.
  const roomFinishes = {
    research: finish("#e4e8e9", "#c6ced2", "#f8f7f2", "#a3afb6", "#586970"),
    arena: finish("#eee4d2", "#cbb99b", "#faf5e9", "#b49a74", "#464338"),
    workshop: finish("#e5e7e4", "#c5cccd", "#f8f6ef", "#9eacb4", "#405464"),
    cabinet: finish("#ebe4d8", "#ffffff", "#faf7ef", "#81715f", "#514239"),
    studio: finish("#e7edeb", "#cdd7d3", "#f7f9f4", "#9daead", "#254c57"),
    atelier: finish("#eeebe4", "#ffffff", "#faf9f3", "#afa99d", "#56616b"),
    print: finish("#eeece5", "#d9d9d3", "#fafaf5", "#a5a6a0", "#28292a"),
    photo: finish("#dedfd9", null, "#f8f9f5", "#afb3ac", "#424540")
  };
  // Raum 2: eine kleine Spielarena in Sand, Bronze und warmem Graphit.
  const arenaWall = gradientWall([[0, "#f6efdf"], [1, "#e4d8c2"]], (context, w, h) => {
    context.fillStyle = "#e1ceb0"; context.fillRect(0, h * .83, w, h * .17);
    context.fillStyle = "rgba(150, 112, 58, .2)"; context.fillRect(0, h * .83, w, 1);
  });
  const corkTexture = canvasTexture(function (context, w, h) {
    context.fillStyle = "#cbb99b"; context.fillRect(0, 0, w, h);
    // Feine, feste Körnung. Der Boden bleibt matt und braucht keine Echtzeit-Effekte.
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const grain = (x * 13 + y * 7) % 23;
        context.fillStyle = grain < 11 ? "rgba(86, 65, 35, .065)" : "rgba(255, 247, 219, .12)";
        context.fillRect(x + grain % 3, y, 2, 2);
      }
    }
  }, 256, 256);
  corkTexture.wrapS = corkTexture.wrapT = THREE.RepeatWrapping;
  roomFinishes.arena.floor.map = corkTexture;
  const pitchTexture = canvasTexture(function (context, w, h) {
    context.fillStyle = "#596368"; context.fillRect(0, 0, w, h);
    context.fillStyle = "rgba(241, 226, 192, .035)";
    for (let x = 0; x < w; x += w / 8) context.fillRect(x, 0, w / 16, h);
    context.fillStyle = "#b99a60"; context.fillRect(12, 12, 8, h - 24);
    context.fillStyle = "#ad795f"; context.fillRect(w - 20, 12, 8, h - 24);
    context.strokeStyle = "#e4d8bc"; context.lineWidth = 5;
    const pad = 40;
    context.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    context.beginPath(); context.moveTo(w / 2, pad); context.lineTo(w / 2, h - pad); context.stroke();
    // Ausgleich für das breite Teppichformat, damit der Mittelkreis im Raum rund ist.
    context.beginPath();
    context.ellipse(w / 2, h / 2, w * .07, h * .21, 0, 0, Math.PI * 2); context.stroke();
    context.strokeRect(pad, h * .25, w * .13, h * .5);
    context.strokeRect(w - pad - w * .13, h * .25, w * .13, h * .5);
    context.fillStyle = "#e4d8bc";
    context.beginPath(); context.arc(w / 2, h / 2, 5, 0, Math.PI * 2); context.fill();
  }, 1024, 512);
  const pitchSurface = surface("#ffffff", pitchTexture);
  // Raum 3: Pixelwerkstatt mit mineralischen Flächen und einem leisen Amethyst-Akzent.
  const workshopWall = gradientWall([[0, "#f0f1ed"], [1, "#d9e0df"]]);
  // Raum 4: ein Sammlungskabinett mit Papier, Nussbaum und erdigen Tönen.
  const cabinetWall = gradientWall([[0, "#f5efdf"], [1, "#e0d6c7"]]);
  const cabinetFloor = canvasTexture(function (context, w, h) {
    const shades = ["#b8a18a", "#b09a83", "#bda78e", "#b39c84"];
    for (let row = 0; row < 8; row++) {
      for (let column = -1; column < 4; column++) {
        const x = column * w / 3 + (row % 2) * w / 6, y = row * h / 8;
        context.fillStyle = shades[(row * 3 + column + 4) % shades.length];
        context.fillRect(x, y, w / 3, h / 8);
        context.strokeStyle = "rgba(76, 54, 35, .15)";
        context.strokeRect(x, y, w / 3, h / 8);
        context.strokeStyle = "rgba(247, 231, 206, .12)";
        for (let n = 1; n < 5; n++) {
          context.beginPath(); context.moveTo(x + 3, y + n * h / 40);
          context.lineTo(x + w / 3 - 3, y + n * h / 40 + 1); context.stroke();
        }
      }
    }
  }, 512, 512);
  cabinetFloor.wrapS = cabinetFloor.wrapT = THREE.RepeatWrapping;
  roomFinishes.cabinet.floor.map = cabinetFloor;
  // Raum 5: Die Originalfarben der Esuap-Oberfläche verbinden Identität und Raum.
  const studioWall = gradientWall([[0, "#f0f5ef"], [1, "#dae3e0"]]);
  // Raum 6: ein helles Atelier für drei unterschiedliche digitale Beiträge.
  const atelierWall = gradientWall([[0, "#f4f2eb"], [1, "#e1ded5"]], (context, w, h) => {
    context.fillStyle = "#ded9ce"; context.fillRect(0, h * .86, w, h * .14);
  });
  const atelierFloor = canvasTexture(function (context, w, h) {
    context.fillStyle = "#d6d3c9"; context.fillRect(0, 0, w, h);
    const chips = ["#c3c5c0", "#b8c0c3", "#e5e0d5", "#cbb8a9"];
    // Feste kleine Einschlüsse statt einer teuren Oberflächenberechnung.
    for (let n = 0; n < 150; n++) {
      const x = (n * 71 + 13) % w, y = (n * 43 + Math.floor(n / 7) * 19) % h;
      context.fillStyle = chips[n % chips.length];
      context.fillRect(x, y, 1 + n % 3, 1 + n % 2);
    }
  }, 256, 256);
  atelierFloor.wrapS = atelierFloor.wrapT = THREE.RepeatWrapping;
  roomFinishes.atelier.floor.map = atelierFloor;
  // Raum 7: Das Raster und die tatsächlichen Studien tragen die Gestaltung.
  const printWall = gradientWall([[0, "#f3f3ed"], [1, "#e1e2db"]]);
  // Raum 8: ein warmer, ruhiger Fotosalon mit neutralem Licht und natürlichen Materialien.
  const photoWall = gradientWall([[0, "#e9eae7"], [.28, "#daddd7"], [1, "#cacdc7"]]);
  const roomWalls = { research: researchWall, arena: arenaWall, workshop: workshopWall, cabinet: cabinetWall, studio: studioWall, atelier: atelierWall, print: printWall, photo: photoWall };
  // Gemeinsame, einfache Leuchten statt vieler dynamischer Lichtquellen.
  const lampBody = new THREE.CylinderGeometry(.12, .14, .34, 12);
  lampBody.rotateX(Math.PI / 2);
  const lampLens = new THREE.CircleGeometry(.105, 16);
  const lampSurface = surface("#fffaef");
  const lampDirection = new THREE.Vector3();

  // Rahmenseiten sind direkt eingefärbt: gemeinsame Geometrie mit echter Lichtreaktion.
  function frameVariant(colors) {
    const geometry = box.clone();
    const vertices = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      new THREE.Color(colors[Math.floor(i / 4)]).toArray(vertices, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(vertices, 3));
    return geometry;
  }
  const frameBox = frameVariant(["#34322e", "#625e55", "#858075", "#22211e", "#45423c", "#252420"]);
  const metalFrameBox = frameVariant(["#454947", "#555b58", "#777d78", "#303431", "#4b514c", "#3c413d"]);
  const woodFrameBox = frameVariant(["#514237", "#655345", "#8b7561", "#382e27", "#5b493d", "#483a30"]);
  const frameSurface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .25 });
  const woodFrameSurface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .74, metalness: 0 });
  const matSurface = new THREE.MeshStandardMaterial({ color: "#f5f0e6", roughness: .96 });
  const revealSurface = new THREE.MeshStandardMaterial({ color: "#a49b8b", roughness: .88 });
  // Thema und Rahmen zusammen halten, damit die Auswahl beim Raumbau lesbar bleibt.
  const metalFrame = { geometry: metalFrameBox, mat: matSurface, reveal: revealSurface };
  const defaultFrame = { geometry: frameBox, mat: matSurface, reveal: revealSurface };
  const woodenFrame = { geometry: woodFrameBox, material: woodFrameSurface, mat: matSurface, reveal: revealSurface };
  const roomFrames = {
    research: metalFrame,
    workshop: metalFrame,
    cabinet: woodenFrame,
    studio: metalFrame,
    atelier: metalFrame,
    print: defaultFrame,
    photo: defaultFrame,
    process: woodenFrame
  };

  // Eine schmale Fase an der Vorderkante, als gemeinsame Geometrie je Rahmentyp.
  // Horizontale und vertikale Leisten behalten ihre vorhandenen Außenmaße.
  function bevelledRail(geometry, vertical) {
    const rail = geometry.clone();
    const vertices = rail.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      if (vertices.getZ(i) <= 0) continue;
      if (vertical) vertices.setX(i, vertices.getX(i) * .7);
      else vertices.setY(i, vertices.getY(i) * .7);
    }
    vertices.needsUpdate = true;
    rail.computeVertexNormals();
    return rail;
  }
  for (const framing of [defaultFrame, metalFrame, woodenFrame]) {
    framing.rails = [bevelledRail(framing.geometry, false), bevelledRail(framing.geometry, true)];
  }

  // Alle Werke teilen sich diese kleinen Texturen. Im Stillstand wird nichts animiert.
  const shadowTexture = canvasTexture(function (context, w, h) {
    context.shadowColor = "rgba(35, 28, 20, .3)";
    context.shadowBlur = 24;
    context.fillStyle = "rgba(35, 28, 20, .08)";
    context.fillRect(48, 48, w - 96, h - 96);
    // Enger Kontaktschatten direkt am Rahmen, weicher Auslauf weiter außen.
    context.shadowColor = "rgba(35, 28, 20, .58)";
    context.shadowBlur = 6;
    context.fillStyle = "rgba(35, 28, 20, .08)";
    context.fillRect(48, 48, w - 96, h - 96);
  }, 256, 256);
  const shadowSurface = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: .5, depthWrite: false });
  // Zwei gemeinsame Lichtfarben. Die Texturen entstehen einmal beim Start;
  // sie liegen hinter den Rahmen und verändern keine Farben der Originalbilder.
  function wallLighting(rgb) {
    const light = canvasTexture(function (context, w, h) {
      const glow = context.createRadialGradient(w / 2, h * .46, 0, w / 2, h * .46, w * .49);
      glow.addColorStop(0, "rgba(" + rgb + ", .62)");
      glow.addColorStop(.38, "rgba(" + rgb + ", .38)");
      glow.addColorStop(.72, "rgba(" + rgb + ", .1)");
      glow.addColorStop(1, "rgba(" + rgb + ", 0)");
      context.fillStyle = glow; context.fillRect(0, 0, w, h);
    }, 256, 256);
    const beam = canvasTexture(function (context, w, h) {
      // Ein sanfter Wandkegel verbindet die Leuchte mit der oberen Bildhälfte.
      const wash = context.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, "rgba(" + rgb + ", .08)");
      wash.addColorStop(.4, "rgba(" + rgb + ", .26)");
      wash.addColorStop(.75, "rgba(" + rgb + ", .12)");
      wash.addColorStop(1, "rgba(" + rgb + ", 0)");
      context.filter = "blur(16px)";
      context.fillStyle = wash;
      context.beginPath(); context.moveTo(w * .46, 0); context.lineTo(w * .54, 0);
      context.lineTo(w * .9, h * .8); context.quadraticCurveTo(w * .5, h * 1.06, w * .1, h * .8);
      context.closePath(); context.fill();
    }, 256, 512);
    return {
      light: new THREE.MeshBasicMaterial({ map: light, transparent: true, opacity: .8, depthWrite: false }),
      beam: new THREE.MeshBasicMaterial({ map: beam, transparent: true, opacity: .65, depthWrite: false })
    };
  }
  const neutralLighting = wallLighting("253, 254, 252");
  const warmLighting = wallLighting("255, 250, 239");
  const neutralLens = surface("#fcfdfb");
  const glassTexture = canvasTexture(function (context, w, h) {
    // Zwei weiche Spiegelungen einer hellen Deckenfläche, mit schmalen Lichtkanten.
    const reflection = context.createLinearGradient(0, 0, w, h);
    reflection.addColorStop(0, "rgba(240, 248, 255, .15)");
    reflection.addColorStop(.32, "rgba(240, 248, 255, .02)");
    reflection.addColorStop(.55, "rgba(255, 255, 255, 0)");
    reflection.addColorStop(.63, "rgba(255, 255, 255, .04)");
    reflection.addColorStop(.645, "rgba(255, 255, 255, .38)");
    reflection.addColorStop(.665, "rgba(255, 255, 255, .38)");
    reflection.addColorStop(.68, "rgba(255, 255, 255, .035)");
    reflection.addColorStop(.79, "rgba(255, 255, 255, .035)");
    reflection.addColorStop(.805, "rgba(255, 255, 255, .19)");
    reflection.addColorStop(.82, "rgba(255, 255, 255, .19)");
    reflection.addColorStop(.835, "rgba(255, 255, 255, 0)");
    reflection.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = reflection; context.fillRect(0, 0, w, h);
  }, 256, 256);
  // The shadow decal is almost coplanar with the print. A depth bias keeps it
  // stable even across the hall, where their physical gap loses depth precision.
  const pictureShadowSurface = new THREE.ShadowMaterial({ color: "#000000", opacity: .28,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const glassSurface = new THREE.MeshBasicMaterial({ map: glassTexture, transparent: true, opacity: .18, depthWrite: false });

  // Kleine, wiederholbare Materialtexturen statt zusätzlicher Bilddateien.
  const woodTexture = canvasTexture(function (context, w, h) {
    const plank = w / 5;
    ["#d0c3ad", "#d5c8b3", "#c9baa2", "#d2c4ae", "#ccbea6"].forEach(function (color, index) {
      context.fillStyle = color; context.fillRect(index * plank, 0, plank, h);
      context.fillStyle = "rgba(74, 51, 31, .10)";
      context.fillRect(index * plank, 0, 1.5, h);
      const joint = index % 2 ? h * .7 : h * .27;
      context.fillRect(index * plank, joint, plank, 1.5);
      // Lange, schwache Maserung; regelmäßig erzeugt und ohne neue Zufallswerte pro Bild.
      context.strokeStyle = "rgba(79, 53, 28, .05)";
      for (let line = 1; line < 12; line++) {
        const x = index * plank + line * plank / 12;
        context.beginPath(); context.moveTo(x, 0);
        context.bezierCurveTo(x + 5, h * .3, x - 5, h * .7, x + 2, h);
        context.stroke();
      }
    });
  }, 512, 512);
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  const woodSurface = surface("#ffffff", woodTexture);
  const rugTexture = canvasTexture(function (context, w, h) {
    context.fillStyle = "#996b60"; context.fillRect(0, 0, w, h);
    context.strokeStyle = "#d2b8a0"; context.lineWidth = 7;
    context.strokeRect(24, 24, w - 48, h - 48);
    context.strokeStyle = "#79544c"; context.lineWidth = 2;
    context.strokeRect(36, 36, w - 72, h - 72);
    context.fillStyle = "rgba(255, 241, 217, .09)";
    for (let n = 0; n < w; n += 4) context.fillRect(n, 0, 1, h);
    context.fillStyle = "rgba(48, 31, 26, .07)";
    for (let n = 0; n < h; n += 4) context.fillRect(0, n, w, 1);
  }, 512, 512);
  const rugSurface = surface("#ffffff", rugTexture);
  const floorShadowTexture = canvasTexture(function (context, w, h) {
    const shadow = context.createRadialGradient(w / 2, h / 2, w * .08, w / 2, h / 2, w * .5);
    shadow.addColorStop(0, "rgba(37, 28, 20, .4)");
    shadow.addColorStop(.55, "rgba(37, 28, 20, .21)");
    shadow.addColorStop(1, "rgba(37, 28, 20, 0)");
    context.fillStyle = shadow; context.fillRect(0, 0, w, h);
  }, 256, 256);
  const floorShadowSurface = new THREE.MeshBasicMaterial({ map: floorShadowTexture, transparent: true, depthWrite: false });

  const furnitureContactSurface = floorShadowSurface.clone(); furnitureContactSurface.opacity = .45;
  function floorShadow(group) {
    const shadow = mesh(group, plane, floorShadowSurface);
    shadow.rotation.x = -Math.PI / 2;
    return shadow;
  }
  function mountFor(room, work) {
    // Shared slender timber profile; photographs keep a more generous mat.
    return { mat: room.theme === "photo" ? .24 : .16, rail: .045, depth: .18 };
  }

  // Texturen werden erst im Blickfeld geladen; Bildmaße stehen bereits im HTML.
  // Originalpfade bleiben die gemeinsamen Schlüssel aller Verbraucher.
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  const pixelSources = new Set(rooms.flatMap(room => room.works.filter(work => work.pixelated).map(work => work.src)));

  function updateWorkImage(work) {
    if (work.imageReady || !textures.has(work.src)) return;
    let pictureTexture = textures.get(work.src);
    if (work.paperBackground || (work.pixelated && /assets\/(?:pioneer|escape)\//.test(work.src))) {
      const original = pictureTexture.image;
      pictureTexture = canvasTexture(function (context, w, h) {
        context.fillStyle = work.paperBackground ? "#fff" : "#e8e0d1";
        context.fillRect(0, 0, w, h);
        if (work.pixelated) context.imageSmoothingEnabled = false;
        context.drawImage(original, 0, 0, w, h);
      }, original.width, original.height);
      if (work.pixelated) pictureTexture.magFilter = THREE.NearestFilter;
    }
    work.picture.material.map = pictureTexture;
    work.picture.material.needsUpdate = true;
    work.imageReady = true;
  }

  function updateWorkPoster(work, w, h) {
    if (!work.sprites.every(src => textures.has(src))) return;
    if (work.poster) {
      translatedTextures.delete(work.poster);
      work.poster.dispose();
    }
    work.poster = posterFor(work, w, h);
    work.picture.material.map = work.poster;
    work.picture.material.needsUpdate = true;
  }

  function makeSide(group, direction, finish) {
    const wall = mesh(group, plane, finish.wall);
    wall.rotation.y = -direction * Math.PI / 2;
    return { wall, trim: mesh(group, box, finish.trim), direction };
  }

  const posterFor = createPosterRenderer({ textures, canvasTexture, t });
  const buildDaylight = createDaylightArchitecture(renderer);
  const museum = rooms.map(function (room) {
    const group = new THREE.Group(); scene.add(group);
    const research = room.theme === "research";
    const arena = room.theme === "arena";
    const workshop = room.theme === "workshop";
    const finish = roomFinishes[room.theme] || defaultFinish;
    const framing = woodenFrame;
    const lighting = ["arena", "cabinet", "atelier"].includes(room.theme) ? warmLighting : neutralLighting;
    // Kleine Materialunterschiede geben Themenräumen Charakter, ohne weitere Effekte.
    const roomBack = roomWalls[room.theme] ? surface("#ffffff", roomWalls[room.theme]) : room.display === "photography" ? surface("#e5e0d6") : room.display === "asset-wall" ? surface("#d9dfd8") : surface("#e9e3d8", wallTexture);
    const back = mesh(group, plane, roomBack);
    const floor = mesh(group, plane, room.display === "photography" ? woodSurface : finish.floor); floor.rotation.x = -Math.PI / 2;
    const ceiling = mesh(group, plane, finish.ceiling); ceiling.rotation.x = Math.PI / 2;
    const backTrim = mesh(group, box, finish.trim);
    const left = makeSide(group, -1, finish);
    const right = makeSide(group, 1, finish);
    const lights = [mesh(group, plane, surface("#fffefa")), mesh(group, plane, surface("#fffefa"))];
    lights.forEach(light => { light.rotation.x = Math.PI / 2; });
    const joints = new THREE.Float32BufferAttribute(new Float32Array(13 * 6), 3);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", joints), new THREE.LineBasicMaterial({ color: research || workshop ? "#aebcc4" : "#c4b9a8" }));
    group.add(lines);
    const rug = arena ? mesh(group, plane, pitchSurface) : room.display === "asset-wall" ? mesh(group, plane, rugSurface) : null;
    const rugShadow = rug ? floorShadow(group) : null;
    if (rug) rug.rotation.x = -Math.PI / 2;


    const works = room.works.map(function (work) {
      const frameGeometry = framing.geometry;
      const frameMaterial = framing.material || frameSurface;
      const frameMesh = mesh(group, frameGeometry, frameMaterial);
      frameMesh.userData.project = work.project;
      frameMesh.userData.label = work.companion ? room.works.find(item => item.project === work.project && !item.companion).label : work.label;
      const picture = mesh(group, plane, surface("#ffffff"));
      picture.material.toneMapped = false;
      // Receive real shadows while keeping the original image colours outside shade.
      const pictureShade = mesh(picture, plane, pictureShadowSurface);
      pictureShade.position.z = .001; pictureShade.receiveShadow = true; pictureShade.renderOrder = 4;
      const rails = Array.from({ length: 4 }, (_, index) => mesh(group, framing.rails[index < 2 ? 0 : 1], frameMaterial));
      const mat = mesh(group, plane, framing.mat);
      const reveal = mesh(group, plane, framing.reveal);
      const shadow = mesh(group, plane, shadowSurface);
      const light = mesh(group, plane, lighting.light);
      const beam = mesh(group, plane, lighting.beam);
      const glazing = glassSurface.clone();
      if (room.theme === "photo") glazing.opacity = .10;
      // Gleiches Bildmaterial, aber eigener Ausschnitt für die Blickrichtung jedes Werks.
      glazing.map = glassTexture.clone(); glazing.map.repeat.set(.84, .84);
      const glass = mesh(group, plane, glazing);
      // Wall decals need a bias; glass has its own physical clearance. Biasing
      // glass as well can pull its reflections over the frame at grazing angles.
      [shadow, beam, light].forEach((layer, index) => {
        layer.renderOrder = index + 1;
        layer.material.polygonOffset = true;
        layer.material.polygonOffsetFactor = -1;
        layer.material.polygonOffsetUnits = -1;
      });
      glass.renderOrder = 5;
      const lamp = new THREE.Group(); group.add(lamp);
      mesh(lamp, lampBody, finish.metal);
      const lens = mesh(lamp, lampLens, lighting === neutralLighting ? neutralLens : lampSurface); lens.position.z = .175;
      const lampStem = mesh(group, box, finish.metal);
      const visual = new THREE.Group(); group.add(visual);
      visual.add(frameMesh, picture, ...rails, mat, reveal, shadow, light, beam, glass, lamp, lampStem);
      return { ...work, visual, frame: frameMesh, picture, rails, mat, reveal, shadow, light, beam, glass, lamp, lampStem,
        mount: mountFor(room, work), anchor: new THREE.Vector3(), poster: null };
    });
    const item = { group, back, floor, ceiling, backTrim, left, right, lights, joints, lines,
      rug, rugShadow,
      works, display: room.display, theme: room.theme, gameExhibit: room.parent?.id === "games" };
    item.architecture = buildDaylight(item, room);
    item.architecture.setDesign(getMuseumDesign());
    item.fallbackWall = item.back.material;
    return item;
  });

  const hallAtmosphere = createHallAtmosphere(scene, renderer, furnitureContactSurface, renderQuality);
  hallAtmosphere.setDesign(getMuseumDesign());
  let wallTitleBaseline = getMuseumDesign() === "walnut" ? WALNUT_DADO_RAIL_TOP : .18;
  // Large, low-contrast lettering sits across the full exhibit walls.
  const sectionSigns = [
    { en: "Photos", de: "Fotos", target: "photos", side: 2, oneLine: true },
    { en: "Games", de: "Spiele", target: "animalsoccer", side: -1 },
    { en: "Web Design", de: "Web Design", target: "cargonaut", side: 1, oneLine: true },
    { en: "Graphic Design", de: "Grafikdesign", target: "visual-communication", side: 0 }
  ].map(sign => {
    const textureWidth = sign.side === -1 || sign.side === 1 ? 8192 : 4096;
    const map = canvasTexture((context, w, h) => {
      context.clearRect(0, 0, w, h);
      const title = (document.documentElement.lang === "de" ? sign.de : sign.en).toUpperCase();
      const targetWidth = w * .76;
      let lines = sign.oneLine ? [title] : title.split(" ");
      const baseFontSize = h * 1.12;
      context.font = "700 " + baseFontSize + "px Georgia, serif";
      if (!sign.oneLine && context.measureText(title).width > targetWidth) {
        lines = lines.length > 1 ? lines : [
          title.slice(0, Math.ceil(title.length / 2)),
          title.slice(Math.ceil(title.length / 2))
        ];
      }
      let fontSize = h * (lines.length === 1 ? 1.12 : .56);
      const availableHeight = h * (1 - wallTitleBaseline / (sign.side === -1 || sign.side === 1 ? 8.05 : 9.3)) - h * .04;
      context.fillStyle = "#30382e";
      context.textBaseline = "alphabetic";
      context.textAlign = "left";
      function measureLines(size) {
        context.font = "700 " + size + "px Georgia, serif";
        return lines.map(line => {
          const letters = [...line];
          const metrics = letters.map(letter => context.measureText(letter));
          return {
            letters,
            widths: metrics.map(metric => metric.width),
            ascent: Math.max(...metrics.map(metric => metric.actualBoundingBoxAscent || size * .72)),
            descent: Math.max(...metrics.map(metric => metric.actualBoundingBoxDescent || 0))
          };
        });
      }
      let rows = measureLines(fontSize);
      const maxLineWidth = Math.max(...rows.map(row => row.widths.reduce((sum, width) => sum + width, 0)));
      fontSize *= Math.min(1, targetWidth / maxLineWidth);
      rows = measureLines(fontSize);
      const lineGap = h * .02;
      const blockHeight = rows.reduce((sum, row) => sum + row.ascent + row.descent, 0) + lineGap * (rows.length - 1);
      fontSize *= Math.min(1, availableHeight / blockHeight);
      rows = measureLines(fontSize);
      let bottom = h * (1 - wallTitleBaseline / (sign.side === -1 || sign.side === 1 ? 8.05 : 9.3));
      for (let index = rows.length - 1; index >= 0; index--) {
        const row = rows[index];
        const naturalWidth = row.widths.reduce((sum, width) => sum + width, 0);
        const tracking = row.letters.length > 1 ? Math.max(0, (targetWidth - naturalWidth) / (row.letters.length - 1)) : 0;
        let x = (w - naturalWidth - tracking * (row.letters.length - 1)) / 2;
        const baseline = bottom - row.descent;
        row.letters.forEach((letter, letterIndex) => {
          context.fillText(letter, x, baseline);
          x += row.widths[letterIndex] + tracking;
        });
        bottom = baseline - row.ascent - lineGap;
      }
    }, textureWidth, 768, true);
    const label = mesh(scene, plane, new THREE.MeshBasicMaterial({
      map, transparent: true, opacity: .08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
    }));
    label.userData.roomTarget = roomsById.get(sign.target);
    return { ...sign, label, repaint: translatedTextures.get(map) };
  });
  const hallWallFinishes = hallAtmosphere.walls;
  const hallFloor = mesh(scene, box, hallAtmosphere.floor); hallFloor.receiveShadow = true;
  const hallCeiling = mesh(scene, box, hallAtmosphere.ceiling);
  // Physical 18 mm arrises catch light; one shared beam geometry/material.
  const beamSection = new THREE.Shape();
  beamSection.moveTo(-.142, -.1695); beamSection.lineTo(.142, -.1695);
  beamSection.lineTo(.142, .1695); beamSection.lineTo(-.142, .1695); beamSection.closePath();
  const beamGeometry = new THREE.ExtrudeGeometry(beamSection, {
    depth: 1, steps: 1, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 1
  });
  beamGeometry.translate(0, 0, -.5); beamGeometry.rotateY(Math.PI / 2); beamGeometry.scale(1 / 1.036, 1, 1);
  const beamFinish = hallAtmosphere.structure;
  const hallBeams = Array.from({ length: 9 }, () => mesh(scene, beamGeometry, beamFinish));
  // Static diffuse-bounce approximation, applied only to ceiling materials.
  // A light map adds indirect irradiance without extra lights or shadow passes.
  const ceilingIrradiance = canvasTexture((context, width, height) => {
    const bounce = context.createLinearGradient(0, 0, width, 0);
    bounce.addColorStop(0, "#777975"); bounce.addColorStop(.45, "#8d8b84"); bounce.addColorStop(1, "#62615d");
    context.fillStyle = bounce; context.fillRect(0, 0, width, height);
  }, 128, 16);
  ceilingIrradiance.colorSpace = THREE.NoColorSpace; ceilingIrradiance.channel = 0;
  for (const finish of [hallAtmosphere.ceiling, beamFinish]) {
    finish.lightMap = ceilingIrradiance; finish.lightMapIntensity = .9;
  }
  // Shared hall fittings use world coordinates and attach to beam undersides
  // (y=8.925), independent of the scaled exhibition groups below.
  const ceilingFixtures = new THREE.Group(); scene.add(ceilingFixtures);
  const fixtureFinish = new THREE.MeshStandardMaterial({ color: "#454941", roughness: .65, metalness: .3 });
  const fixtureLens = new THREE.MeshStandardMaterial({ color: "#fff4db", emissive: "#fff0ce", emissiveIntensity: 1.8, roughness: .5 });
  // Hood, cooling fins and yoke give the track heads real fixture silhouettes.
  const lampHood = new THREE.CylinderGeometry(.145, .145, .1, 20, 1, true); lampHood.rotateX(Math.PI / 2);
  const lampHoodRim = new THREE.RingGeometry(.125, .145, 20);
  const lampFin = new THREE.CylinderGeometry(.158, .158, .012, 20); lampFin.rotateX(Math.PI / 2);
  function createSpotFixture(castShadow = false) {
    const mount = mesh(ceilingFixtures, box, fixtureFinish);
    const stem = mesh(ceilingFixtures, box, fixtureFinish);
    const yoke = new THREE.Group(); ceilingFixtures.add(yoke);
    mesh(yoke, box, fixtureFinish).scale.set(.36, .03, .05);
    yoke.children[0].position.y = .12;
    for (const side of [-1, 1]) {
      const arm = mesh(yoke, box, fixtureFinish);
      arm.scale.set(.025, .14, .05); arm.position.set(side * .17, .05, 0);
    }
    const head = new THREE.Group(); ceilingFixtures.add(head);
    mesh(head, lampBody, fixtureFinish);
    const lens = mesh(head, lampLens, fixtureLens); lens.position.z = .176;
    mesh(head, lampHood, fixtureFinish).position.z = .22;
    mesh(head, lampHoodRim, fixtureFinish).position.z = .27;
    [-.06, -.1, -.14].forEach(z => { mesh(head, lampFin, fixtureFinish).position.z = z; });
    // These sources are fixed to the actual lenses, not painted on the walls.
    // Three downward fixtures shadow the furnishings; wall washers stay soft.
    const light = new THREE.SpotLight("#fff3e4", 180, 0, .76, 1, 2);
    light.name = "Gallery track spotlight";
    if (castShadow) {
      light.castShadow = true; light.shadow.mapSize.set(renderQuality.spotShadowSize, renderQuality.spotShadowSize); light.shadow.radius = 3;
      light.shadow.camera.near = .1; light.shadow.bias = -.00003; light.shadow.normalBias = .015;
    }
    ceilingFixtures.add(light, light.target);
    return { mount, stem, yoke, head, light };
  }
  const ceilingTracks = Array.from({ length: 5 }, (_, trackIndex) => {
    const rail = mesh(ceilingFixtures, box, fixtureFinish);
    const directions = [-1, 0, 1].filter(side => (side !== -1 || trackIndex < 4) && (side !== 1 || trackIndex % 2 === 0)).map(side => ({side}));
    if (trackIndex === 4) directions.push({side:-1, entrance:true}, {side:1, entrance:true});
    const spots = directions.map(({side, entrance = false}) => {
      const fixture = createSpotFixture(side === 0 && trackIndex > 0 && trackIndex < 4);
      // Wall washers are re-aimed at the actual exhibits by arrangeHall.
      return { side, entrance, wash: side !== 0 || trackIndex === 0, ...fixture };
    });
    return { rail, spots };
  });
  // Washers hang on their own tracks parallel to each wall, about 30° off the artwork axis.
  const spotFixtures = ceilingTracks.flatMap(track => track.spots);
  const washers = spotFixtures.filter(spot => spot.wash);
  const wallRails = { left: mesh(ceilingFixtures, box, fixtureFinish), right: mesh(ceilingFixtures, box, fixtureFinish),
    rear: mesh(ceilingFixtures, box, fixtureFinish), front: mesh(ceilingFixtures, box, fixtureFinish) };
  const benchTopGeometries = [
    roundedBoxGeometry(4.6, .08, .76, .07, .012),
    roundedBoxGeometry(6.2, .08, 1.05, .08, .012)
  ];
  const benchSupportGeometry = roundedBoxGeometry(.10, .40, .42, .035, .01);
  const benchCushionGeometry = roundedBoxGeometry(4.52, .07, .68, .05, .01);
  const hallSeats = Array.from({ length: 1 }, () => ({
    contact: mesh(scene, plane, furnitureContactSurface),
    top: mesh(scene, benchTopGeometries[0], hallAtmosphere.wood),
    feet: [mesh(scene, benchSupportGeometry, hallAtmosphere.metal), mesh(scene, benchSupportGeometry, hallAtmosphere.metal)]
  }));
  hallSeats.forEach(seat => {
    seat.cushion = mesh(seat.top, benchCushionGeometry, hallAtmosphere.textiles[0]);
    seat.cushion.name = "Sage gallery bench cushion";
    seat.cushion.position.y = .075;
    seat.cushion.castShadow = seat.cushion.receiveShadow = true;
    seat.cushion.visible = japaneseGallery;
  });
  const columnFinish = hallAtmosphere.column;
  const columnShaftGeometry = new THREE.CylinderGeometry(.68, .68, 8, 48);
  const columnBaseGeometry = new THREE.CylinderGeometry(.76, .76, .12, 48);
  const hallColumns = Array.from({ length: 4 }, (_, index) => {
    const group = new THREE.Group(); scene.add(group);
    group.name = "Structural gallery column " + (index + 1);
    const shaft = mesh(group, columnShaftGeometry, columnFinish);
    shaft.position.y = 4.65; shaft.scale.y = 9.3 / 8; shaft.castShadow = shaft.receiveShadow = true;
    const base = mesh(group, columnBaseGeometry, columnFinish);
    base.position.y = .06;
    const contact = floorShadow(group);
    size(contact, 0, .03, 0, 2.7, 2.7);
    return { group, shaft, base };
  });
  const columnLight = new THREE.DirectionalLight("#fff7e9", .08);
  columnLight.position.set(-8, 10, 7); hallColumns[0].group.add(columnLight, columnLight.target);
  const hallDisplays = createHallDisplays({ scene, stage, textures, materials: hallAtmosphere, canvasTexture, t, contactMaterial: furnitureContactSurface,
    rugThickness: HALL_RUG_THICKNESS,
    openStudy: button => openWork("museum-creation", button) });
  const sourceConsumers = new Map();
  museum.forEach(item => item.works.forEach(work => {
    for (const src of work.src ? [work.src] : work.sprites) {
      if (!sourceConsumers.has(src)) sourceConsumers.set(src, new Set());
      sourceConsumers.get(src).add(work);
    }
  }));
  const textureQueue = createTextureQueue({
    async load(src) {
      const preview = gallerySources.get(src) || src;
      let texture;
      try { texture = await loader.loadAsync(preview); }
      catch (error) {
        if (preview === src) throw error;
        texture = await loader.loadAsync(src);
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      if (pixelSources.has(src) || src.endsWith("-up.png") || src.includes("down.png") || src.includes("heal.png")) texture.magFilter = THREE.NearestFilter;
      return texture;
    },
    onLoad(src, texture) {
      textures.set(src, texture);
      sourceConsumers.get(src)?.forEach(work => {
        if (work.src) updateWorkImage(work);
        else if (!work.poster) updateWorkPoster(work, work.picture.scale.x, work.picture.scale.y);
      });
      hallDisplays.refreshImages();
      requestRender();
    },
    onError(src, error) { console.warn("Museum image could not be loaded:", src, error); }
  });
  const mediaViewport = createMediaViewport(camera);
  function updateVisibleTextures() {
    mediaViewport.update();
    const wanted = [];
    const addWork = work => {
      if (!isWorldVisible(work.picture)) return;
      // Update only the tested plane and its parents; rendering updates the full scene once.
      work.picture.updateWorldMatrix(true, false);
      if (mediaViewport.visible(work.picture)) wanted.push(...(work.src ? [work.src] : work.sprites));
    };
    museum[currentRoom].works.forEach(addWork);
    hallDisplays.entries.forEach(entry => {
      if (!isWorldVisible(entry.hit)) return;
      entry.hit.updateWorldMatrix(true, false);
      if (mediaViewport.visible(entry.hit)) wanted.push(...entry.sources);
    });
    museum.forEach((item, index) => { if (index !== currentRoom) item.works.forEach(addWork); });
    textureQueue.setWanted(wanted);
  }
  window.addEventListener("online", () => { textureQueue.retry(); requestRender(); });
  hallSeats[0].top.name = "Photography viewing bench";
  const hallSeatObstacles = hallSeats.map(seat => ({
    center: seat.top.position, radius: 2.45
  }));
  const hallObstacles = [...hallAtmosphere.obstacles, ...hallAtmosphere.plantObstacles, ...hallDisplays.obstacles, ...hallSeatObstacles];
  const hallPickables = [...hallColumns.map(column => column.shaft), ...sectionSigns.map(sign => sign.label),
    ...hallDisplays.entries.map(entry => entry.hit), ...hallDisplays.occluders,
    ...hallAtmosphere.occluders, ...museum.flatMap(item => item.works.map(work => work.frame))];
  const nativeHitOccluded = createOcclusionTester(camera, [...hallColumns.flatMap(column => [column.shaft, column.base]),
    ...hallDisplays.occluders, ...hallAtmosphere.occluders]);
  const mousePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const columnPositions = hallColumns.map(({ group }) => group.position);
  const freeWalk = createWalkControls(camera, {
    speed: () => THREE.MathUtils.clamp(roomWidth * .25, 4, 10),
    blocked: (x, z) => isWalkBlocked(x, z, roomWidth, columnPositions, hallObstacles)
  });
  watchGamepads({
    window, document,
    canControl: () => !narrow && !contextLost && !modalOpen()
      && !document.querySelector('.museum-menu[open]')
      && !document.activeElement?.closest('input, textarea, select, video, audio, [contenteditable], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"]'),
    onInput(side, forward, turn, pitch) {
      if (side || forward || turn || pitch) {
        if (travelling) finishWalk();
        freeWalk.enter();
      }
      freeWalk.setGamepad(side, forward, turn, pitch);
      requestRender();
    }
  });
  const touchJoystick = document.getElementById("touch-joystick");
  let joystickPointer = null, lookPointer = null, suppressTouchClick = false, touchClickTimer = null;
  function resetTouchControls() {
    joystickPointer = lookPointer = null;
    touchJoystick.style.setProperty("--stick-x", "0px");
    touchJoystick.style.setProperty("--stick-y", "0px");
    suppressTouchClick = false;
    window.clearTimeout(touchClickTimer);
  }
  const hallLight = new THREE.HemisphereLight("#e5edfa", "#dad4c9", 1.2);
  scene.add(hallLight);
  const hallControls = document.createElement("nav");
  hallControls.className = "hall-controls";
  const stepCaption = document.createElement("p");
  stepCaption.className = "nav-caption"; stepCaption.setAttribute("aria-hidden", "true");
  hallControls.append(stepCaption);
  document.querySelector(".tour-details").prepend(hallControls);
  function moveWithinSection(step) {
    const stops = categoryStops(rooms[currentRoom]);
    const at = stops.findIndex(stop => stop.room.index === currentRoom && stop.photo === photoStop);
    const target = stops[at + step];
    if (at >= 0 && target) goToRoom(target.room, true, target.photo);
  }
  for (const [label, step] of [["←", -1], ["◎", 0], ["→", 1]]) {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = label; button.dataset.tourStep = step;
    button.setAttribute("aria-label", step < 0 ? "Previous exhibit / Vorherige Ausstellung" : step > 0 ? "Next exhibit / Nächste Ausstellung" : "Hall overview / Hallenübersicht");
    button.addEventListener("click", () => {
      if (step === 0) { goToRoom(roomsById.get("lobby")); return; }
      moveWithinSection(step);
    });
    if (step) button.setAttribute("aria-keyshortcuts", step < 0 ? "ArrowLeft" : "ArrowRight");
    hallControls.append(button);
  }
  function viewingItem(index) {
    const firstChild = rooms.find(room => room.parent === rooms[index] && room.works.length);
    return museum[firstChild && rooms[index].id !== "lobby" ? firstChild.index : index];
  }
  function hallTarget(index) {
    if (narrow) return new THREE.Vector3(museum[index].group.position.x, 4, backZ);
    const item = viewingItem(index);
    return item.works.length ? item.group.localToWorld(new THREE.Vector3(0, 4, backZ)) : entranceTarget;
  }
  function guidedFov(index) {
    const base = viewingItem(index).works.length ? 44 : LOBBY_FOV;
    const aspect = Math.max(.1, camera.aspect);
    const horizontalTangent = Math.tan(THREE.MathUtils.degToRad(base / 2));
    return Math.min(88, Math.max(
      base,
      THREE.MathUtils.radToDeg(2 * Math.atan(horizontalTangent / aspect))
    ));
  }
  function arrangeHall() {
    hallFloor.visible = hallCeiling.visible = !narrow;
    hallColumns.forEach(({ group }) => { group.visible = !narrow; });
    hallDisplays.update(roomWidth, !narrow, seatsOnRugs);
    const lobbyFocus = galleryFurnitureLayout(roomWidth).media;
    entranceTarget.set(lobbyFocus.x, 2.3, lobbyFocus.z);
    hallBeams.forEach(part => { part.visible = !narrow; });
    ceilingFixtures.visible = !narrow;
    hallSeats.forEach((seat, index) => {
      const visible = !narrow;
      [seat.top, seat.contact, ...seat.feet].forEach(part => { part.visible = visible; });
      hallSeatObstacles[index].radius = visible ? (whiteCube ? 3.3 : 2.45) : 0;
    });
    stage.classList.toggle("is-common-hall", !narrow);
    document.querySelector('[data-open-overview="room-list-title"]').textContent = document.documentElement.lang === "de" ? "Rundgang" : "Tour";
    hallAtmosphere.update(roomWidth, !narrow);
    sectionSigns.forEach(sign => { sign.label.visible = !narrow; });
    if (narrow) return;
    const bay = roomWidth, half = bay * 1.2;
    const hallRear = -bay * 2 - 1.68, hallFront = bay * 2.1;
    const furnitureLayout = galleryFurnitureLayout(bay);
    hallColumns.forEach(({ group }, index) => {
      const position = furnitureLayout.columns[index];
      group.position.set(position.x, 0, position.z);
    });
    sectionSigns.forEach(sign => {
      const layout = hallWallTitleLayout(sign.side, bay, hallRear, hallFront);
      sign.label.position.set(layout.x, layout.y, layout.z);
      sign.label.rotation.y = layout.rotationY;
      sign.label.scale.set(layout.width, layout.height, 1);
    });
    const spacing = bay * .8;
    size(hallFloor, 0, -.12, 0, bay * 2.65, .24, bay * 4.5);
    // Roof terminates on the outside wall faces. The former oversized slab
    // formed a deep eave that reduced the clerestory opening to a light slit.
    size(hallCeiling, 0, 9.45, (hallFront + hallRear) / 2,
      bay * 2.4 + .6, .3, hallFront - hallRear + .6);
    hallCeiling.castShadow = hallCeiling.receiveShadow = true;
    hallBeams.forEach(beam => { beam.castShadow = beam.receiveShadow = true; });
    hallBeams.forEach((beam, i) => size(beam, 0, 9.1125, (i - 4) * spacing / 2, bay * 2.4, 1, 1));
    ceilingTracks.forEach((track, i) => {
      const z = (i - 2) * spacing;
      size(track.rail, 0, 8.89, z, bay * 2.2, .06, .08);
      track.spots.forEach(spot => {
        if (spot.wash) return;
        const x = spot.entrance ? spot.side * half * .5 : spot.side * bay * .9;
        size(spot.mount, x, 8.84, z, .14, .06, .14);
        size(spot.stem, x, 8.71, z, .045, .26, .045);
        spot.head.position.set(x, 8.48, z);
        spot.yoke.position.copy(spot.head.position);
        const target = new THREE.Vector3(x, 0, z);
        spot.head.lookAt(target);
        ceilingFixtures.updateMatrixWorld(true);
        spot.light.position.copy(spot.head.localToWorld(new THREE.Vector3(0, 0, .18)));
        spot.light.target.position.copy(target);
        const throwDistance = spot.light.position.distanceTo(target);
        spot.light.intensity = (japaneseGallery ? .8 : 1) * .65 * throwDistance * throwDistance;
        spot.light.distance = throwDistance * 2.4;
        if (spot.light.castShadow) spot.light.shadow.camera.far = spot.light.distance;
        spot.light.angle = .8;
      });
    });
    hallSeats.forEach(seat => {
      [seat.top, ...seat.feet].forEach(part => { part.castShadow = part.receiveShadow = true; });
      seat.contact.rotation.x = -Math.PI / 2;
      const rugHeight = seatsOnRugs ? HALL_RUG_THICKNESS : 0;
      const z = hallRear + (whiteCube ? 4 : 6.4);
      const benchWidth = whiteCube ? 6.2 : 4.6;
      const benchDepth = whiteCube ? 1.05 : .76;
      seat.top.geometry = benchTopGeometries[whiteCube ? 1 : 0];
      seat.top.position.set(0, (japaneseGallery ? .37 : .43) + rugHeight, z);
      seat.cushion.visible = japaneseGallery;
      seat.contact.position.set(0, rugHeight + .006, z);
      seat.contact.scale.set(benchWidth * 1.18, benchDepth * 1.8, 1);
      seat.feet.forEach((foot, j) => {
        foot.position.set(
          (j ? 1 : -1) * (whiteCube ? 2.45 : 1.7),
          (japaneseGallery ? .165 : .20) + rugHeight,
          z
        );
        foot.scale.y = japaneseGallery ? .825 : 1;
        foot.material = japaneseGallery ? hallAtmosphere.wood : hallAtmosphere.metal;
        foot.rotation.y = 0;
      });
    });
    // Use both side walls, leaving quiet corners and equal space between projects.
    // Include headings and captions so long titles cannot invade the next group.
    const wallStart = hallRear + 8, wallEnd = hallFront - 8;
    const gameItems = museum.filter((item, index) => rooms[index].parent?.id === "games" && item.works.length);
    const designItems = museum.filter((item, index) => rooms[index].parent?.id === "web-design" && item.works.length);
    const graphicItems = museum.filter((item, index) => rooms[index].parent?.id === "graphic-design" && item.works.length);
    const exhibitScale = fitHallExhibitScale({ games: gameItems, design: designItems, graphics: graphicItems,
      wallStart, wallEnd, halfWidth: half });
    const gamePositions = distributeWallGroups(gameItems, -wallEnd, -wallStart, exhibitScale);
    const designPositions = distributeWallGroups(designItems, wallStart, wallEnd, exhibitScale);
    const graphicPositions = distributeEntranceGroups(graphicItems, half, exhibitScale, 2.5);
    museum.forEach((item, index) => {
      item.floor.visible = item.ceiling.visible = item.left.wall.visible = item.right.wall.visible = false;
      item.lights.forEach(light => { light.visible = false; });
      item.works.forEach(work => { work.lamp.visible = work.lampStem.visible = false; });
      item.left.trim.visible = item.right.trim.visible = item.lines.visible = false;
      const oldX = item.group.position.x;
      if (!item.works.length) { item.group.visible = false; return; }
      item.group.scale.setScalar(exhibitScale);
      item.group.position.y = .8;
      if (item.rug) item.rug.visible = false;
      if (item.rugShadow) item.rugShadow.visible = false;
      // Extend the plaster backing to the floor while keeping the artwork at eye level.
      item.back.scale.y = 10;
      const category = categoryFor(rooms[index]);
      if (category === "photos") {
        item.group.position.set(0, .8, -bay * 2);
        item.back.scale.x = bay * 3;
      } else if (category === "graphic-design") {
        item.group.position.set(-graphicPositions.get(item), .8, hallFront + backZ * exhibitScale - .03);
        item.group.rotation.y = Math.PI;
      } else if (category === "games") {
        item.group.position.set(-half + 2.1 * exhibitScale, .8, -gamePositions.get(item));
        item.group.rotation.y = Math.PI / 2;
      } else {
        item.group.position.set(half - 2.1 * exhibitScale, .8, designPositions.get(item));
        item.group.rotation.y = -Math.PI / 2;
      }
      item.back.visible = item.backTrim.visible = false;
      if (rooms[index].id === "photos") item.headingPaint.visible = false;
      item.works.forEach(work => {
        work.light.visible = work.beam.visible = false;
        work.shadow.visible = true;
        work.frame.castShadow = work.frame.receiveShadow = true;
        work.rails.forEach(rail => { rail.castShadow = rail.receiveShadow = true; });
        work.mat.receiveShadow = work.reveal.receiveShadow = true;
      });
      item.back.material = rooms[index].parent?.id === "games" ? hallWallFinishes.games : rooms[index].id === "photos" ? hallWallFinishes.photos : hallWallFinishes.web;
      item.group.updateMatrixWorld(true);
      item.works.forEach(work => {
        work.anchor.x -= oldX;
        item.group.localToWorld(work.anchor);
      });
    });
    hallDisplays.placeExhibits(bay, museum[roomsById.get("ranworld").index].group.position.z);
    aimWashers();
  }

  // One fixture per exhibit group, aimed at the hung works from ~30° off their axis.
  function aimWashers() {
    const OFFSET = 4.2, HEAD_Y = 8.48, MAX_SPAN = 12, MAX_WASHERS = 16;
    const walls = { left: [], right: [], rear: [], front: [] };
    museum.forEach(item => {
      if (!item.works.length || !item.group.visible) return;
      item.group.updateMatrixWorld(true);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(item.group.quaternion);
      const frames = new THREE.Box3();
      item.works.forEach(work => frames.expandByObject(work.frame));
      const center = frames.getCenter(new THREE.Vector3());
      const alongX = Math.abs(normal.z) > .5;
      const key = normal.x > .5 ? "left" : normal.x < -.5 ? "right" : normal.z > .5 ? "rear" : "front";
      walls[key].push({
        normal, alongX, y: center.y, plane: alongX ? center.z : center.x,
        min: alongX ? frames.min.x : frames.min.z, max: alongX ? frames.max.x : frames.max.z,
        halfHeight: (frames.max.y - frames.min.y) / 2
      });
    });
    // Merge neighbours and widen each fixture's share until the hall stays within the light budget.
    const buildDemands = limit => {
      const result = [];
      for (const [key, segments] of Object.entries(walls)) {
        const clusters = [];
        for (const segment of [...segments].sort((a, b) => a.min - b.min)) {
          const last = clusters.at(-1);
          if (last && segment.min - last.max < limit * .45 && segment.max - last.min <= limit) {
            last.max = segment.max; last.halfHeight = Math.max(last.halfHeight, segment.halfHeight);
            last.y = (last.y + segment.y) / 2;
          } else clusters.push({ ...segment });
        }
        for (const cluster of clusters) {
          // The photograph wall is the lobby view, so it always keeps a fixture per ~8 units.
          const pieces = Math.max(1, Math.ceil((cluster.max - cluster.min) / (key === "rear" ? Math.min(limit, 8) : limit)));
          const width = (cluster.max - cluster.min) / pieces;
          for (let piece = 0; piece < pieces; piece++) {
            result.push({ ...cluster, key, t: cluster.min + width * (piece + .5), halfWidth: width / 2 });
          }
        }
      }
      return result;
    };
    let demands = buildDemands(MAX_SPAN);
    for (let limit = MAX_SPAN; demands.length > MAX_WASHERS && limit < 48; ) demands = buildDemands(limit += 3);
    while (washers.length < demands.length) {
      const fixture = createSpotFixture();
      fixture.light.color.copy(spotFixtures[0].light.color);
      fixture.side = 1; fixture.wash = true;
      spotFixtures.push(fixture); washers.push(fixture);
    }
    const railSpans = {};
    washers.forEach((fixture, index) => {
      const demand = demands[index];
      const visible = Boolean(demand);
      [fixture.mount, fixture.stem, fixture.yoke, fixture.head, fixture.light].forEach(part => { part.visible = visible; });

      if (!demand) return;
      const wallPoint = demand.alongX ? new THREE.Vector3(demand.t, 0, demand.plane) : new THREE.Vector3(demand.plane, 0, demand.t);
      const x = wallPoint.x + demand.normal.x * OFFSET, z = wallPoint.z + demand.normal.z * OFFSET;
      const headPosition = new THREE.Vector3(x, HEAD_Y, z);
      // Near a wall the hot spot sits high, so the cone is fitted between frame top and caption bottom.
      const upper = wallPoint.clone().setY(demand.y + demand.halfHeight + .25).sub(headPosition).normalize();
      const lower = wallPoint.clone().setY(demand.y - demand.halfHeight - 1.3).sub(headPosition).normalize();
      const axis = upper.clone().add(lower).normalize();
      const target = headPosition.clone().addScaledVector(axis, OFFSET / -axis.dot(demand.normal));
      size(fixture.mount, x, 8.84, z, .14, .06, .14);
      size(fixture.stem, x, 8.71, z, .045, .26, .045);
      fixture.head.position.copy(headPosition);
      fixture.yoke.position.copy(headPosition);
      fixture.yoke.rotation.y = Math.atan2(target.x - x, target.z - z);
      fixture.head.lookAt(target);
      ceilingFixtures.updateMatrixWorld(true);
      fixture.light.position.copy(fixture.head.localToWorld(new THREE.Vector3(0, 0, .18)));
      fixture.light.target.position.copy(target);
      const throwDistance = fixture.light.position.distanceTo(target);
      // Deterministic ±3% spread: identical fixtures never match perfectly.
      const spread = 1 + ((index * 5) % 7 - 3) * .01;
      // Gentler distance falloff keeps the pool from peaking at the top of the cone.
      fixture.light.decay = 1.2;
      fixture.light.intensity = (japaneseGallery ? .8 : 1) * 2 * spread * throwDistance ** 1.2;
      fixture.light.distance = throwDistance * 2.4;
      const vertical = upper.angleTo(lower) / 2;
      const coverage = Math.min(Math.max(vertical * 1.05, Math.atan(demand.halfWidth * .75 / throwDistance)), vertical * 1.7);
      fixture.light.angle = THREE.MathUtils.clamp(coverage, .2, .5);
      fixture.light.penumbra = .4;
      const along = demand.alongX ? x : z;
      const span = railSpans[demand.key] ||= { min: along, max: along, fixed: demand.alongX ? z : x };
      span.min = Math.min(span.min, along); span.max = Math.max(span.max, along);
    });
    for (const [key, rail] of Object.entries(wallRails)) {
      const span = railSpans[key];
      rail.visible = Boolean(span);
      if (!span) continue;
      const length = span.max - span.min + 1.2, middle = (span.min + span.max) / 2;
      if (key === "rear" || key === "front") size(rail, middle, 8.89, span.fixed, length, .06, .08);
      else size(rail, span.fixed, 8.89, middle, .08, .06, length);
    }
  }

  function applyMuseumDesign(design, relayout = true) {
    const walnut = design === "walnut";
    const sciFi = design === "sci-fi";
    japaneseGallery = design === "japanese";
    whiteCube = design === "white-cube";
    wallTitleBaseline = design === "walnut" ? WALNUT_DADO_RAIL_TOP : .18;
    sectionSigns.forEach(sign => sign.repaint());
    seatsOnRugs = !whiteCube && !sciFi && !japaneseGallery;
    scene.background.set(japaneseGallery ? "#f1eadb" : whiteCube ? "#fff4e3" : sciFi ? "#cbd5dc" : "#e9e2d5");
    hallAtmosphere.setDesign(design);
    hallLight.color.set(japaneseGallery ? "#fff5e5" : "#e5edfa");
    hallLight.groundColor.set(japaneseGallery ? "#e1d5bf" : "#dad4c9");
    hallLight.intensity = japaneseGallery ? 1.45 : .95;
    woodFrameSurface.color.set(japaneseGallery ? "#665e50" : walnut ? "#e8d3b9" : sciFi ? "#e6f0f5" : "#ffffff");
    fixtureFinish.color.set(japaneseGallery ? "#35463d" : whiteCube ? "#111212" : sciFi ? "#96a9b5" : walnut ? "#85724f" : "#454941");
    fixtureFinish.metalness = sciFi ? .58 : walnut ? .55 : .3;
    fixtureFinish.roughness = sciFi ? .36 : .65;
    fixtureLens.color.set(whiteCube ? "#fff1d9" : sciFi ? "#a5f2ff" : "#fff4db");
    fixtureLens.emissive.set(whiteCube ? "#ffc77f" : sciFi ? "#54daf0" : "#fff0ce");
    spotFixtures.forEach(spot => {
      spot.light.color.set(japaneseGallery ? "#ffddb0" : whiteCube ? "#ffd0a1" : sciFi ? "#d9f6ff" : "#fff3e4");
    });
    museum.forEach(item => {
      item.architecture?.setDesign(design);
      if (relayout) item.architecture?.update({ narrow });
    });
    if (relayout) {
      arrangeHall();
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    }
  }

  // Wall lettering is rendered in the same space and light as the architecture.
  // Transparent HTML hit areas retain native buttons, selection names and keyboard focus.
  function wrapText(context, text, width) {
    const rows = []; let row = "";
    for (const word of text.trim().split(/\s+/)) {
      const next = row ? row + " " + word : word;
      if (row && context.measureText(next).width > width) { rows.push(row); row = word; }
      else row = next;
    }
    rows.push(row);
    return rows;
  }

  function paintHeading(item, room, centerX) {
    const photo = item.theme === "photo";
    const density = photo ? 320 : 256, height = photo ? 1.25 : .9;
    const fontSize = photo ? .98 : .43;
    const font = (photo ? "700 " : "400 ") + fontSize * density + "px Georgia, serif";
    const title = photo ? t("copy.photography") : room.name;
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = font;
    const width = Math.min(item.theme === "process" ? 6 : roomWidth * .76,
      measure.measureText(title).width / density + .06);
    const top = photo ? 9.6 : 8.1;
    const texture = canvasTexture((context, pixelWidth, pixelHeight) => {
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.textBaseline = "top"; context.textAlign = "center";
      context.font = font;
      context.letterSpacing = "0px"; context.fillStyle = "#ffffff";
      wrapText(context, title, pixelWidth - 8).forEach((row, index) =>
        context.fillText(row, pixelWidth / 2, index * .43 * density * 1.2));
      if (photo) {
        context.fillStyle = "#ffffff70";
        context.fillRect(pixelWidth * .42, pixelHeight - 3, pixelWidth * .16, 2);
      }
    }, Math.round(width * density), Math.round(height * density), true);
    const material = new THREE.MeshBasicMaterial({
      map: texture, color: "#302e29", transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
    });
    const inscription = mesh(item.group, plane, material);
    inscription.receiveShadow = true;
    size(inscription, photo ? 0 : centerX, top - height / 2, backZ + .045, width, height);
    return inscription;
  }

  const plaqueEdge = new THREE.MeshStandardMaterial({ color: "#d5d2c9", roughness: .88 });
  function paintPlaque(item, work, left, available) {
    const density = 320, padding = .12;
    const process = item.theme === "process";
    const lines = () => [
      { text: work.source.querySelector(".work-label strong").textContent, size: process ? .235 : .205, weight: 600, ink: "#252824" },
      { text: work.source.querySelector(".work-medium")?.textContent || t("copy.digital-work"), size: process ? .18 : .16, weight: 400, ink: "#3d443b" }
    ];
    const measure = document.createElement("canvas").getContext("2d");
    const font = line => line.weight + " " + line.size * density + "px Arial";
    const naturalWidth = Math.max(...lines().map(line => {
      measure.font = font(line); return measure.measureText(line.text).width / density + 2 * padding;
    }));
    const width = Math.min(available, Math.max(2.8, naturalWidth));
    function layout(context) {
      const rows = []; let y = .1;
      for (const line of lines()) {
        context.font = font(line);
        const wrapped = wrapText(context, line.text, (width - 2 * padding) * density);
        wrapped.forEach((text, index) => {
          rows.push({ ...line, text, y });
          y += line.size * 1.18 + (index === wrapped.length - 1 ? .04 : 0);
        });
      }
      return { rows, height: y + .06 };
    }
    const height = layout(measure).height;
    const texture = canvasTexture((context, pixelWidth, pixelHeight) => {
      context.fillStyle = "#f6f4ed"; context.fillRect(0, 0, pixelWidth, pixelHeight);
      context.textAlign = "left"; context.textBaseline = "top";
      for (const line of layout(context).rows) {
        context.fillStyle = line.ink; context.font = font(line);
        context.fillText(line.text, padding * density, line.y * density);
      }
    }, Math.round(width * density), Math.round(height * density), true);
    const front = mesh(item.group, plane, new THREE.MeshStandardMaterial({ map: texture, roughness: .92 }));
    size(front, left + width / 2, work.anchor.y - height / 2, backZ + .075, width, height);
    // Shared board and shadow resources; each inscription owns only its ink texture.
    const board = mesh(front, box, plaqueEdge);
    front.receiveShadow = true;
    board.position.z = -.016; board.scale.set(1, 1, .03); board.castShadow = board.receiveShadow = true;
    const contact = mesh(front, plane, shadowSurface);
    contact.position.set(.018 / width, -.025 / height, -.052);
    contact.scale.set(1 / .625, 1 / .625, 1);
    return front;
  }

  const minimumWallContentBottom = 2.8;
  function raiseWallRows(item) {
    const rowShifts = new Map();
    item.works.forEach(work => {
      const frameBottom = work.visual.position.y + work.frame.position.y - work.frame.scale.y / 2;
      const labelBottom = work.labelPaint
        ? work.labelPaint.position.y - work.labelPaint.scale.y / 2
        : minimumWallContentBottom;
      const shift = Math.max(0, minimumWallContentBottom - frameBottom, minimumWallContentBottom - labelBottom);
      const row = work.frame.position.y.toFixed(3);
      rowShifts.set(row, Math.max(rowShifts.get(row) || 0, shift));
    });
    item.works.forEach(work => {
      const shift = rowShifts.get(work.frame.position.y.toFixed(3));
      work.visual.position.y += shift;
      work.anchor.y += shift;
      if (work.labelPaint) work.labelPaint.position.y += shift;
    });
  }

  function arrangeWallText(item, room) {
    [...(item.wallText || []), ...(item.wallDecor || [])].forEach(inscription => {
      translatedTextures.delete(inscription.material.map);
      inscription.material.map.dispose(); inscription.material.dispose();
      item.group.remove(inscription);
    });
    item.wallText = [];
    item.wallDecor = [];
    item.headingPaint = null;
    item.works.forEach(work => { work.labelPaint = null; });
    if (narrow || !item.works.length || item.display === "graphic-wall") {
      raiseWallRows(item);
      return;
    }
    const left = Math.min(...item.works.map(work => work.frame.position.x - work.frame.scale.x / 2));
    const right = Math.max(...item.works.map(work => work.frame.position.x + work.frame.scale.x / 2));
    item.headingPaint = paintHeading(item, room, (left + right) / 2);
    item.wallText.push(item.headingPaint);
    if (item.theme === "photo") {
      for (const [key, x, y] of [
        ["copy.nature-animal-photography", -10.21, 7.95],
        ["copy.nature-details-still-life", 8.805, 7.95],
        ["copy.portrait-studies", 19.163, 7.95]
      ]) {
        const title = t(key), density = 320, fontSize = .4;
        const measure = document.createElement("canvas").getContext("2d");
        measure.font = fontSize * density + "px Georgia, serif";
        const width = measure.measureText(title).width / density + .15;
        const texture = canvasTexture((context, pixelWidth) => {
          context.textAlign = "center"; context.textBaseline = "top";
          context.font = fontSize * density + "px Georgia, serif";
          context.fillStyle = "#ffffff";
          context.fillText(title, pixelWidth / 2, 0);
        }, Math.ceil(width * density), 160, true);
        const inscription = mesh(item.group, plane, new THREE.MeshBasicMaterial({
          map: texture, color: "#302e29", transparent: true, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -1
        }));
        inscription.receiveShadow = true;
        size(inscription, x, y, backZ + .045, width, .5);
        item.wallDecor.push(inscription);
      }
    }
    item.works.filter(work => item.theme !== "photo" && !work.companion && !work.hideLabel).forEach(work => {
      const labelLeft = work.anchor.x - item.group.position.x;
      const nextColumn = item.works.filter(other => other !== work && !other.companion
        && other.frame.position.x - work.frame.position.x > .5)
        .map(other => other.anchor.x - work.anchor.x).filter(distance => distance > .5);
      const available = nextColumn.length ? Math.min(...nextColumn) - .35 : ["photo", "process"].includes(item.theme) ? work.frame.scale.x : Math.max(work.frame.scale.x, roomWidth * .48 - labelLeft);
      const labelWidth = Math.min(Math.max(work.frame.scale.x, 2.7), 4.3, Math.max(1.8, available));
      work.labelPaint = paintPlaque(item, work, labelLeft, labelWidth);
      item.wallText.push(work.labelPaint);
    });
    raiseWallRows(item);
  }

  function positionPaintHit(inscription, element) {
    const bounds = inscription?.visible && !nativeHitOccluded(inscription) ? projectPlane(inscription, width, height) : null;
    element.style.visibility = bounds ? "visible" : "hidden";
    if (!bounds) return;
    element.style.left = bounds.left.toFixed(1) + "px";
    element.style.top = bounds.top.toFixed(1) + "px";
    element.style.width = bounds.width.toFixed(1) + "px";
    element.style.height = bounds.height.toFixed(1) + "px";
    element.style.transform = "none";
  }

  function positionSide(side) {
    const x = side.direction * roomWidth / 2;
    size(side.wall, x, 4, (backZ + frontZ) / 2, depth, roomHeight);
    size(side.trim, x, .09, (backZ + frontZ) / 2, .06, .18, depth);
  }

  function hangWorks(item) {
    const count = item.works.length;
    const gameLayout = !narrow && item.gameExhibit ? gameWallStyle(item.theme, item.display, count).slots : null;
    const webLayout = !narrow && item.display === "interface" && count === 3;
    const portraits = item.works.every(work => work.src && galleryImageSizes.get(work.src).height > galleryImageSizes.get(work.src).width);
    let photoRow = null;
    if (item.theme === "photo") {
      const slots = photoWallLayout();
      photoRow = item.works.map((work, index) => {
        if (narrow) return {x:0, y:4, w:Math.min(roomWidth * .82, 6), h:4.4};
        return slots[index];
      });
    }
    item.works.forEach(function (work, index) {
      work.visual.position.y = 0;
      const portrait = work.src && galleryImageSizes.get(work.src).height > galleryImageSizes.get(work.src).width;
      let x, y, w, h;
      if (photoRow) {
        ({ x, y, w, h } = photoRow[index]);
      } else if (gameLayout) {
        ({ x, y, w, h } = gameLayout[index]);
        if (index === 0 && portrait) w = 2.2;
      } else if (item.theme === "process") {
        x = narrow ? 0 : (index ? 7 : -7);
        y = narrow ? (index ? 3 : 5.7) : 4.2;
        w = narrow ? Math.min(roomWidth * .82, 4) : 5.8;
        h = narrow ? 1.9 : 4;
      } else if (item.display === "graphic-wall") {
        // Each design has its own stop. Its application stays with the original.
        x = narrow || count === 1 ? 0 : work.companion ? 2.05 : -1.5;
        w = narrow ? Math.min(roomWidth * .82, 4) : work.companion && count > 1 ? 1.25 : 2.55;
        h = count === 1 ? (narrow ? 3.2 : 2.7)
          : work.companion ? (narrow ? 1.35 : 1.5) : (narrow ? 2.5 : 2.5);
        const top = count === 1 ? 3.8 + h / 2
          : narrow ? (work.companion ? 2.9 : 6.25) : 6.5;
        y = top - h / 2;
      } else if (item.theme === "print") {
        if (narrow) {
          // Erst ein Hauptwerk, danach zwei Paare. Die Paarabstände bleiben kleiner.
          const layouts = [[5.95, 1.3], [4.2, .85], [1.95, .85], [3.35, .65], [1.1, .65]];
          [y, h] = layouts[index]; x = 0; w = roomWidth * .82;
        } else {
          const totalWidth = Math.min(roomWidth * .76, 12);
          const gap = 1.5;
          w = (totalWidth - gap * 2) / 3;
          x = (work.group - 1) * (w + gap) + roomWidth * .04;
          h = work.group === 0 ? 4.35 : work.companion ? 1.5 : 2.3;
          const top = work.companion ? 3.15 : 6;
          y = top - h / 2;
        }
      } else if (["arena", "workshop"].includes(item.theme) && count === 3 && !narrow) {
        // Das Spiel führt; rechts bilden zwei Studien eine gemeinsame Spalte.
        x = roomWidth * (index === 0 ? -.1 : .29);
        w = index === 0 ? roomWidth * .49 : Math.min(roomWidth * .27, 3.5);
        h = index === 0 ? Math.min(3.8, roomWidth * .25) : 2;
        // Gleiche Unterkante wie die untere Studie; links bleibt Platz für den Aufsteller.
        y = index === 0 ? 1.45 + h / 2 : [0, 5.9, 2.45][index];
      } else if (narrow) {
        w = Math.min(roomWidth * .82, 4);
        if (item.display === "research" && count === 4) {
          y = [8.8, 7, 5.2, 3.4][index];
          h = 1.5;
        } else if (count === 3) {
          y = [5.8, 3.72, 1.58][index];
          h = portraits ? 1.1 : (index === 0 ? Math.min(1.1, w / 2.08) : [0, 1.55, 1][index]);
          if (item.theme === "atelier" && index === 1) h = 1.4;
          if (item.display === "interface") { y = [5.9, 3.75, 1.6][index]; h = [1.5, 1.4, 1.4][index]; }
          if (["arena", "workshop"].includes(item.theme)) h = index === 0 ? 1.4 : 1.15;
        } else {
          y = count === 1 ? 3.65 : [4.65, portrait ? 2.25 : 2][index];
          // Unter der großen Studienbeschriftung bleibt Luft zum zweiten Rahmen.
          if (item.theme === "cabinet" && index === 1) y = 2;
          h = count === 1 ? 2.5 : (index === 0 ? Math.min(2.1, w / 1.98) : 1.75);
          if (item.display === "interface" && count === 2) {
            y = index === 0 ? 4.75 : 1.8;
            if (index === 0) h = 2.7;
            // Die längere Rollenangabe braucht vor dem zweiten Bild etwas mehr Luft.
            if (item.theme === "studio" && index === 0) h = 2.4;
          }
        }
        x = 0;
      } else if (item.display === "interface" && count === 3) {
        x = [0, 5.4, -5.4][index];
        w = index === 0 ? (portrait ? 2.4 : 4.8) : 5.2;
        h = index === 0 ? 3.4 : 3;
        y = 6.4 - h / 2;
      } else if (item.theme === "atelier" && count > 1) {
        x = roomWidth * [-.28, .1, .36][index]; y = 3.8;
        w = roomWidth * [.34, .28, .16][index]; h = [2.65, 3.1, 2.5][index];
      } else if (count === 3) {
        x = roomWidth * [-.29, .08, .32][index];
        y = 3.8;
        w = roomWidth * [.35, .19, .18][index];
        h = [2.6, 3.35, 2.4][index];
      } else if (count === 2 && item.display === "interface") {
        x = Math.min(roomWidth, 14) * [-.15, .15][index]; y = 3.8;
        w = roomWidth * [.28, .43][index]; h = index ? 2.7 : 3.8;
      } else {
        x = count === 1 ? 0 : roomWidth * [-.2, .28][index];
        y = 3.8;
        w = roomWidth * (count === 1 ? .69 : [.49, .29][index]);
        h = count === 1 ? (portrait ? 3.8 : 3.1) : 3.05;
        if (item.display === "asset-wall") { x = roomWidth * [-.17, .32][index]; w = roomWidth * [.54, .2][index]; h = index ? 2.9 : 3.3; }
      }
      if (!narrow && !gameLayout && count === 2 && index === 0 && item.display !== "interface"
        && item.display !== "graphic-wall" && item.theme !== "process") h = 3.6;

      if (work.kind === "kinbot") { w = narrow ? Math.min(w, 2.8) : 4.5; h = narrow ? 1.7 : 2.8; }

      const fixedMount = item.theme === "print";
      const studyStack = ["arena", "workshop"].includes(item.theme) && count === 3 && !narrow && index > 0;
      const fixedFrame = fixedMount || studyStack || Boolean(gameLayout) || webLayout;
      const frameWidth = w, frameHeight = h;
      // Die bisherige Hängefläche enthält jetzt auch Passepartout und Rahmen.
      const rail = photoRow ? (narrow ? .025 : .05) : Math.min(work.mount.rail, Math.min(w, h) * .045);
      const mat = photoRow ? (narrow ? .075 : .24) : Math.min(work.mount.mat, Math.min(w, h) * .12);
      const padding = rail + mat;
      w -= padding * 2; h -= padding * 2;
      // Das gesamte Original bleibt sichtbar, unabhängig vom Seitenverhältnis.
      if (work.src) {
        const image = galleryImageSizes.get(work.src);
        const factor = Math.min(w / image.width, h / image.height);
        w = image.width * factor; h = image.height * factor;
      } else {
        if (work.kind === "board") h = Math.min(h, w / 1.45);
        updateWorkPoster(work, w, h);
      }
      // Ein gemeinsames Außenraster, variable Passepartouts: kein Original wird beschnitten.
      const outerW = fixedFrame ? frameWidth : w + padding * 2;
      const outerH = fixedFrame ? frameHeight : h + padding * 2;
      if (photoRow && !narrow && photoRow[index].top) y = photoRow[index].top - outerH / 2;
      if (gameLayout) y = gameLayout[index].top - outerH / 2;
      const matWidth = fixedFrame ? outerW - rail * 2 : w + mat * 2;
      const matHeight = fixedFrame ? outerH - rail * 2 : h + mat * 2;
      const front = backZ + .1 + work.mount.depth;
      size(work.frame, x, y, backZ + .12, outerW, outerH, .12);
      // Vier echte Leisten lassen das Bild gegenüber der Rahmenfront zurücktreten.
      size(work.rails[0], x, y + outerH / 2 - rail / 2, front - work.mount.depth / 2, outerW, rail, work.mount.depth);
      size(work.rails[1], x, y - outerH / 2 + rail / 2, front - work.mount.depth / 2, outerW, rail, work.mount.depth);
      size(work.rails[2], x - outerW / 2 + rail / 2, y, front - work.mount.depth / 2, rail, outerH - rail * 2, work.mount.depth);
      size(work.rails[3], x + outerW / 2 - rail / 2, y, front - work.mount.depth / 2, rail, outerH - rail * 2, work.mount.depth);
      size(work.mat, x, y, backZ + .192, matWidth, matHeight);
      // Keep the opaque layers distinct in the depth buffer at hall distances.
      size(work.reveal, x, y, backZ + .208, w + .025, h + .025);
      size(work.picture, x, y - .008, backZ + .224, w, h);
      size(work.glass, x, y, front - .014, matWidth, matHeight);
      size(work.shadow, x, y - .008,
        backZ + .022, outerW / .625, outerH / .625);
      size(work.light, x, y + outerH * .12, backZ + .012, outerW * 1.3, outerH * 1.55);
      const lampY = narrow ? y + outerH / 2 + .13 : 7.38;
      const lampZ = backZ + (narrow ? .24 : 1.3);
      // Die erste Leuchte sitzt außerhalb der Kopfzeile und zielt schräg aufs Hauptwerk.
      const lampX = fixedMount && !narrow && work.group === 0 ? x - outerW * .7 : x;
      work.lamp.position.set(lampX, lampY, lampZ);
      // Mobile Bilderleuchte flach halten, damit sie keine Texte überdeckt.
      work.lamp.scale.set(narrow ? 1.1 : 1, narrow ? .24 : 1, narrow ? .35 : 1);
      // lookAt erwartet Weltkoordinaten; die Leuchte gehört zum jeweiligen Raum.
      lampDirection.set(x + item.group.position.x, y, backZ + .2);
      item.group.updateMatrixWorld(true); work.lamp.lookAt(lampDirection);
      if (narrow) size(work.lampStem, lampX, lampY + .04, backZ + .12, .025, .025, .24);
      else size(work.lampStem, lampX, lampY + .14, lampZ, .045, .2, .045);
      const beamBottom = y + outerH * .1;
      const beamHeight = lampY - beamBottom;
      const beamLean = x - lampX;
      size(work.beam, (lampX + x) / 2, (lampY + beamBottom) / 2, backZ + .01,
        outerW * 1.25, Math.hypot(beamHeight, beamLean));
      work.beam.rotation.z = Math.atan2(beamLean, beamHeight);
      work.shadow.visible = true;
      work.lamp.visible = work.lampStem.visible = work.light.visible = work.beam.visible = !work.companion;
      if (narrow && item.theme === "process") work.lamp.visible = work.lampStem.visible = work.beam.visible = false;
      // Die rechte Gruppe teilt sich eine Deckenleuchte; keine doppelten Strahler.
      if (studyStack && index === 2) work.lamp.visible = work.lampStem.visible = work.beam.visible = false;
      // Die schmalen Beschriftungen folgen der linken Rahmenkante, auch am Handy.
      const labelX = x - outerW / 2;
      work.anchor.set(labelX + item.group.position.x, y - outerH / 2 - (narrow ? .18 : .27), backZ + .22);
      if (fixedMount && item.display !== "graphic-wall" && !work.companion) {
        // Eine gemeinsame Beschriftung sitzt unter jedem vollständigen Themenblock.
        work.anchor.y = narrow ? [5.16, 2.885, .635][work.group] : 1.25;
      }
      const framePixels = outerW / roomWidth * width * .9;
      const labelFraction = ["arena", "workshop"].includes(item.theme) && index === 0 ? .25 : count === 3 ? .15 : .21;
      const desktopLabelWidth = Math.min(240, width * labelFraction, Math.max(190, framePixels * .8));
      const pixelsPerUnit = height / (2 * (cameraZ - backZ - .22) * Math.tan(THREE.MathUtils.degToRad(22)));
      // Unter schmalen Hochformaten braucht der Text mehr Breite als der Rahmen.
      const mobileLabelWidth = ["cabinet", "studio"].includes(item.theme) ? Math.max(190, outerW * pixelsPerUnit) : outerW * pixelsPerUnit;
      const labelWidth = narrow ? Math.min(240, mobileLabelWidth, width * .76)
        : fixedFrame || photoRow ? Math.min(240, outerW * pixelsPerUnit) : desktopLabelWidth;
      if (fixedMount && index === 0) {
        // Überschrift und Gruppenbeschriftungen folgen derselben linken Rasterkante.
        stage.style.setProperty("--print-grid-left", (width / 2 + (x - outerW / 2) * pixelsPerUnit).toFixed(1) + "px");
      }
      if (photoRow && index === 0) stage.style.setProperty("--photo-grid-left", (width / 2 + (x - outerW / 2) * pixelsPerUnit).toFixed(1) + "px");
      if (work.label) {
        work.label.style.left = work.label.style.top = "0";
        work.label.style.height = "";
        work.label.style.width = Math.round(labelWidth) + "px";
      }
    });
    if (item.display === "graphic-wall") {
      const baseline = Math.min(...item.works.map(work => work.frame.position.y - work.frame.scale.y / 2)) - (narrow ? .18 : .3);
      item.works.forEach(work => { work.anchor.y = baseline; });
    }
    if (!narrow && !gameLayout && !webLayout && item.display !== "graphic-wall" && !["photo", "process"].includes(item.theme)) spaceExhibitColumns(item.works);
    // One caption baseline for works hung in a row; stacked studies retain their own labels.
    if (!narrow && !gameLayout && !webLayout && !["arena", "workshop", "print", "photo"].includes(item.theme) && count > 1) {
      const baseline = Math.min(...item.works.map(work => work.anchor.y));
      item.works.forEach(work => { work.anchor.y = baseline; });
    }
  }

  // 4. Raumgrößen und Hängung nur nach tatsächlichen Größenänderungen berechnen.
  function resize(force = false) {
    // Platz unter den Werken: die Leiste und rundherum etwas sichtbarer Boden.
    const nextWidth = stage.clientWidth, nextHeight = stage.clientHeight;
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, renderQuality.pixelRatio);
    // Während des Fensterwechsels können kurz fast null Pixel gemeldet werden.
    if (nextWidth < 160 || nextHeight < 240 || (force !== true && width === nextWidth && height === nextHeight && renderer.getPixelRatio() === nextPixelRatio)) return;
    if (walk) finishWalk();
    width = nextWidth; height = nextHeight;
    stage.style.setProperty("--scene-height", height + "px");
    bounds = null;
    heading.removeAttribute("style");
    // Short landscape screens use the hall instead of squeezing stacked works.
    narrow = compactGallery();
    updateMouseLookAvailability();
    renderer.shadowMap.enabled = !narrow && renderQuality.shadows;
    // Only compact rooms adapt their geometry; the shared hall has fixed dimensions.
    roomWidth = narrow ? roomHeight * width / height * 1.1 : hallBay;
    // A monitor/zoom change can alter pixel density while CSS dimensions stay unchanged.
    renderPixelRatio = nextPixelRatio;
    renderer.setDrawingBufferSize(width, height, renderPixelRatio);
    effects.resize(width, height, renderPixelRatio);
    if (firstFrameRendered && !narrow) effects.schedule();
    camera.aspect = width / height;
    museum.forEach(function (item, index) {
      // Restore the fallback room before the common hall selectively hides it.
      // This also makes desktop → phone → desktop resizes reversible.
      item.back.material = item.fallbackWall;
      item.back.visible = item.floor.visible = item.ceiling.visible = true;
      item.left.wall.visible = item.right.wall.visible = true;
      item.left.trim.visible = item.right.trim.visible = item.backTrim.visible = true;
      item.lights.forEach(light => { light.visible = true; });
      if (item.rug) item.rug.visible = true;
      if (item.rugShadow) item.rugShadow.visible = true;
      item.group.rotation.set(0, 0, 0);
      item.group.scale.setScalar(1);
      item.group.position.set(index * (roomWidth + 2), 0, 0);
      size(item.back, 0, 4, backZ, roomWidth, roomHeight);
      size(item.floor, 0, 0, (backZ + frontZ) / 2, roomWidth, depth);
      size(item.ceiling, 0, roomHeight, (backZ + frontZ) / 2, roomWidth, depth);
      size(item.backTrim, 0, .09, backZ + .02, roomWidth, .18, .06);
      positionSide(item.left); positionSide(item.right);
      item.lights.forEach((light, n) => size(light, 0, roomHeight - .025, 1 + n * 6, roomWidth * .55, .055));
      const jointCount = ["research", "studio", "print"].includes(item.theme) ? 6 : item.theme === "workshop" ? 8 : 12;
      for (let n = 0; n <= jointCount; n++) {
        const x = -roomWidth / 2 + n * roomWidth / jointCount;
        item.joints.setXYZ(n * 2, x, .012, backZ);
        item.joints.setXYZ(n * 2 + 1, x, .012, frontZ);
      }
      item.lines.geometry.setDrawRange(0, (jointCount + 1) * 2);
      item.joints.needsUpdate = true; item.lines.geometry.computeBoundingSphere();
      item.lines.visible = item.display !== "photography" && !["arena", "cabinet", "atelier"].includes(item.theme);
      if (item.display === "photography") woodTexture.repeat.set(roomWidth / 5, depth / 5);
      if (item.theme === "arena") corkTexture.repeat.set(roomWidth / 3.5, depth / 3.5);
      if (item.theme === "cabinet") cabinetFloor.repeat.set(roomWidth / 5, depth / 5);
      if (item.theme === "atelier") atelierFloor.repeat.set(roomWidth / 4, depth / 4);
      if (item.rug) {
        const arena = item.theme === "arena";
        const rugWidth = arena && narrow ? 2.3 : Math.min(roomWidth * .46, 7);
        const rugDepth = arena ? rugWidth / 3 : 2.3;
        const rugX = arena && narrow ? 0 : roomWidth * .055;
        // Das Spielfeld liegt mobil längs im Raum; seine Proportionen bleiben erhalten.
        item.rug.rotation.z = arena && narrow ? Math.PI / 2 : 0;
        item.rugShadow.rotation.z = item.rug.rotation.z;
        size(item.rug, rugX, .026, -.65, rugWidth, rugDepth);
        size(item.rugShadow, rugX + .04, .019, -.6, rugWidth * 1.13, arena ? rugDepth * 1.2 : 2.75);
      }
      hangWorks(item);
      item.architecture?.update({ narrow });
      arrangeWallText(item, rooms[index]);
    });
    arrangeHall();
    visibleRooms();
    updateHallGuide();
    restCamera();
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  }

  function restPoint(index) {
    if (narrow) return new THREE.Vector3(museum[index].group.position.x, 4, cameraZ);
    const item = viewingItem(index);
    if (!item.works.length) {
      const target = hallTarget(index);
      const distance = THREE.MathUtils.clamp(6.4 * camera.aspect, 5.6, 12);
      return new THREE.Vector3(target.x + distance, 4.25, target.z + distance * .38);
    }
    let halfWidth = 0, halfHeight = 3.8;
    item.works.forEach(work => {
      halfWidth = Math.max(halfWidth, Math.abs(work.frame.position.x) + work.frame.scale.x / 2 + .45);
      halfHeight = Math.max(halfHeight, Math.abs(work.frame.position.y + work.visual.position.y - 4) + work.frame.scale.y / 2 + .65);
      if (work.labelPaint) halfHeight = Math.max(halfHeight, 4 - (work.labelPaint.position.y - work.labelPaint.scale.y / 2) + .35);
    });
    for (const inscription of [...(item.wallText || []), ...(item.wallDecor || [])]) {
      halfWidth = Math.max(halfWidth, Math.abs(inscription.position.x) + inscription.scale.x / 2 + .45);
      halfHeight = Math.max(halfHeight, Math.abs(inscription.position.y - 4) + inscription.scale.y / 2 + .65);
    }
    const tangent = Math.tan(THREE.MathUtils.degToRad(guidedFov(index) / 2));
    const distance = Math.max(10.2, halfWidth / (tangent * camera.aspect), halfHeight / tangent) * 1.12;
    return item.group.localToWorld(new THREE.Vector3(0, 4, backZ + distance));
  }
  function restCamera() {
    resetTouchControls();
    freeWalk.reset();
    camera.fov = guidedFov(currentRoom);
    camera.updateProjectionMatrix();
    targetPosition.copy(restPoint(currentRoom)); camera.position.copy(targetPosition);
    stage.dataset.cameraFov = String(Math.round(camera.fov * 10) / 10);
    stage.dataset.cameraDistance = String(
      Math.round(camera.position.distanceTo(hallTarget(currentRoom)) * 10) / 10
    );
    camera.lookAt(hallTarget(currentRoom));
  }
  function orientAt(position, target) {
    lookMatrix.lookAt(position, target, camera.up);
    return new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
  }
  function visibleRooms() {
    museum.forEach((item, index) => {
      item.group.visible = narrow ? index === currentRoom : item.works.length > 0;
      if (item.theme === "photo") item.works.forEach((work, photo) => {
        work.visual.visible = !narrow || photo === photoStop;
        if (work.label) work.label.hidden = narrow && photo !== photoStop;
      });
    });
  }

  function arrive(index, focus) {
    heading.removeAttribute("style");
    showRoom(index);
    resize();
    restCamera();
    visibleRooms();
    requestRender();
    if (focus) heading.querySelector("h1").focus({ preventScroll: true });
    if (narrow && rooms[index].id === "photos") {
      requestAnimationFrame(() => rooms[index].works[photoStop].label?.scrollIntoView({ block: "center", behavior: "instant" }));
    }
  }

  // Desktop navigation follows a collision-aware path; mobile and reduced motion arrive immediately.
  navigate = function (index, animate = true, focus = false, photo = 0) {
    const nextPhoto = rooms[index].id === "photos" ? THREE.MathUtils.clamp(Math.trunc(Number(photo)) || 0, 0, museum[index].works.length - 1) : 0;
    if (travelling || (index === currentRoom && nextPhoto === photoStop && !freeWalk.active) || contextLost) return false;
    exitMouseLook();
    resetTouchControls();
    freeWalk.reset();
    photoStop = nextPhoto;
    if (!narrow && animate && !reducedMotion.matches) {
      const end = restPoint(index);
      const route = findGuidedRoute(camera.position.clone(), end, roomWidth, columnPositions, hallObstacles);
      if (!route) { arrive(index, focus); return true; }
      walk = { index, focus, route,
        startLook: camera.quaternion.clone(), endLook: orientAt(end, hallTarget(index)),
        startFov: camera.fov, endFov: guidedFov(index), time: null };
      travelling = true; updateHallGuide(); updateMouseLookAvailability(); pointerInside = false; clearHover();
      stage.classList.add("is-travelling");
      stage.setAttribute("aria-busy", "true");
      labels.inert = roomDoors.inert = true;
      requestRender(); return true;
    }
    arrive(index, focus);
    return true;
  };

  finishWalk = function () {
    if (!walk) return;
    const { index, focus } = walk;
    walk = null;
    travelling = false;
    updateMouseLookAvailability();
    stage.classList.remove("is-travelling");
    stage.removeAttribute("aria-busy");
    labels.inert = roomDoors.inert = false;
    arrive(index, focus);
  };

  function animateWalk(time) {
    if (walk.time === null) walk.time = time;
    const progress = Math.min((time - walk.time) / 1300, 1);
    const eased = progress * progress * (3 - 2 * progress);
    walk.route.getPoint(eased, camera.position);
    camera.quaternion.slerpQuaternions(walk.startLook, walk.endLook, eased);
    camera.fov = THREE.MathUtils.lerp(walk.startFov, walk.endFov, eased);
    camera.updateProjectionMatrix();
    if (progress === 1) finishWalk();
  }

  // 6. Nur bei Änderungen zeichnen.
  function modalOpen() { return Boolean(document.querySelector("dialog[open]")); }
  function requestRender() {
    sceneNeedsRender = true;
    scheduleFrame();
  }
  function scheduleFrame() {
    if (frame === null && !document.hidden && !modalOpen() && !contextLost) frame = requestAnimationFrame(render);
  }
  function placeLabel(work) {
    if (work.companion || !work.label || work.label.hidden) return;
    projected.copy(work.anchor).project(camera);
    let x = (projected.x + 1) * width / 2;
    const y = (1 - projected.y) * height / 2;
    work.label.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
    work.label.style.visibility = "visible";
  }
  function render(time) {
    frame = null;
    if (!sceneNeedsRender) {
      updateHover();
      return;
    }
    sceneNeedsRender = false;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .25) : 1 / 60;
    const frameMs = lastTime ? time - lastTime : 0;
    lastTime = time;
    if (walk) animateWalk(time);
    else if (freeWalk.active && !narrow) {
      freeWalk.update(delta);
      targetPosition.copy(camera.position);
    } else {
      camera.position.lerp(targetPosition, reducedMotion.matches ? 1 : 1 - Math.exp(-24 * delta));
      camera.lookAt(hallTarget(currentRoom));
    }
    camera.updateMatrixWorld();
    updateVisibleTextures();
    // Reflexe folgen nur der vorhandenen Kamera. Keine zusätzliche Animationsschleife.
    museum.forEach(function (item) {
      if (!item.group.visible) return;
      localCamera.copy(camera.position); item.group.worldToLocal(localCamera);
      item.works.forEach(function (work) {
        const distance = Math.max(.6, localCamera.z - work.glass.position.z);
        const horizontal = (localCamera.x - work.glass.position.x) / distance;
        const vertical = (localCamera.y - work.glass.position.y) / distance;
        const restDistance = cameraZ - work.glass.position.z;
        const restHorizontal = -work.glass.position.x / restDistance;
        const restVertical = (4 - work.glass.position.y) / restDistance;
        // Die bisherigen Reflexe in Ruhe erhalten. Kamerabewegung zusätzlich
        // auswerten, damit auch seitliche Bilder auf den Blickwinkel reagieren.
        const shiftX = THREE.MathUtils.clamp(restHorizontal * .3, -.07, .07)
          + THREE.MathUtils.clamp((horizontal - restHorizontal) * .7, -.035, .035);
        const shiftY = THREE.MathUtils.clamp(restVertical * .2, -.07, .07)
          + THREE.MathUtils.clamp((vertical - restVertical) * .6, -.03, .03);
        work.glass.material.map.offset.set(.08 + shiftX, .08 + shiftY);
      });
    });
    effects.updateFrame(frameMs, Boolean(walk || freeWalk.moving));
    if (!effects.render(delta)) renderer.render(scene, camera);
    updateHover();
    if (!walk) {
      hallDisplays.entries.forEach(entry => {
        entry.button.hidden = narrow || rooms[currentRoom].id !== "lobby";
        if(!entry.button.hidden) positionPaintHit(entry.hit,entry.button);
      });
      const room = museum[currentRoom];
      const painted = !narrow && room.works.length > 0 && Boolean(room.headingPaint);
      stage.classList.toggle("has-wall-lettering", painted);
      if (painted) {
        positionPaintHit(room.headingPaint, heading);
      }
      if (room.theme === "photo" || room.display === "graphic-wall") {
        room.works.forEach(work => {
          if (!work.companion) positionPaintHit(isWorldVisible(work.frame) ? work.frame : null, work.label);
        });
      } else if (painted) {
        room.works.forEach(work => { if (work.labelPaint) positionPaintHit(work.labelPaint, work.label); });
      } else {
        room.works.forEach(placeLabel);
      }
    }
    if (!firstFrameRendered) {
      firstFrameRendered = true;
      performance.mark("museum:first-frame");
      performance.measure("museum:scene-build", "museum:scene-build-start", "museum:first-frame");
      performance.measure("museum:startup");
      stage.dataset.renderQuality = renderQuality.level;
      stage.dataset.firstFrameMs = String(Math.round(performance.now()));
      window.clearTimeout(loadingHintTimer);
      stage.removeAttribute("aria-busy");
      stage.classList.add("is-ready");
      loadingScreen.inert = true;
      loadingScreen.setAttribute("aria-hidden", "true");
      window.setTimeout(() => { loadingScreen.hidden = true; }, reducedMotion.matches ? 0 : 300);
      stage.dispatchEvent(new Event("museum-ready"));
      status.hidden = true;
      effects.schedule();
    }
    if (walk || freeWalk.moving || camera.position.distanceToSquared(targetPosition) > .000001) requestRender();
    else lastTime = 0;
  }
  function rememberPointer(event) {
    if (!bounds) bounds = stage.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  }
  stage.addEventListener("pointermove", function (event) {
    if (document.pointerLockElement === canvas || event.pointerType !== "mouse" || travelling || modalOpen()) return;
    pointerInside = event.target === canvas;
    if (!pointerInside) { clearHover(); return; }
    rememberPointer(event);
    scheduleFrame();
  });
  stage.addEventListener("pointerleave", () => { pointerInside = false; bounds = null; clearHover(); });
  window.addEventListener("scroll", function () { bounds = null; }, { passive: true });
  function pick() {
    const room = museum[currentRoom];
    const pickables = (narrow ? room.works.map(work => work.frame) : hallPickables).filter(isWorldVisible);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0]?.object;
    return hit && !hit.userData.project && !hit.userData.action && !hit.userData.roomTarget ? null : hit || null;
  }
  function clearHover() {
    hovered = null; canvas.style.cursor = "default";
  }
  function updateHover() {
    const next = pointerInside && !travelling ? pick() : null;
    if (next === hovered) return;
    hovered = next;
    canvas.style.cursor = hovered ? "pointer" : "default";
  }
  canvas.addEventListener("click", function (event) {
    if (document.pointerLockElement === canvas || travelling || modalOpen() || contextLost) return;
    rememberPointer(event);
    scene.updateMatrixWorld();
    const selected = pick();
    if (selected?.userData.project) openWork(selected.userData.project, selected.userData.label);
    if (selected?.userData.roomTarget) goToRoom(selected.userData.roomTarget);
  });
  canvas.addEventListener("pointerdown", () => document.getElementById("main").focus({ preventScroll: true }));
  function touchAvailable() {
    return !narrow && !travelling && !modalOpen() && !contextLost && !document.hidden
      && !document.querySelector(".museum-menu[open]");
  }
  function moveJoystick(event) {
    const rect = touchJoystick.getBoundingClientRect();
    const radius = rect.width * .35;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const distance = Math.hypot(x, y);
    if (distance < .12) x = y = 0;
    else if (distance > 1) { x /= distance; y /= distance; }
    touchJoystick.style.setProperty("--stick-x", `${x * radius}px`);
    touchJoystick.style.setProperty("--stick-y", `${y * radius}px`);
    freeWalk.setTouchMove(x, -y);
    requestRender();
  }
  touchJoystick.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || joystickPointer !== null || !touchAvailable()) return;
    joystickPointer = event.pointerId;
    touchJoystick.setPointerCapture(event.pointerId);
    freeWalk.enter();
    moveJoystick(event);
    event.preventDefault();
  });
  stage.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || lookPointer !== null || !touchAvailable()
      || !event.target.closest("#gallery-canvas, .hall-display-hit, .work-label, #open-room-sign")) return;
    lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    suppressTouchClick = false;
    window.clearTimeout(touchClickTimer);
  });
  document.addEventListener("pointermove", event => {
    if (event.pointerId === joystickPointer) {
      if (touchAvailable()) moveJoystick(event);
      return;
    }
    if (!lookPointer || event.pointerId !== lookPointer.id || !touchAvailable()) return;
    const dx = event.clientX - lookPointer.x, dy = event.clientY - lookPointer.y;
    if (!lookPointer.dragging && Math.hypot(dx, dy) < 8) return;
    lookPointer.dragging = true;
    suppressTouchClick = true;
    lookPointer.x = event.clientX; lookPointer.y = event.clientY;
    freeWalk.enter();
    freeWalk.look(-dx * .004, -dy * .004);
    requestRender();
  });
  function endTouch(event) {
    if (event.pointerId === joystickPointer) {
      joystickPointer = null;
      touchJoystick.style.setProperty("--stick-x", "0px");
      touchJoystick.style.setProperty("--stick-y", "0px");
      freeWalk.setTouchMove(0, 0);
      requestRender();
    }
    if (lookPointer && event.pointerId === lookPointer.id) {
      if (lookPointer.dragging) touchClickTimer = window.setTimeout(() => { suppressTouchClick = false; }, 500);
      lookPointer = null;
    }
  }
  document.addEventListener("pointerup", endTouch);
  document.addEventListener("pointercancel", endTouch);
  stage.addEventListener("click", event => {
    if (!suppressTouchClick || event.detail === 0 || event.target.closest("#touch-joystick")) return;
    suppressTouchClick = false;
    window.clearTimeout(touchClickTimer);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  function exitMouseLook() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  function updateMouseLookCopy() {
    const locked = document.pointerLockElement === canvas;
    const label = t(locked ? "copy.disable-mouse-look" : "copy.enable-mouse-look");
    mouseLookButton.querySelector("span").textContent = locked ? "Esc" : t("copy.mouse-look-short");
    mouseLookButton.setAttribute("aria-label", label);
    mouseLookButton.title = label;
    mouseLookButton.setAttribute("aria-pressed", String(locked));
    if (mouseLookStatus.dataset.message) mouseLookStatus.textContent = t(mouseLookStatus.dataset.message);
  }
  function updateMouseLookAvailability() {
    mouseLookButton.hidden = narrow || !mousePointer.matches;
    const supported = typeof canvas.requestPointerLock === "function";
    mouseLookButton.disabled = !supported || contextLost || travelling;
    if (!supported) {
      mouseLookStatus.dataset.message = "copy.mouse-look-unsupported";
      updateMouseLookCopy();
    } else if (mouseLookStatus.dataset.message === "copy.mouse-look-unsupported") {
      delete mouseLookStatus.dataset.message;
      mouseLookStatus.textContent = "";
    }
    if (mouseLookButton.hidden || mouseLookButton.disabled) exitMouseLook();
  }
  function mouseLookError(error) {
    if (error) console.warn("Mouse look could not be activated:", error);
    mouseLookStatus.dataset.message = "copy.mouse-look-error";
    updateMouseLookCopy();
  }
  mouseLookButton.addEventListener("click", () => {
    if (document.pointerLockElement === canvas) { exitMouseLook(); return; }
    if (travelling || modalOpen() || contextLost || narrow) return;
    mouseLookStatus.textContent = "";
    delete mouseLookStatus.dataset.message;
    try {
      const request = canvas.requestPointerLock();
      if (request && typeof request.catch === "function") request.catch(mouseLookError);
    } catch (error) {
      mouseLookError(error);
    }
  });
  document.addEventListener("pointerlockerror", () => mouseLookError());
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
      if (narrow || travelling || modalOpen() || contextLost || document.hidden || document.querySelector(".museum-menu[open]")) {
        exitMouseLook();
        return;
      }
      freeWalk.enter();
      pointerInside = false;
      clearHover();
      document.getElementById("main").focus({ preventScroll: true });
    } else {
      freeWalk.release();
      lastTime = 0;
    }
    updateMouseLookCopy();
    requestRender();
  });
  document.addEventListener("mousemove", event => {
    if (document.pointerLockElement !== canvas || travelling || modalOpen() || contextLost) return;
    if (!freeWalk.active) freeWalk.enter();
    freeWalk.look(-event.movementX * .002, -event.movementY * .002);
    requestRender();
  });
  mousePointer.addEventListener("change", updateMouseLookAvailability);
  function respectMotionPreference() {
    if (reducedMotion.matches) finishWalk();
    requestRender();
  }
  reducedMotion.addEventListener("change", respectMotionPreference);
  const walkKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyC", "Space", "ShiftLeft", "ShiftRight",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.pointerLockElement === canvas) {
      event.preventDefault();
      exitMouseLook();
      return;
    }
    if (event.key === "Escape" && travelling) finishWalk();
    if (!walkKeys.has(event.code) || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || modalOpen() || document.querySelector(".museum-menu[open]") || narrow || contextLost) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable
      || target.closest('input, textarea, select, video, audio, [contenteditable], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"]'))) return;
    if ((event.code.startsWith("Arrow") || event.code === "Space") && target instanceof HTMLElement
      && target.closest("button, summary, a")) return;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      freeWalk.press(event.code);
      return;
    }
    event.preventDefault();
    if (travelling) finishWalk();
    freeWalk.enter();
    if (event.shiftKey && !freeWalk.keys.has("ShiftLeft") && !freeWalk.keys.has("ShiftRight")) freeWalk.press("ShiftLeft");
    freeWalk.press(event.code); requestRender();
  });
  document.addEventListener("keyup", event => {
    if (!walkKeys.has(event.code)) return;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      freeWalk.keys.delete(event.code);
      if (!event.shiftKey) { freeWalk.keys.delete("ShiftLeft"); freeWalk.keys.delete("ShiftRight"); }
    } else freeWalk.keys.delete(event.code);
    requestRender();
  });
  window.addEventListener("blur", () => { exitMouseLook(); resetTouchControls(); freeWalk.release(); lastTime = 0; requestRender(); });
  document.querySelector(".museum-menu").addEventListener("toggle", event => {
    if (event.currentTarget.open) exitMouseLook();
    resetTouchControls();
    freeWalk.release(); lastTime = 0;
  });
  function pauseOrResume() {
    if (document.hidden || modalOpen()) { exitMouseLook(); resetTouchControls(); freeWalk.release(); }
    if (document.hidden || modalOpen()) textureQueue.setWanted([]);
    if ((document.hidden || modalOpen()) && frame !== null) {
      cancelAnimationFrame(frame); frame = null; lastTime = 0;
      finishWalk();
    } else {
      requestRender();
      effects.schedule();
    }
  }
  document.addEventListener("visibilitychange", pauseOrResume);
  document.querySelectorAll("dialog").forEach(dialog => new MutationObserver(pauseOrResume).observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault();
    exitMouseLook();
    resetTouchControls();
    freeWalk.release();
    contextLost = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    status.hidden = false;
    statusMessage = "copy.the-3d-view-was-interrupted-please-reload-the-page";
    status.textContent = t(statusMessage);
    stage.classList.add("has-startup-error");
    stage.removeAttribute("aria-busy");
    roomSignButton.disabled = previousButton.disabled = true;
    updateMouseLookAvailability();
    roomDoors.inert = true;
  });

  canvas.addEventListener("webglcontextrestored", function () {
    contextLost = false;
    labels.inert = roomDoors.inert = false;
    renderer.shadowMap.needsUpdate = true;
    status.hidden = true;
    stage.classList.remove("has-startup-error");
    showRoom(currentRoom);
    respectMotionPreference();
    updateMouseLookAvailability();
    requestRender();
  });

  // Start: Raum aus dem Link wählen, aufbauen und danach auf Änderungen warten.
  applyMuseumDesign(getMuseumDesign(), false);
  document.addEventListener("museum-design-change", event => applyMuseumDesign(event.detail.design));
  const initialRoom = museumNavigation.roomFromHash();
  photoStop = rooms[initialRoom].id === "photos" ? THREE.MathUtils.clamp(Math.trunc(Number(history.state?.photoStop)) || 0, 0, roomsById.get("photos").works.length - 1) : 0;
  showRoom(initialRoom);
  resize(); visibleRooms();
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(stage);
  window.addEventListener("resize", resize);
  let resolutionQuery;
  function watchPixelDensity() {
    resolutionQuery?.removeEventListener("change", densityChanged);
    resolutionQuery = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
    resolutionQuery.addEventListener("change", densityChanged, {once:true});
  }
  function densityChanged() { resize(); watchPixelDensity(); }
  watchPixelDensity();
  repaintMuseumCopy = function () {
    translatedTextures.forEach(repaint => repaint());
    hallDisplays.refreshCopy();
    updateMouseLookCopy();
    resize(true);
  };
  updateMouseLookCopy();
  requestRender();
}
