import * as THREE from "../../../vendor/three/three.module.min.js";
import { seededRandom } from "../seeded-random.js";
import { createBranches } from "./branches.js";

export function createGoldenCypress(renderer, quality = null) {
  const random = seededRandom(19371);
  const detailRandom = seededRandom(51403);
  const plant = new THREE.Group();
  plant.name = "Golden gallery plant";

  const woodCanvas = document.createElement("canvas");
  woodCanvas.width = 512; woodCanvas.height = 128;
  const woodContext = woodCanvas.getContext("2d");
  woodContext.fillStyle = "#b99d73"; woodContext.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 700; i++) {
    woodContext.fillStyle = i % 2 ? "#705a4020" : "#f2dbaf24";
    woodContext.fillRect(random() * 512, random() * 128, 15 + random() * 140, .3 + random());
  }
  const woodMap = new THREE.CanvasTexture(woodCanvas);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: .88 });
  const trim = new THREE.MeshStandardMaterial({ color: "#927957", roughness: .88 });
  function part(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
    plant.add(mesh); return mesh;
  }
  const board = new THREE.BoxGeometry(1.14, .19, .07);
  for (let row = 0; row < 4; row++) for (const side of [-1, 1]) {
    part(board, wood, 0, .13 + row * .2, side * .535);
    part(board, wood, side * .535, .13 + row * .2, 0).rotation.y = Math.PI / 2;
  }
  const corner = new THREE.BoxGeometry(.09, .84, .09);
  for (const x of [-.51, .51]) for (const z of [-.51, .51]) part(corner, trim, x, .42, z);
  part(new THREE.BoxGeometry(.99, .06, .99), new THREE.MeshStandardMaterial({
    color: "#4b3b29", roughness: 1
  }), 0, .75, 0).name = "Cypress soil";
  const bark = new THREE.MeshStandardMaterial({ color: "#6d5b3e", roughness: 1 });
  const trunkPoint = t => new THREE.Vector3(
    .10 * Math.sin(t * 5.2) + .035 * t, .78 + t * 3.54, .065 * Math.sin(t * 7)
  );
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => trunkPoint(i / 16)));
  const trunkGeometry = new THREE.TubeGeometry(curve, 48, .065, 8, false);
  const positions = trunkGeometry.attributes.position, vertex = new THREE.Vector3();
  for (let ring = 0; ring <= 48; ring++) {
    const t = ring / 48, center = curve.getPointAt(t);
    for (let side = 0; side <= 8; side++) {
      const index = ring * 9 + side;
      vertex.fromBufferAttribute(positions, index).sub(center).multiplyScalar(1 - .82 * t).add(center);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  trunkGeometry.computeVertexNormals();
  part(trunkGeometry, bark, 0, 0, 0).name = "Cypress trunk";

  const branchSegments = [], twigs = [];
  for (let i = 0; i < 42; i++) {
    const t = Math.min(.97, .045 + i / 44 + (random() - .5) * .032);
    const angle = t * Math.PI * 7.2 + .5 + .4 * Math.sin(t * 14) + (random() - .5) * 1.4;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const sideways = new THREE.Vector3(-direction.z, 0, direction.x);
    const length = (.18 + .48 * Math.pow(1 - t, .7)) * (.55 + random() * .9);
    const root = trunkPoint(t);
    const end = root.clone().addScaledVector(direction, length);
    end.y += .06 + length * .18 + .13 * THREE.MathUtils.smoothstep(t, .84, 1);
    branchSegments.push([root, end, .018]);
    for (let twig = 0; twig < 6; twig++) {
      if (random() < .12) continue;
      const start = root.clone().lerp(end, .25 + twig * .1 + random() * .06);
      const tip = start.clone().addScaledVector(direction, .10 + random() * .12)
        .addScaledVector(sideways, (random() < .5 ? 1 : -1) * (.06 + random() * .14));
      tip.y += .04 + random() * .09;
      branchSegments.push([start, tip, .009]);
      twigs.push({ start, tip, direction, sideways });
    }
  }
  plant.add(createBranches("Cypress branches", branchSegments, bark, .55));

  const needleGeometry = new THREE.SphereGeometry(1, 5, 4);
  const needlePositions = needleGeometry.attributes.position, needleColors = [];
  const green = new THREE.Color("#536b2d"), yellow = new THREE.Color("#d8d050");
  const color = new THREE.Color();
  for (let i = 0; i < needlePositions.count; i++) {
    const tip = THREE.MathUtils.smoothstep(needlePositions.getY(i), .25, 1);
    color.copy(green).lerp(yellow, tip);
    needleColors.push(color.r, color.g, color.b);
  }
  needleGeometry.setAttribute("color", new THREE.Float32BufferAttribute(needleColors, 3));
  const leavesPerTwig = quality?.level === "low" ? 36 : 53;
  const needles = new THREE.InstancedMesh(needleGeometry,
    new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true }), twigs.length * leavesPerTwig);
  needles.name = "Cypress foliage tips";
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const heading = new THREE.Vector3(), twigHeading = new THREE.Vector3();
  let index = 0;
  for (const { start, tip, direction, sideways } of twigs) {
    twigHeading.subVectors(tip, start).normalize();
    for (let leaf = 0; leaf < leavesPerTwig; leaf++) {
      transform.position.copy(start).lerp(tip, .15 + detailRandom() * .85);
      transform.position.addScaledVector(sideways, (detailRandom() - .5) * .15);
      transform.position.addScaledVector(direction, (detailRandom() - .5) * .10);
      transform.position.y += (detailRandom() - .5) * .12;
      heading.copy(twigHeading).addScaledVector(sideways, (detailRandom() - .5) * .8);
      heading.y += detailRandom() * .45;
      const size = .7 + detailRandom() * .6;
      const shade = .85 + detailRandom() * .15;
      transform.quaternion.setFromUnitVectors(up, heading.normalize());
      transform.scale.set(.015 * size, .036 * size, .008 * size);
      transform.updateMatrix();
      needles.setMatrixAt(index, transform.matrix);
      needles.setColorAt(index, color.setRGB(shade, shade, shade));
      index++;
    }
  }
  needles.instanceMatrix.needsUpdate = true; needles.castShadow = true;
  needles.computeBoundingSphere(); plant.add(needles);
  return plant;
}
