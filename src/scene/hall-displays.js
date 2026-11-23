import * as THREE from "../../vendor/three/three.module.min.js";
import { galleryFurnitureLayout } from "../museum/layout.js";

export function createHallDisplays({ scene, stage, textures, materials, canvasTexture, t, contactMaterial = null, rugThickness = 0, openStudy }) {
  const root = new THREE.Group();
  scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  function add(parent, geometry, material, x, y, z, width, height, depth = 1) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const paper = new THREE.MeshStandardMaterial({ color: "#eee8db", roughness: .95 });
  const bookTable = new THREE.Group();
  bookTable.name = "RanWorld book table";
  root.add(bookTable);
  const top = add(bookTable, box, materials.wood, 0, .76, 0, 1.15, .08, 1.15);
  top.name = "RanWorld table top";
  for (const x of [-.46, .46]) for (const z of [-.46, .46]) {
    add(bookTable, box, materials.wood, x, .36, z, .08, .72, .08);
  }
  const book = new THREE.Group();
  book.name = "RanWorld book";
  book.position.y = .8 + .0275;
  book.rotation.y = -.22;
  bookTable.add(book);
  const cover = new THREE.MeshStandardMaterial({ color: "#722f37", roughness: .82 });
  const lettering = new THREE.MeshStandardMaterial({ color: "#d7ccb5", roughness: .95 });
  add(book, box, cover, 0, 0, 0, .62, .055, .84);
  add(book, box, paper, 0, .04, 0, .58, .025, .79);
  add(book, box, cover, 0, .0615, 0, .62, .018, .84);
  for (let i = 0; i < 3; i++) add(book, box, lettering,
    -.09, .0715, -.19 + i * .065, .3 - i * .05, .002, .013);
  const vitrine = new THREE.Group();
  vitrine.name = "Museum development vitrine";
  vitrine.rotation.y = Math.PI / 2;
  const vitrineScale = 1.5, vitrineLength = 4.35, vitrineWidth = 2.25;
  vitrine.scale.set(vitrineScale, 1, vitrineScale);
  root.add(vitrine);
  for (const x of [-1.65, 1.65]) {
    for (const z of [-.7, .7]) {
      const post = add(vitrine, box, materials.metal, x, .635, z, .09, 1.21, .09);
      post.name = "Vitrine support post";
      const foot = add(vitrine, new THREE.CylinderGeometry(.045, .055, .03, 20),
        materials.metal, x, .015, z, 1, 1, 1);
      foot.name = "Vitrine adjustable foot";
    }
  }
  const displayTop = add(vitrine, box, materials.wood, 0, 1.23, 0, vitrineLength, .22, vitrineWidth);
  displayTop.name = "Museum development vitrine top";
  add(vitrine, box, paper, 0, 1.36, 0, 4.08, .045, 1.98);
  const studies = [
    { source: "assets/museum-creation/2026_10_24.jpg", width: 1265, height: 865, caption: "24.10.2026" },
    { source: "assets/museum-creation/2026_11_08.jpg", width: 906, height: 812, caption: "08.11.2026" },
    { source: "assets/museum-creation/mockup01.jpg", width: 1536, height: 1024, caption: "copy.museum-concept-one" },
    { source: "assets/museum-creation/mockup02.jpg", width: 1536, height: 1024, caption: "copy.museum-concept-two" },
    { source: "assets/museum-creation/2026_11_09.jpg", width: 906, height: 812, caption: "09.11.2026" },
    { source: "assets/museum-creation/2026_11_14.jpg", width: 1280, height: 720, caption: "14.11.2026" },
    { source: "assets/museum-creation/2026_11_17.jpg", width: 1440, height: 900, caption: "17.11.2026" }
  ];
  const studyCards = studies.map((study, index) => {
    const x = index < 4 ? (index - 1.5) * .98 : (index - 5) * .98;
    const z = index < 4 ? -.47 : .47;
    const width = Math.min(.9, .61 * study.width / study.height);
    const height = width * study.height / study.width;
    const card = add(vitrine, plane,
      new THREE.MeshBasicMaterial({ map: textures.get(study.source) || null, transparent: true, alphaTest: .05, toneMapped: false }),
      x, 1.393, z, width, height);
    card.rotation.x = -Math.PI / 2;
    card.castShadow = false;
    const caption = canvasTexture((context, w, h) => {
      context.clearRect(0, 0, w, h);
      context.fillStyle = "#342d25";
      context.font = "28px Arial";
      context.textAlign = "center";
      context.fillText(study.caption.startsWith("copy.") ? t(study.caption) : study.caption, w / 2, 45);
    }, 512, 64, true);
    const captionMesh = add(vitrine, plane, new THREE.MeshBasicMaterial({ map: caption, transparent: true, toneMapped: false }),
      x, 1.395, z + .37, .88, .11);
    captionMesh.rotation.x = -Math.PI / 2;
    captionMesh.castShadow = false;
    return card;
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#d9e6e1", transparent: true, opacity: .13,
    roughness: .14, metalness: .05, depthWrite: false
  });
  for (const z of [-1, 1]) add(vitrine, box, glass, 0, 1.56, z, 4.08, .4, .025).castShadow = false;
  for (const x of [-2.04, 2.04]) add(vitrine, box, glass, x, 1.56, 0, .025, .4, 2.02).castShadow = false;
  add(vitrine, box, glass, 0, 1.77, 0, 4.1, .028, 2.04).castShadow = false;
  for (const y of [1.39, 1.74]) {
    for (const z of [-1.008, 1.008]) {
      const rail = add(vitrine, box, materials.metal, 0, y, z, 4.12, .04, .045);
      rail.name = "Vitrine glass frame rail";
    }
    for (const x of [-2.06, 2.06]) {
      const rail = add(vitrine, box, materials.metal, x, y, 0, .045, .04, 2.016);
      rail.name = "Vitrine glass frame rail";
    }
  }
  for (const x of [-2.05, 2.05]) {
    for (const z of [-1.02, 1.02]) add(vitrine, box, materials.metal, x, 1.56, z, .035, .43, .035);
  }
  const labelMap = canvasTexture((context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f4efdf";
    context.font = "30px Arial";
    context.fillText(t("copy.museum-development"), 18, 45);
  }, 512, 64, true);
  add(vitrine, plane, new THREE.MeshBasicMaterial({ map: labelMap, transparent: true, toneMapped: false }),
    0, 1.23, 1.132, 2.65 / vitrineScale, .33).castShadow = false;
  const studyHit = add(vitrine, plane, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    0, 1.8, 0, 4.1, 2.04);
  studyHit.rotation.x = -Math.PI / 2;
  studyHit.userData.project = "museum-creation";
  studyHit.castShadow = studyHit.receiveShadow = false;
  // Hidden materials retain raycasting, without an invisible draw or opaque shadow.
  studyHit.material.visible = false;
  if (contactMaterial) {
    for (const [group, width, depth] of [[bookTable, 1.6, 1.6], [vitrine, 5, 3]]) {
      const contact = add(group, plane, contactMaterial, 0, .008, 0, width, depth);
      contact.rotation.x = -Math.PI / 2; contact.castShadow = contact.receiveShadow = false;
    }
  }
  const entries = [
    { hit: studyHit, sources: studies.map(study => study.source), name: t("copy.museum-development"), open: openStudy }
  ];
  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hall-display-hit";
    button.setAttribute("aria-label", entry.name);
    button.addEventListener("click", () => entry.open(button));
    stage.append(button);
    entry.button = button;
    entry.hit.userData.label = button;
  }
  return {
    entries,
    refreshCopy() {
      entries[0].name = t("copy.museum-development");
      entries[0].button.setAttribute("aria-label", entries[0].name);
    },
    refreshImages() {
      studyCards.forEach((card, index) => {
        const map = textures.get(studies[index].source);
        if (map && card.material.map !== map) {
          card.material.map = map;
          card.material.needsUpdate = true;
        }
      });
    },
    obstacles: [{ center: bookTable.position, radius: .85 }, {
      center: vitrine.position,
      radius: Math.hypot(vitrineLength, vitrineWidth) * vitrineScale / 2,
      halfWidth: vitrineWidth * vitrineScale / 2,
      halfDepth: vitrineLength * vitrineScale / 2
    }],
    occluders: root.children.flatMap(group => group.children.filter(child => child.isMesh && !child.material.transparent)),
    placeExhibits(bay, ranworldZ) {
      bookTable.position.set(-bay * 1.2 + 1.25, 0, ranworldZ);
    },
    update(bay, active, onRug = false) {
      root.visible = active;
      const layout = galleryFurnitureLayout(bay);
      const floorOffset = onRug ? rugThickness : 0;
      vitrine.position.set(layout.vitrine.x, floorOffset, layout.vitrine.z);
    }
  };
}
