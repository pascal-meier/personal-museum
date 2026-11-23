import { batchPlantMeshes } from "./plants/plant-batching.js";
import { connectPlantStructure } from "./plants/plant-structure.js";
import { createPinkCalathea } from "./plants/pink-calathea.js";
import { createGoldenCypress } from "./plants/golden-cypress.js";
import { createAtlasCedar } from "./plants/atlas-cedar.js";
import * as THREE from "../../vendor/three/three.module.min.js";
import { seededRandom } from "./seeded-random.js";
import { createWalnutTextures, createOakTextures } from "./wood-materials.js";
import { galleryFurnitureLayout } from "../museum/layout.js";

export const WALNUT_DADO_RAIL_HEIGHT = .035;
export const WALNUT_DADO_RAIL_TOP = 1.42 + WALNUT_DADO_RAIL_HEIGHT / 2;
const walnutDadoRailCenter = WALNUT_DADO_RAIL_TOP - WALNUT_DADO_RAIL_HEIGHT / 2;

export function roundedBoxGeometry(width, height, depth, radius, bevel) {
  const shapeWidth = width - bevel * 2, shapeDepth = depth - bevel * 2;
  const corner = Math.min(radius - bevel, shapeWidth / 2, shapeDepth / 2);
  const shape = new THREE.Shape();
  shape.moveTo(-shapeWidth / 2 + corner, -shapeDepth / 2);
  shape.lineTo(shapeWidth / 2 - corner, -shapeDepth / 2);
  shape.quadraticCurveTo(shapeWidth / 2, -shapeDepth / 2, shapeWidth / 2, -shapeDepth / 2 + corner);
  shape.lineTo(shapeWidth / 2, shapeDepth / 2 - corner);
  shape.quadraticCurveTo(shapeWidth / 2, shapeDepth / 2, shapeWidth / 2 - corner, shapeDepth / 2);
  shape.lineTo(-shapeWidth / 2 + corner, shapeDepth / 2);
  shape.quadraticCurveTo(-shapeWidth / 2, shapeDepth / 2, -shapeWidth / 2, shapeDepth / 2 - corner);
  shape.lineTo(-shapeWidth / 2, -shapeDepth / 2 + corner);
  shape.quadraticCurveTo(-shapeWidth / 2, -shapeDepth / 2, -shapeWidth / 2 + corner, -shapeDepth / 2);
  const innerHeight = height - bevel * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: innerHeight, steps: 1, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6
  });
  geometry.translate(0, 0, -innerHeight / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export const HALL_RUG_THICKNESS = .024;

// Shared, deterministic materials and furnishings for the continuous exhibition hall.
export function createHallAtmosphere(scene, renderer, contactMaterial = null, quality = null) {
  const random = seededRandom(719);
  function texture(kind) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d");
    c.fillStyle = kind === "wood" ? "#b29976" : "#e5e0d4";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      c.fillStyle = `rgba(${random() > .5 ? "255,252,243" : "89,79,62"},${random() * .045})`;
      c.fillRect(random() * 512, random() * 512, kind === "wood" ? 30 + random() * 160 : 1 + random() * 4, .5 + random() * 2);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  // Four-by-four atlas: restrained limestone variation, with independent relief
  // and roughness. Colour veins must not turn into raised ridges in grazing light.
  function limestoneMaps() {
    const random = seededRandom(173);
    const size = 1024, tile = size / 4;
    const canvases = Array.from({ length: 3 }, () => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = size; return canvas;
    });
    const [colour, height, rough] = canvases.map(canvas => canvas.getContext("2d"));
    colour.fillStyle = "#bdb5a5"; colour.fillRect(0, 0, size, size);
    height.fillStyle = "#555555"; height.fillRect(0, 0, size, size);
    rough.fillStyle = "#e6e6e6"; rough.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      const x = column * tile, y = row * tile, variation = Math.round((random() - .5) * 10);
      colour.save(); colour.beginPath(); colour.rect(x + 1, y + 1, tile - 2, tile - 2); colour.clip();
      colour.fillStyle = 'rgb(' + (216 + variation) + ',' + (205 + variation) + ',' + (185 + variation) + ')';
      colour.fillRect(x, y, tile, tile);
      for (let i = 0; i < 14; i++) {
        const cx = x + random() * tile, cy = y + random() * tile, radius = tile * (.12 + random() * .5);
        const cloud = colour.createRadialGradient(cx, cy, 0, cx, cy, radius);
        cloud.addColorStop(0, i % 2 ? "#8e80610a" : "#fff9e512"); cloud.addColorStop(1, "#ffffff00");
        colour.fillStyle = cloud; colour.fillRect(x, y, tile, tile);
      }
      for (let i = 0; i < 9; i++) {
        const startX = x + random() * tile, startY = y + random() * tile;
        colour.strokeStyle = i % 3 ? "#8a7c640e" : "#fdf8e633"; colour.lineWidth = .5 + random() * 1.4;
        colour.beginPath(); colour.moveTo(startX - 90, startY - 40);
        colour.bezierCurveTo(startX - 25, startY + 30, startX + 35, startY - 25, startX + 120, startY + 60); colour.stroke();
      }
      for (let i = 0; i < 900; i++) {
        colour.fillStyle = i % 2 ? "#6b5d4610" : "#fffbed25";
        colour.fillRect(x + random() * tile, y + random() * tile, .5 + random(), .5 + random());
      }
      colour.restore();
      // Sub-millimetre edge chamfer and a narrow recessed grout joint.
      height.fillStyle = "#aaaaaa"; height.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      height.fillStyle = "#dddddd"; height.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      const finish = Math.round(192 + random() * 12);
      rough.fillStyle = 'rgb(' + finish + ',' + finish + ',' + finish + ')';
      rough.fillRect(x + 1, y + 1, tile - 2, tile - 2);
    }
    return canvases.map((canvas, index) => {
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); return map;
    });
  }
  const stone = limestoneMaps();
  const walnut = createWalnutTextures(renderer);
  const timberFloor = walnut.floor.clone();
  const oak = createOakTextures(renderer), oakFloor = oak.floor.clone();
  const longVeneer = walnut.veneer.clone(), backVeneer = walnut.veneer.clone();
  const terrazzoCanvas = document.createElement("canvas"); terrazzoCanvas.width = terrazzoCanvas.height = 512;
  const terrazzoContext = terrazzoCanvas.getContext("2d");
  terrazzoContext.fillStyle = "#d4d3cf"; terrazzoContext.fillRect(0, 0, 512, 512);
  const terrazzoRandom = seededRandom(9241);
  const terrazzoChips = ["#b8b9b6", "#ece9e1", "#c5c1b8", "#a9afb0", "#d9cec1"];
  for (let i = 0; i < 1450; i++) {
    terrazzoContext.fillStyle = terrazzoChips[i % terrazzoChips.length];
    terrazzoContext.beginPath();
    terrazzoContext.ellipse(terrazzoRandom() * 512, terrazzoRandom() * 512,
      .6 + terrazzoRandom() * 2.2, .5 + terrazzoRandom() * 1.4, terrazzoRandom() * Math.PI, 0, Math.PI * 2);
    terrazzoContext.fill();
  }
  const terrazzo = new THREE.CanvasTexture(terrazzoCanvas);
  terrazzo.colorSpace = THREE.SRGBColorSpace;
  terrazzo.wrapS = terrazzo.wrapT = THREE.RepeatWrapping;
  terrazzo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const concreteCanvas = document.createElement("canvas"); concreteCanvas.width = concreteCanvas.height = 512;
  const concreteContext = concreteCanvas.getContext("2d");
  concreteContext.fillStyle = "#cfcec9"; concreteContext.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const shade = Math.round(118 + terrazzoRandom() * 120);
    concreteContext.fillStyle = `rgba(${shade},${shade},${shade - 3},.09)`;
    concreteContext.fillRect(terrazzoRandom() * 512, terrazzoRandom() * 512, 1 + terrazzoRandom() * 3, 1 + terrazzoRandom() * 2);
  }
  const concreteMap = new THREE.CanvasTexture(concreteCanvas);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.anisotropy = terrazzo.anisotropy;
  const sciFiFloorCanvas = document.createElement("canvas"); sciFiFloorCanvas.width = sciFiFloorCanvas.height = 512;
  const sciFiFloorContext = sciFiFloorCanvas.getContext("2d");
  const floorSheen = sciFiFloorContext.createLinearGradient(0, 0, 0, 512);
  floorSheen.addColorStop(0, "#d5dde1"); floorSheen.addColorStop(.48, "#c3cdd2"); floorSheen.addColorStop(1, "#ced7dc");
  sciFiFloorContext.fillStyle = floorSheen; sciFiFloorContext.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const x = (i * 73 + 19) % 512, y = (i * 137 + 31) % 512;
    sciFiFloorContext.fillStyle = i % 3 ? "rgba(255,255,255,.025)" : "rgba(67,82,94,.018)";
    sciFiFloorContext.fillRect(x, y, 2 + i * 29 % 72, 1);
  }
  const sciFiFloorMap = new THREE.CanvasTexture(sciFiFloorCanvas);
  sciFiFloorMap.colorSpace = THREE.SRGBColorSpace;
  sciFiFloorMap.wrapS = sciFiFloorMap.wrapT = THREE.RepeatWrapping;
  sciFiFloorMap.anisotropy = terrazzo.anisotropy;
  const sciFiWallCanvas = document.createElement("canvas"); sciFiWallCanvas.width = sciFiWallCanvas.height = 512;
  const sciFiWallContext = sciFiWallCanvas.getContext("2d");
  const wallSheen = sciFiWallContext.createLinearGradient(0, 0, 512, 0);
  wallSheen.addColorStop(0, "#c0cbd1"); wallSheen.addColorStop(.32, "#e9eef0");
  wallSheen.addColorStop(.68, "#d2dbe0"); wallSheen.addColorStop(1, "#b8c5cc");
  sciFiWallContext.fillStyle = wallSheen; sciFiWallContext.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = (i * 73 + 19) % 512, y = (i * 137 + 31) % 512;
    sciFiWallContext.fillStyle = i % 3 ? "rgba(255,255,255,.02)" : "rgba(49,67,79,.014)";
    sciFiWallContext.fillRect(x, y, 2 + i * 17 % 42, 1);
  }
  const sciFiWallMap = new THREE.CanvasTexture(sciFiWallCanvas);
  sciFiWallMap.colorSpace = THREE.SRGBColorSpace;
  sciFiWallMap.wrapS = sciFiWallMap.wrapT = THREE.RepeatWrapping;
  sciFiWallMap.anisotropy = terrazzo.anisotropy;
  const plaster = texture("plaster"), grain = texture("wood");
  plaster.repeat.set(3, 2); grain.repeat.set(2, 1);
  const ceilingPanelCanvas = document.createElement("canvas");
  ceilingPanelCanvas.width = ceilingPanelCanvas.height = 512;
  const ceilingPanelContext = ceilingPanelCanvas.getContext("2d");
  ceilingPanelContext.fillStyle = "#ffffff";
  ceilingPanelContext.fillRect(0, 0, 512, 512);
  ceilingPanelContext.strokeStyle = "rgba(100,91,76,.22)";
  ceilingPanelContext.lineWidth = 1.5;
  ceilingPanelContext.strokeRect(.75, .75, 510.5, 510.5);
  ceilingPanelContext.strokeStyle = "rgba(255,255,255,.55)";
  ceilingPanelContext.strokeRect(3, 3, 506, 506);
  ceilingPanelContext.fillStyle = "rgba(111,107,99,.13)";
  for (let y = 8; y < 512; y += 16) for (let x = 8; x < 512; x += 16) {
    ceilingPanelContext.fillRect(x, y, 1, 1);
  }
  const ceilingPanelMap = new THREE.CanvasTexture(ceilingPanelCanvas);
  ceilingPanelMap.colorSpace = THREE.SRGBColorSpace;
  ceilingPanelMap.wrapS = ceilingPanelMap.wrapT = THREE.RepeatWrapping;
  ceilingPanelMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, ...extras });
  const plasterIn = color => material(color, { bumpMap: plaster, bumpScale: .005, roughness: .96 });
  const galleryPlaster = plasterIn("#ead8c1");
  const concreteFinish = material("#ffffff", { map: concreteMap, roughness: .94 });
  const sciFiWallFinish = material("#ffffff", { map: sciFiWallMap, roughness: .34, metalness: .36 });
  const walls = { games: plasterIn("#dfb49d"), photos: plasterIn("#edd9c5"), web: plasterIn("#b8c9be") };
  const photoWallFinish = walls.photos;
  const floor = material("#ffffff", { map: stone[0], bumpMap: stone[1], bumpScale: .014, roughnessMap: stone[2], roughness: .74 });
  const wood = material("#ffffff", { map: grain, roughness: .68 });
  const plasterFinish = galleryPlaster;
  const ceiling = material("#f9f3e7", { map: ceilingPanelMap, bumpMap: plaster, bumpScale: .004, roughness: .94 });
  const structure = wood.clone();
  const structureMap = structure.map;
  const trim = material("#b49b7e");
  const metal = material("#405d57", { roughness: .58, metalness: .22 });
  const column = plasterIn("#cd917a");
  const panelling = material("#ffffff", { map: longVeneer, roughness: .62 });
  const backPanelling = material("#ffffff", { map: backVeneer, roughness: .62 });
  const brass = material("#ac8d56", { metalness: .65, roughness: .44 });
  let currentDesign = "atelier";
  const details = new THREE.Group(); scene.add(details);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const contactPlane = new THREE.PlaneGeometry(1, 1);
  function add(parent, geometry, finish, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geometry, finish); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  // Low-pile wool, physical clearance above stone, shared static texture.
  const weaveCanvas = document.createElement("canvas"); weaveCanvas.width = weaveCanvas.height = 512;
  const weave = weaveCanvas.getContext("2d");
  weave.fillStyle = "#c6b79e"; weave.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 4) {
    weave.fillStyle = "#e0d4bd55"; weave.fillRect(i, 0, 1, 512);
    weave.fillStyle = "#83766225"; weave.fillRect(0, i, 512, 1);
  }
  weave.strokeStyle = "#9e907a"; weave.lineWidth = 2; weave.strokeRect(18, 18, 476, 476);
  const weaveMap = new THREE.CanvasTexture(weaveCanvas); weaveMap.colorSpace = THREE.SRGBColorSpace;
  weaveMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const wool = material("#ffffff", { map: weaveMap, roughness: 1 });
  const textiles = ["#bc715c", "#487b78"].map(color => material(color, {
    map: weaveMap, bumpMap: weaveMap, bumpScale: .008, roughness: 1
  }));
  const loungeBaseGeometry = roundedBoxGeometry(4.8, .18, 1.2, .06, .02);
  const loungeCushionGeometry = roundedBoxGeometry(1.48, .20, 1.08, .12, .035);
  const tableTopGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0, -.06), new THREE.Vector2(.75, -.06),
    new THREE.Vector2(.79, -.045), new THREE.Vector2(.8, .025),
    new THREE.Vector2(.77, .06), new THREE.Vector2(0, .06)
  ], 48);
  const carpets = Array.from({ length: 4 }, (_, i) => {
    const rug = add(details, box, wool.clone(), 0, HALL_RUG_THICKNESS / 2, 0, 1, HALL_RUG_THICKNESS, 1);
    rug.name = "Wool seating rug " + (i + 2); rug.castShadow = false;
    return rug;
  });
  const atelierRugs = carpets.map(rug => rug.material.map);
  const walnutRugs = carpets.map((_, index) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d");
    c.fillStyle = index % 2 ? "#a8a895" : "#c8bb9e"; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = "#747967"; c.lineWidth = 3; c.strokeRect(22, 22, 468, 468);
    c.strokeStyle = "#e6d7b7"; c.lineWidth = 2; c.strokeRect(30, 30, 452, 452);
    c.globalAlpha = .18; c.drawImage(weaveCanvas, 0, 0); c.globalAlpha = 1;
    for (let n = 0; n < 512; n += 3) {
      c.fillStyle = "#fff7df18"; c.fillRect(n, 0, 1, 512);
      c.fillStyle = "#493c2b18"; c.fillRect(0, n, 512, 1);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = weaveMap.anisotropy; return map;
  });
  const lounges = [-1, 1].map((side, index) => {
    const group = new THREE.Group(); group.name = "Gallery seating island " + side; details.add(group);
    const furniture = [];
    const piece = (geometry, finish, x, y, z, sx, sy, sz) => {
      const part = add(group, geometry, finish, x, y, z, sx, sy, sz); furniture.push(part); return part;
    };
    piece(loungeBaseGeometry, wood, 0, .18, 0, 1, 1, 1);
    for (const x of [-1.5, 0, 1.5]) {
      const cushion = piece(loungeCushionGeometry, textiles[index], x, .37, 0, 1, 1, 1);
      cushion.name = "Lounge seat cushion";
    }
    for (const x of [-1.85, 1.85]) piece(box, wood, x, .12, 0, .14, .24, .82);
    // A low round oak table sits within the rug, beside the bench.
    piece(tableTopGeometry, wood, side * 3.6, .67, 0, 1, 1, 1);
    piece(new THREE.CylinderGeometry(.21, .29, .6, 24), wood, side * 3.6, .3, 0, 1, 1, 1);
    if (contactMaterial) {
      for (const [x, z, width, depth] of [
        [-1.85, 0, .42, 1.1], [1.85, 0, .42, 1.1], [side * 3.6, 0, .7, .7]
      ]) {
        const contact = new THREE.Mesh(contactPlane, contactMaterial);
        contact.name = "Lounge furniture contact shadow";
        contact.position.set(x, .006, z);
        contact.rotation.x = -Math.PI / 2;
        contact.scale.set(width, depth, 1);
        contact.castShadow = contact.receiveShadow = false;
        group.add(contact);
      }
    }
    return { group, side, furniture };
  });
  const loungeObstacles = lounges.flatMap(({ group }) => [
    { center: group.position, radius: 2.65 },
    { center: new THREE.Vector3(), radius: .95 }
  ]);
  // Continuous solid walls meet the floor at y=0. Exhibition groups carry
  // artwork only; their old individual wall planes must not overlap this shell.
  const shellLeft = add(details, box, walls.games, 0, 0, 0, 1, 1, 1);
  const shellRight = add(details, box, walls.web, 0, 0, 0, 1, 1, 1);
  const shellBack = add(details, box, walls.photos, 0, 0, 0, 1, 1, 1);
  shellLeft.name = "Continuous left wall";
  shellRight.name = "Continuous right wall";
  shellBack.name = "Continuous back wall";
  const skirtings = ["Left", "Right", "Back"].map(side => {
    const rail = add(details, box, trim, 0, .09, 0, 1, .18, .05);
    rail.name = side + " continuous skirting"; return rail;
  });
  const sciFiDetails = new THREE.Group(); sciFiDetails.name = "Sci-Fi architectural lighting"; details.add(sciFiDetails);
  sciFiDetails.visible = false;
  const sciFiCyan = new THREE.MeshBasicMaterial({ color: "#31d9f2", toneMapped: false });
  const sciFiHighlight = new THREE.MeshBasicMaterial({ color: "#b9edf2", toneMapped: false });
  const sciFiLightBars = Array.from({ length: 5 }, (_, i) => {
    const bar = add(sciFiDetails, box, i < 3 ? sciFiCyan : sciFiHighlight, 0, 0, 0, 1, 1, 1);
    bar.castShadow = bar.receiveShadow = false;
    return bar;
  });
  // Six narrow oak reveals flank the doorway, outside every artwork hanging area.
  const japaneseSlats = new THREE.Group(); japaneseSlats.name = "Japanese oak entrance slats";
  details.add(japaneseSlats); japaneseSlats.visible = false;
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const slat = add(japaneseSlats, box, wood, side * (2.18 + i * .11), 3.8, 0, .055, 7.6, .07);
    slat.name = "Oak doorway reveal";
  }
  const woodwork = new THREE.Group(); woodwork.name = "Walnut wall panelling"; details.add(woodwork);
  woodwork.visible = false;
  const wallPanels = [panelling, panelling, backPanelling].map(finish => add(woodwork, box, finish, 0, .7, 0, 1, 1.4, 1));
  const dadoRails = wallPanels.map((_, index) => {
    const rail = add(woodwork, box, brass, 0, walnutDadoRailCenter, 0, 1, WALNUT_DADO_RAIL_HEIGHT, 1);
    rail.name = "Walnut dado rail " + (index + 1);
    return rail;
  });
  // Finish the fourth side of the hall with a real doorway and recessed doors.
  const entrance = new THREE.Group(); entrance.name = "Museum entrance wall"; details.add(entrance);
  const entranceWings = [-1, 1].map(() => add(entrance, box, plasterFinish, 0, 0, 0, 1, 1, 1));
  const entranceLintel = add(entrance, box, plasterFinish, 0, 7.5, .15, 1, 1, .3);
  const entranceSkirting = [-1, 1].map(() => add(entrance, box, trim, 0, .1, -.025, 1, .2, .05));
  const entrancePanels = [-1, 1].map(() => add(woodwork, box, backPanelling, 0, .7, 0, 1, 1.4, .06));
  const entranceDados = entrancePanels.map(() => add(woodwork, box, brass, 0, 1.42, 0, 1, .035, .075));
  const doorFinish = wood.clone();
  const walnutDoor = walnut.furniture.clone();
  walnutDoor.center.set(.5, .5); walnutDoor.rotation = Math.PI / 2;
  const flushDoorFinish = material("#fff4e3", { roughness: .92 });
  const grooveFinish = material("#b9ab91", { roughness: .94 });
  const doorGrain = grain.clone(); doorGrain.center.set(.5, .5); doorGrain.rotation = Math.PI / 2;
  doorGrain.needsUpdate = true; doorFinish.map = doorGrain;
  const entranceDoorLeaves = [], entranceDoorTrim = [], entranceDoorGrooves = [];
  // The wall opening is 4.2 wide and 5.6 tall. No overlapping wall plane sits behind it.
  for (const side of [-1, 1]) {
    entranceDoorTrim.push(add(entrance, box, wood, side * 2.05, 2.8, .24, .10, 5.6, .52));
    const door = add(entrance, box, doorFinish, side * 1.015, 2.76, .48, 1.99, 5.48, .10);
    door.name = "Entrance door panel";
    entranceDoorLeaves.push(door);
    entranceDoorTrim.push(add(entrance, box, wood, side * .035, 2.76, .405, .05, 5.48, .045));
    entranceDoorTrim.push(add(entrance, box, metal, side * .19, 2.25, .345, .035, .65, .06));
    const groove = add(entrance, box, grooveFinish, side * .43, 1.05, .203, .028, .70, .008);
    groove.name = "Recessed door pull";
    groove.visible = false;
    entranceDoorGrooves.push(groove);
  }
  entranceDoorTrim.push(add(entrance, box, wood, 0, 5.55, .24, 4.2, .1, .52));
  entranceDoorTrim.push(add(entrance, box, metal, 0, .015, .25, 4.2, .03, .55));
  // A nearly flush entrance insert: 4 mm above the floor avoids coplanar flicker.
  const matCanvas = document.createElement("canvas"); matCanvas.width = matCanvas.height = 256;
  const matContext = matCanvas.getContext("2d");
  matContext.fillStyle = "#424640"; matContext.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    matContext.fillStyle = "#30352f"; matContext.fillRect(0, y, 256, 2);
    matContext.fillStyle = "#51554c"; matContext.fillRect(0, y + 2, 256, 1);
  }
  const matMap = new THREE.CanvasTexture(matCanvas); matMap.colorSpace = THREE.SRGBColorSpace;
  matMap.wrapS = matMap.wrapT = THREE.RepeatWrapping; matMap.repeat.set(1, 3);
  matMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const entranceMat = add(details, new THREE.PlaneGeometry(1, 1), material("#ffffff", { map: matMap, roughness: 1 }),
    0, .004, 0, 3.7, 2.3, 1);
  entranceMat.name = "Flush entrance mat"; entranceMat.rotation.x = -Math.PI / 2; entranceMat.castShadow = false;
  const matEdging = Array.from({ length: 4 }, () => add(details, box, metal, 0, .003, 0, 1, .006, 1));
  const signCanvas = document.createElement("canvas"); signCanvas.width = 1024; signCanvas.height = 256;
  const signContext = signCanvas.getContext("2d");
  signContext.fillStyle = "#313a32"; signContext.textAlign = "center";
  signContext.font = "64px Georgia"; signContext.fillText("Pascal Meier", 512, 108);
  signContext.font = "24px Arial"; signContext.fillText("P O R T F O L I O", 512, 170);
  const signMap = new THREE.CanvasTexture(signCanvas); signMap.colorSpace = THREE.SRGBColorSpace;
  signMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const entranceSign = add(entrance, new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: signMap, transparent: true, depthWrite: false, toneMapped: false }),
    0, 6.75, -.015, 5.4, 1.35, 1);
  entranceSign.rotation.y = Math.PI; entranceSign.castShadow = false;
  const clerestories = [-1, 1].map(side => ({
    side, windows: [], endWindows: [], supports: [], timberRails: [],
    ends: [-1, 1].map(() => add(details, box, plasterFinish, 0, 0, 0, 1, 1, 1)),
    header: add(details, box, plasterFinish, 0, 0, 0, 1, 1, 1)
  }));
  // One continuous sky beyond the clerestory, rather than five repeated panels.
  const skyCanvas = document.createElement("canvas"); skyCanvas.width = 1024; skyCanvas.height = 256;
  const skyContext = skyCanvas.getContext("2d");
  const skyGradient = skyContext.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, "#9ebbd0"); skyGradient.addColorStop(.6, "#d3e1e8"); skyGradient.addColorStop(1, "#eeeee7");
  skyContext.fillStyle = skyGradient; skyContext.fillRect(0, 0, 1024, 256);
  for (const [x, y, radius] of [[170, 80, 180], [650, 120, 240], [950, 65, 130]]) {
    skyContext.save(); skyContext.scale(1, .25);
    const cloud = skyContext.createRadialGradient(x, y * 4, 0, x, y * 4, radius);
    cloud.addColorStop(0, "#ffffff45"); cloud.addColorStop(1, "#ffffff00");
    skyContext.fillStyle = cloud; skyContext.fillRect(0, 0, 1024, 1024); skyContext.restore();
  }
  const distantHaze = skyContext.createLinearGradient(0, 142, 0, 238);
  distantHaze.addColorStop(0, "#dce6e400"); distantHaze.addColorStop(1, "#a9bbb455");
  skyContext.fillStyle = distantHaze; skyContext.fillRect(0, 142, 1024, 114);
  skyContext.fillStyle = "rgba(154,174,163,.42)";
  skyContext.beginPath(); skyContext.moveTo(0, 169);
  skyContext.bezierCurveTo(180, 138, 294, 157, 430, 132);
  skyContext.bezierCurveTo(590, 108, 760, 153, 900, 126);
  skyContext.bezierCurveTo(960, 118, 1000, 132, 1024, 124);
  skyContext.lineTo(1024, 256); skyContext.lineTo(0, 256); skyContext.closePath(); skyContext.fill();
  skyContext.fillStyle = "rgba(171,190,185,.38)";
  skyContext.beginPath(); skyContext.moveTo(0, 205);
  skyContext.bezierCurveTo(150, 178, 250, 192, 390, 168);
  skyContext.bezierCurveTo(540, 148, 650, 187, 800, 166);
  skyContext.bezierCurveTo(900, 154, 965, 177, 1024, 162);
  skyContext.lineTo(1024, 256); skyContext.lineTo(0, 256); skyContext.closePath(); skyContext.fill();
  skyContext.fillStyle = "rgba(132,153,143,.28)";
  skyContext.beginPath(); skyContext.moveTo(0, 220);
  for (const [x, y] of [[74, 199], [142, 214], [218, 183], [292, 210], [366, 193],
    [438, 215], [514, 182], [592, 207], [666, 190], [738, 214], [812, 181],
    [884, 207], [954, 188], [1024, 210]]) skyContext.lineTo(x, y);
  skyContext.lineTo(1024, 256); skyContext.lineTo(0, 256); skyContext.closePath(); skyContext.fill();
  skyContext.fillStyle = "rgba(103,128,112,.58)";
  skyContext.beginPath(); skyContext.moveTo(0, 226);
  skyContext.lineTo(55, 153); skyContext.lineTo(88, 190); skyContext.lineTo(125, 138);
  skyContext.lineTo(168, 183); skyContext.lineTo(213, 150); skyContext.lineTo(248, 192);
  skyContext.lineTo(296, 131); skyContext.lineTo(340, 184); skyContext.lineTo(390, 153);
  skyContext.lineTo(438, 198); skyContext.lineTo(492, 132); skyContext.lineTo(544, 182);
  skyContext.lineTo(596, 146); skyContext.lineTo(644, 190); skyContext.lineTo(700, 128);
  skyContext.lineTo(748, 180); skyContext.lineTo(795, 149); skyContext.lineTo(840, 194);
  skyContext.lineTo(890, 131); skyContext.lineTo(934, 181); skyContext.lineTo(980, 143);
  skyContext.lineTo(1024, 174); skyContext.lineTo(1024, 256); skyContext.lineTo(0, 256);
  skyContext.closePath(); skyContext.fill();
  const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.MeshBasicMaterial({ map: skyMap, toneMapped: false });
  const clerestoryGlass = new THREE.MeshPhysicalMaterial({
    color: "#dce8e7", transparent: true, opacity: .09,
    roughness: .12, metalness: 0, clearcoat: .65, clearcoatRoughness: .1,
    depthWrite: false, side: THREE.DoubleSide
  });
  const skyPlane = new THREE.PlaneGeometry(1, 1);
  for (const band of clerestories) {
    band.sky = add(details, skyPlane, sky, 0, 0, 0, 1, 1, 1);
    band.sky.name = (band.side < 0 ? "Left" : "Right") + " clerestory exterior sky";
    band.sky.rotation.y = -band.side * Math.PI / 2;
    band.sky.castShadow = band.sky.receiveShadow = false;
    for (let i = 0; i < 9; i++) {
      const group = new THREE.Group(); details.add(group);
      group.name = (band.side < 0 ? "Left" : "Right") + " clerestory window " + (i + 1);
      group.rotation.y = band.side > 0 ? Math.PI : 0;
      const glazing = add(group, skyPlane, clerestoryGlass, .08, 0, 0, 5.1, 1.02, 1);
      glazing.name = "Clerestory glazing";
      glazing.rotation.y = Math.PI / 2;
      glazing.castShadow = glazing.receiveShadow = false;
      // Mirrored reveals and timber frames; the central openings stay unobstructed.
      for (const z of [-2.71, 2.71]) add(group, box, plasterFinish, 0, 0, z, .3, 1.2, .08);
      for (const y of [-.57, .57]) add(group, box, plasterFinish, 0, y, 0, .3, .06, 5.5);
      for (const z of [-2.6, 2.6]) add(group, box, wood, .2, 0, z, .13, 1.05, .07);
      const mullion = add(group, box, wood, .2, 0, 0, .13, 1.05, .08);
      mullion.name = "Clerestory center mullion";
      // Timber stops at the structural pier instead of crossing its face.
      const rails = [];
      for (const y of [-.54, .54]) for (const side of [-1, 1]) {
        const rail = add(group, box, wood, .2, y, 0, .22, .09, 1);
        rail.name = "Clerestory window rail";
        rails.push({ rail, side });
      }
      band.timberRails.push(rails);
      const support = add(details, box, structure, 0, 8.675, 0, .36, 1.25, .32);
      support.name = (band.side < 0 ? "Left" : "Right") + " clerestory support " + (i + 1);
      band.supports.push(support);
      band.windows.push(group);
    }
    for (const end of [-1, 1]) {
      const group = new THREE.Group(); details.add(group);
      group.name = (band.side < 0 ? "Left" : "Right") + " clerestory end window " + (end < 0 ? "back" : "front");
      group.rotation.y = band.side > 0 ? Math.PI : 0;
      const inward = -end * (band.side > 0 ? -1 : 1);
      const glazing = add(group, skyPlane, clerestoryGlass, .08, 0, inward * 1.275, 2.55, 1.02, 1);
      glazing.name = "Clerestory glazing";
      glazing.rotation.y = Math.PI / 2;
      glazing.castShadow = glazing.receiveShadow = false;
      for (const z of [0, inward * 2.71]) add(group, box, plasterFinish, 0, 0, z, .3, 1.2, .08);
      for (const y of [-.57, .57]) add(group, box, plasterFinish, 0, y, inward * 1.375, .3, .06, 2.75);
      for (const z of [0, inward * 2.6]) {
        const jamb = add(group, box, wood, .2, 0, z, .13, 1.05, .07);
        jamb.name = "Clerestory end window jamb";
      }
      for (const y of [-.54, .54]) {
        const rail = add(group, box, wood, .2, y, inward * 1.325, .22, .09, 2.65);
        rail.name = "Clerestory end window rail";
      }
      band.endWindows.push({ group, end });
    }
  }
  // Only opaque architectural surfaces occlude picking; the plants are not walls.
  const occluders = [];
  details.traverse(object => {
    if (object.isMesh && object.material !== sky && !object.material.transparent) occluders.push(object);
  });
  // Leaf surfaces have thickness, varied directions and a restrained range of greens.
  const plant = new THREE.Group(); plant.name = "Green gallery plant"; details.add(plant);
  // Open vessel: the previous closed cap and soil both ended at y=.90,
  // causing coplanar depth fighting that looked like flickering shadows.
  const potFinish = material("#9b8270", { side: THREE.DoubleSide });
  const pot = add(plant, new THREE.CylinderGeometry(.58, .44, .9, 48, 1, true), potFinish, 0, .45, 0, 1, 1, 1);
  pot.name = "Open plant pot";
  const rim = add(plant, new THREE.TorusGeometry(.58, .022, 8, 48), potFinish, 0, .9, 0, 1, 1, 1);
  rim.rotation.x = Math.PI / 2;
  const soil = add(plant, new THREE.CylinderGeometry(.56, .56, .04, 48), material("#51483a"), 0, .83, 0, 1, 1, 1);
  soil.name = "Recessed soil";
  const leafGeometry = new THREE.SphereGeometry(1, 12, 8);
  const greens = [material("#536348"), material("#687654"), material("#788362")];
  for (let i = 0; i < 36; i++) {
    const angle = i * 2.399, r = .3 + random() * .55, y = 1.35 + random() * 1.7;
    const leaf = add(plant, leafGeometry, greens[i % 3], Math.cos(angle) * r, y, Math.sin(angle) * r, .34, .045, .16);
    leaf.rotation.set(random() * .8, -angle, (random() - .5) * .8);
  }
  connectPlantStructure(plant);
  const pinkPlant = createPinkCalathea(renderer, plant, quality); pinkPlant.name = "Pink gallery plant"; details.add(pinkPlant);
  const goldenPlant = createGoldenCypress(renderer, quality);
  const cedar = createAtlasCedar(quality);
  const entrancePlants = [goldenPlant, cedar];
  details.add(...entrancePlants);
  const entrancePlantRadii = [1.35, 1.72];
  const entrancePlantObstacles = entrancePlants.map((group, index) => ({ center: group.position, radius: entrancePlantRadii[index] }));
  batchPlantMeshes(plant);
  batchPlantMeshes(pinkPlant);
  entrancePlants.forEach(batchPlantMeshes);
  if (contactMaterial) {
    for (const [parent, span] of [[plant, 1.6], [pinkPlant, 1.9], [goldenPlant, 1.6], [cedar, 1.9]]) {
      const contact = add(parent, contactPlane, contactMaterial, 0, .008 / parent.scale.y, 0, span, span, 1);
      contact.name = "Plant floor contact"; contact.rotation.x = -Math.PI / 2;
      contact.castShadow = contact.receiveShadow = false;
    }
  }
  const sun = new THREE.DirectionalLight("#fff0dc", 3.2); sun.castShadow = true;
  // A fixed world-space shadow frustum stays stable throughout a camera walk.
  const shadowSize = Math.min(quality?.shadowSize ?? 4096, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -.00008; sun.shadow.normalBias = .045; sun.shadow.radius = 2;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
  scene.add(sun, sun.target);
  // Approximate diffuse sky bounce from the clerestory; direct sun remains
  // shadowed by the real envelope. No fake floor pools are enabled.
  const skyFill = new THREE.DirectionalLight("#dce9ff", .4);
  const rightSkyFill = new THREE.DirectionalLight("#dce9ff", .22);
  scene.add(skyFill, skyFill.target, rightSkyFill, rightSkyFill.target);
  occluders.push(...lounges.flatMap(lounge => lounge.furniture));
  return { walls, floor, wood, ceiling, structure, column, trim, metal, textiles, occluders, obstacles: loungeObstacles,
    plantObstacles: entrancePlantObstacles,
    setDesign(design) {
      currentDesign = design;
      const japanese = design === "japanese";
      const walnutDesign = design === "walnut", whiteCube = design === "white-cube", sciFi = design === "sci-fi";
      const palette = japanese ? ["#f1eadb", "#f1eadb", "#f1eadb"] : walnutDesign ? ["#e1d8c7", "#e8dfcf", "#d5dacd"] : ["#dfb49d", "#edd9c5", "#b8c9be"];
      woodwork.visible = walnutDesign;
      japaneseSlats.visible = japanese;
      for (const [wall, color] of [[walls.games, palette[0]], [walls.web, palette[2]]]) {
        wall.color.set(whiteCube ? "#fff4e3" : sciFi ? "#ffffff" : color);
        wall.map = sciFi ? sciFiWallMap : null;
        wall.metalness = sciFi ? .36 : 0;
        wall.roughness = sciFi ? .38 : .96;
        wall.needsUpdate = true;
      }
      photoWallFinish.color.set(palette[1]);
      walls.photos = whiteCube ? concreteFinish : sciFi ? sciFiWallFinish : photoWallFinish;
      shellBack.material = walls.photos;
      floor.map = sciFi ? sciFiFloorMap : whiteCube ? terrazzo : japanese ? oakFloor : walnutDesign ? timberFloor : stone[0];
      floor.bumpMap = whiteCube || sciFi ? null : japanese ? oakFloor : walnutDesign ? timberFloor : stone[1];
      floor.roughnessMap = whiteCube || walnutDesign || sciFi || japanese ? null : stone[2];
      floor.bumpScale = whiteCube || sciFi ? 0 : japanese ? .002 : walnutDesign ? .004 : .014;
      floor.roughness = japanese ? .84 : sciFi ? .38 : whiteCube ? .94 : walnutDesign ? .64 : .74;
      floor.metalness = sciFi ? .32 : 0;
      floor.needsUpdate = true;
      galleryPlaster.color.set(japanese ? "#f1eadb" : whiteCube ? "#fff4e3" : sciFi ? "#c4cfd6" : walnutDesign ? "#e6dece" : "#ead8c1");
      galleryPlaster.bumpScale = whiteCube ? .002 : .005;
      ceiling.color.set(japanese ? "#f6f0e4" : whiteCube ? "#fffaf0" : sciFi ? "#bdc9d0" : "#f9f3e7");
      ceiling.map = sciFi || japanese ? null : ceilingPanelMap;
      ceiling.bumpMap = sciFi ? null : plaster;
      ceiling.bumpScale = sciFi ? 0 : .004;
      ceiling.roughness = sciFi ? .38 : .94;
      ceiling.metalness = sciFi ? .32 : 0;
      ceiling.needsUpdate = true;
      for (const finish of [wood, structure]) {
        finish.map = japanese ? oak.furniture : sciFi ? null : whiteCube ? (finish === structure ? null : grain) : walnutDesign ? walnut.furniture : grain;
        finish.color.set(sciFi ? "#a4b2bc" : whiteCube && finish === wood ? "#ead6b7" : "#ffffff");
        finish.roughness = japanese ? .82 : sciFi ? .36 : walnutDesign ? .52 : .68;
        finish.metalness = sciFi ? .46 : 0;
        finish.needsUpdate = true;
      }
      doorFinish.map = japanese ? oak.furniture : sciFi ? null : walnutDesign ? walnutDoor : doorGrain;
      doorFinish.color.set(sciFi ? "#91a1ac" : "#ffffff");
      doorFinish.metalness = sciFi ? .42 : 0;
      doorFinish.needsUpdate = true;
      column.color.set(japanese ? "#f1eadb" : whiteCube ? "#fff4e3" : sciFi ? "#a9b6bf" : walnutDesign ? "#ffffff" : "#cd917a");
      column.map = walnutDesign ? walnut.veneer : null;
      column.roughness = sciFi ? .38 : walnutDesign ? .62 : .96;
      column.metalness = sciFi ? .38 : 0;
      column.needsUpdate = true;
      trim.color.set(japanese ? "#c7b18c" : whiteCube ? "#fff4e3" : sciFi ? "#718b98" : walnutDesign ? "#73523b" : "#b49b7e");
      trim.roughness = sciFi ? .3 : .9; trim.metalness = sciFi ? .48 : 0;
      metal.color.set(japanese ? "#35463d" : whiteCube ? "#151616" : sciFi ? "#9aaab4" : walnutDesign ? "#87734f" : "#405d57");
      metal.metalness = sciFi ? .62 : walnutDesign ? .55 : .22;
      metal.roughness = sciFi ? .34 : .58;
      textiles.forEach((finish, i) => finish.color.set((japanese ? ["#8c9c81", "#8c9c81"] : sciFi ? ["#95adbb", "#8e9bb8"] : walnutDesign ? ["#405a50", "#b7aa8d"] : ["#bc715c", "#487b78"])[i]));
      carpets.forEach((rug, i) => { rug.material.map = (walnutDesign ? walnutRugs : atelierRugs)[i]; });
      sciFiDetails.visible = sciFi;
      entranceDoorLeaves.forEach(door => {
        door.material = whiteCube ? flushDoorFinish : doorFinish;
        door.position.y = whiteCube ? 4.65 : 2.76;
        door.position.z = whiteCube ? .15 : .48;
        door.scale.y = whiteCube ? 9.3 : 5.48;
      });
      entranceDoorTrim.forEach(part => { part.visible = !whiteCube; });
      entranceDoorGrooves.forEach(part => {
        part.visible = whiteCube;
        part.position.y = whiteCube ? 1.05 : 2.35;
        part.position.z = whiteCube ? .203 : .533;
      });
      entranceSign.visible = !whiteCube;
      entranceMat.visible = !whiteCube && !sciFi && !japanese;
      matEdging.forEach(part => { part.visible = !whiteCube && !sciFi && !japanese; });
      carpets.forEach(rug => { rug.visible = !whiteCube && !sciFi && !japanese; });
      lounges.forEach(({ group }) => { group.visible = !whiteCube && !japanese; });
      loungeObstacles.forEach((obstacle, index) => {
        obstacle.radius = whiteCube || japanese ? 0 : index % 2 ? .95 : 2.65;
      });
      plant.visible = !whiteCube;
      pinkPlant.visible = !whiteCube && !japanese;
      entrancePlants.forEach((group, index) => {
        group.visible = !whiteCube && !japanese;
        entrancePlantObstacles[index].radius = group.visible ? entrancePlantRadii[index] : 0;
      });
      sun.color.set(sciFi ? "#e5f2ff" : "#fff0dc"); sun.intensity = japanese ? .65 : sciFi ? 3.3 : 3.2;
      sun.shadow.radius = japanese ? 5 : 2;
      const skyColor = japanese ? "#fff5e5" : sciFi ? "#d7e8f4" : "#dce9ff";
      skyFill.color.set(skyColor); rightSkyFill.color.set(skyColor);
      skyFill.intensity = japanese ? .8 : sciFi ? .65 : .4; rightSkyFill.intensity = japanese ? .65 : sciFi ? .45 : .22;
    },
    update(bay, active) {
      details.visible = sun.visible = skyFill.visible = rightSkyFill.visible = active;
      if (!active) return;
      // The limestone atlas contains four tiles per axis: 1.8 by 1.2 m slabs.
      stone.forEach(map => {
        map.repeat.set(bay * 2.65 / 7.2, bay * 4.5 / 4.8);
        map.offset.set((1 - map.repeat.x) / 2, (1 - map.repeat.y) / 2);
      });
      [terrazzo, concreteMap].forEach(map => {
        map.repeat.set(bay * 2.65 / 14.4, bay * 4.5 / 9.6);
        map.offset.set((1 - map.repeat.x) / 2, (1 - map.repeat.y) / 2);
      });
      const rear = -bay * 2 - 1.68, front = bay * 2.1;
      const length = front - rear, middle = (front + rear) / 2;
      const furnitureLayout = galleryFurnitureLayout(bay);
      ceilingPanelMap.repeat.set((bay * 2.4 + .6) / 1.2, (length + .6) / 1.2);
      timberFloor.repeat.set(bay * 2.65 / 8.8, bay * 4.5 / 2.4);
      oakFloor.repeat.set(bay * 2.65 / 5.6, bay * 4.5 / 2.4);
      japaneseSlats.position.z = front - .045;
      longVeneer.repeat.set(length / 3.6, 1); backVeneer.repeat.set(bay * 2.4 / 3.6, 1);
      sciFiLightBars[0].position.set(-bay * 1.2 + .02, .24, middle);
      sciFiLightBars[0].scale.set(.025, .035, length);
      sciFiLightBars[1].position.set(bay * 1.2 - .02, .24, middle);
      sciFiLightBars[1].scale.set(.025, .035, length);
      sciFiLightBars[2].position.set(0, .24, rear + .02);
      sciFiLightBars[2].scale.set(bay * 2.35, .035, .025);
      sciFiLightBars[3].position.set(-bay * 1.2 + .02, 7.82, middle);
      sciFiLightBars[3].scale.set(.025, .025, length);
      sciFiLightBars[4].position.set(bay * 1.2 - .02, 7.82, middle);
      sciFiLightBars[4].scale.set(.025, .025, length);
      woodwork.visible = currentDesign === "walnut";
      wallPanels.forEach((panel, i) => {
        if (i < 2) {
          panel.position.set((i ? 1 : -1) * (bay * 1.2 - .035), .7, middle);
          panel.scale.set(.07, 1.4, length);
        } else {
          panel.position.set(0, .7, rear + .035); panel.scale.set(bay * 2.4, 1.4, .07);
        }
        dadoRails[i].position.copy(panel.position); dadoRails[i].position.y = walnutDadoRailCenter;
        dadoRails[i].scale.copy(panel.scale); dadoRails[i].scale.y = WALNUT_DADO_RAIL_HEIGHT;
      });
      carpets[0].position.set(0, HALL_RUG_THICKNESS / 2, rear + 6.4); carpets[0].scale.set(8, HALL_RUG_THICKNESS, 4.6);
      carpets[3].position.set(furnitureLayout.vitrine.x, HALL_RUG_THICKNESS / 2, furnitureLayout.vitrine.z);
      carpets[3].scale.set(9.6, HALL_RUG_THICKNESS, 7.4);
      lounges.forEach(({ group, side }, i) => {
        const rugTop = currentDesign === "white-cube" || currentDesign === "sci-fi" ? 0 : HALL_RUG_THICKNESS;
        group.rotation.y = side * Math.PI / 2;
        group.position.set(side * bay * .8, rugTop, -side * bay * .55);
        const angle = group.rotation.y;
        const rugOffsetX = Math.cos(angle) * side * .95, rugOffsetZ = -Math.sin(angle) * side * .95;
        carpets[i + 1].position.set(group.position.x + rugOffsetX, HALL_RUG_THICKNESS / 2, group.position.z + rugOffsetZ);
        carpets[i + 1].rotation.y = angle;
        carpets[i + 1].scale.set(8, HALL_RUG_THICKNESS, 3.8);
        loungeObstacles[i * 2 + 1].center.set(
          group.position.x + Math.cos(angle) * side * 3.6, 0,
          group.position.z - Math.sin(angle) * side * 3.6
        );
      });
      const endRanges = [[rear, -bay * 2], [bay * 2, front]];
      for (const band of clerestories) {
        const side = band.side;
        band.windows.forEach((group, i) => {
          group.position.set(side * (bay * 1.2 - .05), 8.65, (i - 4) * bay * .4);
          const windowScale = bay * .4 / 5.5;
          group.scale.z = windowScale;
          band.supports[i].position.set(side * (bay * 1.2 - .07), 8.675, (i - 4) * bay * .4);
          const halfPier = .16 / windowScale, railLength = 2.65 - halfPier;
          band.timberRails[i].forEach(({ rail, side: edge }) => {
            rail.position.z = edge * (halfPier + railLength / 2);
            rail.scale.z = railLength;
          });
          band.endWindows.forEach(({ group, end }) => {
            group.position.set(side * (bay * 1.2 - .05), 8.65, end * bay * 2);
            group.scale.z = bay * .4 / 5.5;
          });
        });
        band.sky.position.set(side * (bay * 1.2 + 1.2), 12, middle);
        band.sky.scale.set(length + 16, 24, 1);
        band.ends.forEach((wall, i) => {
          const [start, end] = endRanges[i];
          wall.position.set(side * (bay * 1.2 + .15), 8.675, (start + end) / 2);
          wall.scale.set(.3, 1.25, end - start);
        });
        band.header.position.set(side * (bay * 1.2 + .15), 9.275, middle);
        band.header.scale.set(.3, .05, length);
      }
      entrance.position.set(0, 0, front);
      const matZ = front - 1.8;
      entranceMat.position.z = matZ;
      matEdging.forEach((edge, i) => {
        const across = i < 2, side = i % 2 ? 1 : -1;
        edge.position.set(across ? 0 : side * 1.865, .003, matZ + (across ? side * 1.165 : 0));
        edge.scale.set(across ? 3.76 : .03, .006, across ? .03 : 2.3);
      });
      const wingWidth = bay * 1.2 - 2.1 + .3;
      entranceWings.forEach((wall, index) => {
        const side = index ? 1 : -1;
        wall.position.set(side * (2.1 + wingWidth / 2), 4.65, .15);
        wall.scale.set(wingWidth, 9.3, .3);
        entranceSkirting[index].position.x = side * (2.1 + wingWidth / 2);
        entranceSkirting[index].scale.x = wingWidth;
        entrancePanels[index].position.set(wall.position.x, .7, front - .035);
        entrancePanels[index].scale.x = wingWidth;
        entranceDados[index].position.set(wall.position.x, 1.42, front - .035);
        entranceDados[index].scale.x = wingWidth;
      });
      entranceLintel.position.set(0, 7.45, .15); entranceLintel.scale.set(4.2, 3.7, .3);
      shellLeft.position.set(-bay * 1.2 - .15, 4.025, middle);
      shellLeft.scale.set(.3, 8.05, length);
      shellRight.position.set(bay * 1.2 + .15, 4.025, middle);
      shellRight.scale.set(.3, 8.05, length);
      shellBack.position.set(0, 4.65, rear - .15);
      shellBack.scale.set(bay * 2.4 + .6, 9.3, .3);
      skirtings.forEach((rail, i) => {
        if (i < 2) {
          rail.position.set((i ? 1 : -1) * (bay * 1.2 - .025), .09, middle);
          rail.scale.set(.05, .18, length);
        } else {
          rail.position.set(0, .09, rear + .025);
          rail.scale.set(bay * 2.4 - .1, .18, .05);
        }
      });
      plant.position.set(-bay * 1.2 + 1.3, 0, -bay * 2 - .38);
      pinkPlant.position.set(bay * 1.2 - 1, 0, -bay * 2 + .7);
      entrancePlants.forEach((group, index) => {
        group.position.set((index ? 1 : -1) * (bay * 1.2 - 1.9), 0, front - 1.9);
      });
      sun.position.set(-bay * 1.6, 16, bay * .2); sun.target.position.set(bay * .3, 0, -bay * .2);
      skyFill.position.set(-bay * 1.2, 8.7, 0); skyFill.target.position.set(0, 2, 0);
      // Shaded-side diffuse sky light; a single sun still determines direct shadows.
      rightSkyFill.position.set(bay * 1.2, 8.7, 0); rightSkyFill.target.position.set(0, 2, 0);

      // Fit the static hall in light space, not camera space. The shallow
      // clerestory light angle needs little vertical range but substantial
      // horizontal/depth range; a square frustum wasted most of the map.
      sun.updateWorldMatrix(true, false);
      sun.target.updateWorldMatrix(true, false);
      sun.shadow.updateMatrices(sun);
      const lightBounds = new THREE.Box3();
      for (const x of [-bay * 1.2 - .35, bay * 1.2 + .35]) {
        for (const y of [-.3, 9.6]) {
          for (const z of [rear - .4, front + .6]) {
            lightBounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(sun.shadow.camera.matrixWorldInverse));
          }
        }
      }
      Object.assign(sun.shadow.camera, {
        left: lightBounds.min.x - .5, right: lightBounds.max.x + .5,
        bottom: lightBounds.min.y - .5, top: lightBounds.max.y + .5,
        near: Math.max(.05, -lightBounds.max.z - .5),
        far: -lightBounds.min.z + .5
      });
      sun.shadow.camera.updateProjectionMatrix();
    }
  };
}
