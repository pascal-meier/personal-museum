import * as THREE from "../../vendor/three/three.module.min.js";
import { seededRandom } from "./seeded-random.js";

const cache = new WeakMap(), oakCache = new WeakMap();

// Seeded grain and staggered joints stay fixed while the visitor moves.
export function createWalnutTextures(renderer) { return createWoodTextures(renderer, false); }
export function createOakTextures(renderer) { return createWoodTextures(renderer, true); }

function createWoodTextures(renderer, oak) {
  const textureCache = oak ? oakCache : cache;
  if (textureCache.has(renderer)) return textureCache.get(renderer);
  function make(kind) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1024;
    const c = canvas.getContext("2d");
    const random = seededRandom(3819);
    const shades = oak ? ["#d8c29b", "#dcc8a7", "#d2bb94", "#e0cdad", "#d6c09e", "#dac5a3"] : ["#78604f", "#826957", "#7d6351", "#8b715c", "#775d4d", "#866a55"];
    c.fillStyle = oak ? "#b5a080" : "#514439"; c.fillRect(0, 0, 1024, 1024);
    const rows = kind === "floor" ? (oak ? 6 : 8) : 1;
    const columns = kind === "veneer" ? 4 : kind === "floor" ? (oak ? 2 : 4) : 1;
    for (let row = 0; row < rows; row++) {
      const h = 1024 / rows, w = 1024 / columns;
      for (let col = -1; col < columns; col++) {
        const x = col * w + (kind === "floor" && row % 2 ? w / 2 : 0), y = row * h;
        c.save(); c.beginPath(); c.rect(x + 1, y + 1, w - 2, h - 2); c.clip();
        c.fillStyle = shades[Math.floor(random() * shades.length)]; c.fillRect(x, y, w, h);
        const vertical = kind !== "floor";
        for (let n = 0; n < 160; n++) {
          const at = random(), drift = (random() - .5) * 18;
          c.strokeStyle = oak ? (n % 3 ? "#826b4912" : "#fff6df22") : (n % 3 ? "#392d2418" : "#d8c5ad14");
          c.lineWidth = .4 + random() * 1.3;
          c.beginPath();
          if (vertical) {
            c.moveTo(x + at * w, y);
            c.bezierCurveTo(x + at * w + drift, y + h * .3, x + at * w - drift, y + h * .7, x + at * w, y + h);
          } else {
            c.moveTo(x, y + at * h);
            c.bezierCurveTo(x + w * .3, y + at * h + drift, x + w * .7, y + at * h - drift, x + w, y + at * h);
          }
          c.stroke();
        }
        c.restore();
      }
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const textures = { floor: make("floor"), veneer: make("veneer"), furniture: make("furniture") };
  textureCache.set(renderer, textures);
  return textures;
}
