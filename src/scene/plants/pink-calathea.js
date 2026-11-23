import * as THREE from "../../../vendor/three/three.module.min.js";

// Share the established green plant's exact geometry and leaf arrangement.
export function createPinkCalathea(renderer, template, quality = null) {
  const plant = template.clone(true);
  plant.name = "Pink foliage · matching green plant";
  // Planar leaf coordinates keep the pink centre enclosed by its green rim.
  // Fine veins, feathered pigment and shallow relief follow the reference.
  const resolution = quality?.level === "low" ? 384 : quality?.level === "medium" ? 512 : 768;
  const colourCanvas = document.createElement("canvas"), reliefCanvas = document.createElement("canvas");
  colourCanvas.width = colourCanvas.height = reliefCanvas.width = reliefCanvas.height = resolution;
  const context = colourCanvas.getContext("2d"), reliefContext = reliefCanvas.getContext("2d");
  const colourPixels = context.createImageData(resolution, resolution);
  const reliefPixels = reliefContext.createImageData(resolution, resolution);
  const smooth = THREE.MathUtils.smoothstep;
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const u = x / (resolution - 1) * 2 - 1, v = y / (resolution - 1) * 2 - 1;
    const radius = Math.hypot(u, v), theta = Math.atan2(v, u);
    const grain = Math.sin(x * 12.9898 + y * 78.233) * Math.sin(x * 4.17 - y * 3.31);
    const rib = v - .025 * Math.sin(u * 3);
    const veinPhase = (u + Math.abs(rib) * .78) * Math.PI * 10;
    const sideVein = Math.pow(Math.max(0, Math.cos(veinPhase)), 28) * smooth(Math.abs(rib), .025, .12);
    const midrib = Math.exp(-rib * rib / .00018);
    const boundary = .77 + .045 * Math.sin(theta * 7) + .025 * Math.sin(theta * 19)
      + .025 * Math.sin(veinPhase * 1.7) + grain * .035;
    const pink = 1 - smooth(radius, boundary - .035, boundary + .035);
    const mottling = 4 * Math.sin(u * 36 + v * 23) + grain * 3;
    const veinShade = sideVein * 23 + midrib * 30 + radius * 14 + 7 * Math.sin(u * 4 + v * 2);
    const index = (y * resolution + x) * 4;
    colourPixels.data[index] = 15 + pink * (174 + mottling - veinShade);
    colourPixels.data[index + 1] = 31 + pink * (18 + mottling * .45 - veinShade * .35);
    colourPixels.data[index + 2] = 24 + pink * (69 + mottling * .6 - veinShade * .3);
    colourPixels.data[index + 3] = 255;
    const height = 124 + midrib * 38 + sideVein * 20 + grain * 2;
    reliefPixels.data[index] = reliefPixels.data[index + 1] = reliefPixels.data[index + 2] = height;
    reliefPixels.data[index + 3] = 255;
  }
  context.putImageData(colourPixels, 0, 0); reliefContext.putImageData(reliefPixels, 0, 0);
  const map = new THREE.CanvasTexture(colourCanvas), bumpMap = new THREE.CanvasTexture(reliefCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const leafShape = quality?.level === "low"
    ? new THREE.SphereGeometry(1, 32, 20)
    : quality?.level === "medium"
      ? new THREE.SphereGeometry(1, 48, 30)
      : new THREE.SphereGeometry(1, 64, 40);
  const positions = leafShape.attributes.position, uv = leafShape.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const radius = Math.hypot(x, z), theta = Math.atan2(z, x);
    const ripple = 1 + .018 * Math.sin(theta * 9) * radius * radius;
    uv.setXY(i, (x + 1) * .5, (z + 1) * .5);
    positions.setXYZ(i, x * ripple,
      y * .32 + .11 * x * x + .10 * Math.sin(theta * 9) * Math.pow(radius, 5), z * ripple);
  }
  leafShape.computeVertexNormals();
  const leafFinish = new THREE.MeshPhysicalMaterial({
    map, bumpMap, bumpScale: .0015, roughness: .48,
    clearcoat: .18, clearcoatRoughness: .52
  });
  const stemFinish = new THREE.MeshStandardMaterial({ color: "#68434a", roughness: .88 });
  plant.traverse(object => {
    if (!object.isMesh) return;
    if (object.geometry.type === "SphereGeometry") {
      object.geometry = leafShape; object.material = leafFinish;
    } else if (object.userData.plantStem) object.material = stemFinish;
  });
  // A small oak stool lifts the foliage above the skirting and gives it a
  // clear silhouette in the distant corner. Leaf geometry is not scaled up.
  const arrangement = new THREE.Group();
  arrangement.name = "Pink calathea on oak stool";
  const oak = new THREE.MeshStandardMaterial({ color: "#a68a63", roughness: .76 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .10, 48), oak);
  top.position.y = 1; top.castShadow = top.receiveShadow = true; arrangement.add(top);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.10, .96, .10), oak);
    leg.position.set(x * .34, .48, z * .34);
    leg.rotation.set(z * .07, 0, -x * .07);
    leg.castShadow = leg.receiveShadow = true; arrangement.add(leg);
  }
  for (const z of [-.35, .35]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(.78, .065, .065), oak);
    brace.position.set(0, .3, z); brace.castShadow = true; arrangement.add(brace);
  }
  plant.position.y = 1.05;
  arrangement.add(plant);
  return arrangement;
}
