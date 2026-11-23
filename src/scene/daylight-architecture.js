import * as THREE from "../../vendor/three/three.module.min.js";
import { seededRandom } from "./seeded-random.js";
import { createWalnutTextures, createOakTextures } from "./wood-materials.js";

// Mobile galleries retain their established neutral palette. The desktop hall
// supplies its own architecture; no per-room lights or hidden buildings are made.
export function createDaylightArchitecture(renderer) {
  const palette = { lobby: "#ead8c1", games: "#dfb49d", photos: "#edd9c5", "web-design": "#b8c9be" };
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#dedbd2";
  context.fillRect(0, 0, 512, 512);
  const random = seededRandom(8173);
  for (let i = 0; i < 22000; i++) {
    const shade = Math.floor(125 + random() * 100);
    context.fillStyle = `rgba(${shade},${shade - 6},${shade - 15},.25)`;
    const radius = .3 + random() * 1.9;
    context.beginPath();
    context.ellipse(random() * 512, random() * 512, radius, radius * .65, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const limestone = new THREE.CanvasTexture(canvas);
  limestone.colorSpace = THREE.SRGBColorSpace;
  limestone.wrapS = limestone.wrapT = THREE.RepeatWrapping;
  limestone.repeat.set(8, 8);
  limestone.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const floor = new THREE.MeshBasicMaterial({ map: limestone });
  const ceiling = new THREE.MeshBasicMaterial({ color: "#f9f3e7" });
  const materials = new Map();
  function wall(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshBasicMaterial({ color }));
    return materials.get(color);
  }
  const oak = createOakTextures(renderer);
  const oakPlanks = oak.floor.clone(); oakPlanks.repeat.set(3, 10);
  const oakFloor = new THREE.MeshBasicMaterial({ map: oakPlanks });
  // Fine limewash variation and just three timber reveals at the edge of the back wall.
  const limeCanvas = document.createElement("canvas"); limeCanvas.width = limeCanvas.height = 512;
  const limeContext = limeCanvas.getContext("2d");
  limeContext.fillStyle = "#f1eadb"; limeContext.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2800; i++) {
    limeContext.fillStyle = i % 2 ? "#fffaf012" : "#9c8d7410";
    limeContext.fillRect((i * 197 + 31) % 512, (i * 311 + 73) % 512, 2, 1);
  }
  const limeMap = new THREE.CanvasTexture(limeCanvas); limeMap.colorSpace = THREE.SRGBColorSpace;
  limeMap.anisotropy = limestone.anisotropy;
  const limeWall = new THREE.MeshBasicMaterial({ map: limeMap });
  const revealCanvas = document.createElement("canvas"); revealCanvas.width = revealCanvas.height = 512;
  const revealContext = revealCanvas.getContext("2d"); revealContext.drawImage(limeCanvas, 0, 0);
  for (let i = 0; i < 3; i++) revealContext.drawImage(oak.furniture.image, 492 + i * 7, 0, 3, 512);
  const revealMap = new THREE.CanvasTexture(revealCanvas); revealMap.colorSpace = THREE.SRGBColorSpace;
  revealMap.anisotropy = limestone.anisotropy;
  const japaneseWall = new THREE.MeshBasicMaterial({ map: revealMap });
  const japaneseCeiling = new THREE.MeshBasicMaterial({ color: "#f6f0e4" });
  const walnut = createWalnutTextures(renderer);
  const parquet = walnut.floor.clone(); parquet.repeat.set(3, 10);
  const walnutFloor = new THREE.MeshBasicMaterial({ map: parquet });
  const panelCanvas = document.createElement("canvas"); panelCanvas.width = panelCanvas.height = 512;
  const panel = panelCanvas.getContext("2d");
  panel.fillStyle = "#e6dece"; panel.fillRect(0, 0, 512, 512);
  panel.drawImage(walnut.veneer.image, 0, 422, 512, 90);
  panel.fillStyle = "#ac8d56"; panel.fillRect(0, 420, 512, 2);
  const panelMap = new THREE.CanvasTexture(panelCanvas); panelMap.colorSpace = THREE.SRGBColorSpace;
  panelMap.anisotropy = limestone.anisotropy;
  const walnutWall = new THREE.MeshBasicMaterial({ map: panelMap });
  const walnutSide = new THREE.MeshBasicMaterial({ color: "#ffffff", map: panelMap });
  const terrazzoCanvas = document.createElement("canvas"); terrazzoCanvas.width = terrazzoCanvas.height = 512;
  const terrazzoContext = terrazzoCanvas.getContext("2d");
  terrazzoContext.fillStyle = "#d4d3cf"; terrazzoContext.fillRect(0, 0, 512, 512);
  const chips = ["#b8b9b6", "#ece9e1", "#c5c1b8", "#a9afb0", "#d9cec1"];
  for (let i = 0; i < 1450; i++) {
    terrazzoContext.fillStyle = chips[i % chips.length];
    terrazzoContext.fillRect((i * 197 + 31) % 512, (i * 311 + 73) % 512, 1 + i % 3, 1 + (i * 7) % 2);
  }
  const terrazzo = new THREE.CanvasTexture(terrazzoCanvas);
  terrazzo.colorSpace = THREE.SRGBColorSpace;
  terrazzo.wrapS = terrazzo.wrapT = THREE.RepeatWrapping;
  terrazzo.repeat.set(8, 8);
  terrazzo.anisotropy = limestone.anisotropy;
  const terrazzoFloor = new THREE.MeshBasicMaterial({ map: terrazzo });
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
  const sciFiFloor = new THREE.MeshBasicMaterial({ map: sciFiFloorMap });
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
  const sciFiWall = new THREE.MeshBasicMaterial({ map: sciFiWallMap });
  const sciFiSide = new THREE.MeshBasicMaterial({ color: "#ffffff", map: sciFiWallMap });
  const sciFiCeiling = new THREE.MeshBasicMaterial({ color: "#bdc9d0" });
  const concreteCanvas = document.createElement("canvas"); concreteCanvas.width = concreteCanvas.height = 512;
  const concreteContext = concreteCanvas.getContext("2d");
  concreteContext.fillStyle = "#cfcec9"; concreteContext.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1200; i++) {
    const shade = 196 + i % 39;
    concreteContext.fillStyle = `rgba(${shade},${shade},${shade - 3},.18)`;
    concreteContext.fillRect((i * 173 + 41) % 512, (i * 271 + 17) % 512, 1 + i % 3, 1 + i % 2);
  }
  const concreteMap = new THREE.CanvasTexture(concreteCanvas);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.anisotropy = limestone.anisotropy;
  const concreteWall = new THREE.MeshBasicMaterial({ map: concreteMap });
  const creamWall = wall("#fff4e3");
  return function build(item, room) {
    const color = palette[room.id];
    if (color) {
      const sideColor = "#" + new THREE.Color(color).lerp(new THREE.Color("#f5f3ed"), .65).getHexString();
      item.back.material = wall(color);
      item.left.wall.material = item.right.wall.material = wall(sideColor);
      item.floor.material = floor;
      item.ceiling.material = ceiling;
    }
    const parts = [item.back, item.left.wall, item.right.wall, item.floor, item.ceiling];
    const fallback = parts.map(mesh => [mesh, mesh.material]);
    let elegant = false, whiteCube = false, sciFi = false, japanese = false;
    return {
      setDesign(design) { elegant = design === "walnut"; whiteCube = design === "white-cube"; sciFi = design === "sci-fi"; japanese = design === "japanese"; },
      update({ narrow }) {
        if (!narrow) return;
        const finishes = japanese
          ? [japaneseWall, limeWall, limeWall, oakFloor, japaneseCeiling]
          : sciFi
          ? [sciFiWall, sciFiSide, sciFiSide, sciFiFloor, sciFiCeiling]
          : whiteCube
          ? [concreteWall, creamWall, creamWall, terrazzoFloor, ceiling]
          : elegant
            ? [walnutWall, walnutSide, walnutSide, walnutFloor, ceiling]
            : fallback.map(([, material]) => material);
        parts.forEach((mesh, i) => { mesh.material = finishes[i]; });
        item.back.visible = item.floor.visible = item.ceiling.visible = true;
        item.left.wall.visible = item.right.wall.visible = true;
      }
    };
  };
}
