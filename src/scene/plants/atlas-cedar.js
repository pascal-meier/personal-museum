import * as THREE from "../../../vendor/three/three.module.min.js";
import { seededRandom } from "../seeded-random.js";
import { createBranches } from "./branches.js";

export function createAtlasCedar(quality = null) {
  const random = seededRandom(92483);
  const detailRandom = seededRandom(4159);
  const tree = new THREE.Group();
  tree.name = "Blue atlas cedar";
  tree.scale.y = 1.06;
  const ceramic = new THREE.MeshStandardMaterial({ color: "#77605b", roughness: .8 });
  const soil = new THREE.MeshStandardMaterial({ color: "#493c2e", roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: "#51473b", roughness: 1 });
  function part(geometry, finish, y) {
    const mesh = new THREE.Mesh(geometry, finish);
    mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true; tree.add(mesh);
    return mesh;
  }
  const pot = part(new THREE.CylinderGeometry(.70, .54, .38, 40, 1, true), ceramic, .19);
  pot.scale.z = .83;
  const rim = part(new THREE.TorusGeometry(.70, .045, 8, 40), ceramic, .38);
  rim.rotation.x = Math.PI / 2; rim.scale.y = .83;
  const earth = part(new THREE.CylinderGeometry(.66, .66, .035, 40), soil, .34);
  earth.scale.z = .83;

  const trunkAt = t => new THREE.Vector3(.08 * Math.sin(t * 4.6) + .05 * t,
    .34 + t * 3.84, .05 * Math.sin(t * 6.5));
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 19 }, (_, i) => trunkAt(i / 18)));
  const trunkGeometry = new THREE.TubeGeometry(curve, 56, .19, 12, false);
  const positions = trunkGeometry.attributes.position, vertex = new THREE.Vector3();
  const barkColors = [], darkBark = new THREE.Color("#39352f"), lightBark = new THREE.Color("#6b6050");
  const barkColor = new THREE.Color();
  for (let ring = 0; ring <= 56; ring++) {
    const t = ring / 56, center = curve.getPointAt(t);
    const taper = .12 + .88 * Math.pow(1 - t, 1.1) + .18 * Math.exp(-t * 24);
    for (let side = 0; side <= 12; side++) {
      const index = ring * 13 + side;
      const grain = .5 + .5 * Math.sin(ring * .52 + Math.sin(side * 4.1) * 2.5) * Math.sin(side * 3.2 + ring * .17);
      const roughness = 1 + .06 * Math.sin(ring * 2.7 + side * 4.8);
      vertex.fromBufferAttribute(positions, index).sub(center).multiplyScalar(taper * roughness).add(center);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
      barkColor.copy(darkBark).lerp(lightBark, grain);
      barkColors.push(barkColor.r, barkColor.g, barkColor.b);
    }
  }
  trunkGeometry.setAttribute("color", new THREE.Float32BufferAttribute(barkColors, 3));
  trunkGeometry.computeVertexNormals();
  part(trunkGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 0).name = "Atlas cedar trunk";

  const branches = [];
  const colors = ["#688b9b", "#789cab", "#85a4ad", "#587887", "#91acb3"];
  const tiers = [.20, .36, .53, .70, .87, .96];
  const branchCount = tiers.length * 4;
  const twigsPerBranch = 16;
  const rosettes = quality?.level === "low" ? 6 : 8;
  const needlesPerRosette = 5;
  const needleGeometry = new THREE.ConeGeometry(1, 1, 5);
  needleGeometry.translate(0, .5, 0);
  const foliage = new THREE.InstancedMesh(needleGeometry, new THREE.MeshStandardMaterial({ roughness: .95 }),
    branchCount * twigsPerBranch * rosettes * needlesPerRosette);
  foliage.name = "Atlas cedar needles";
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const heading = new THREE.Vector3(), color = new THREE.Color();
  let index = 0;
  for (let i = 0; i < branchCount; i++) {
    const tier = Math.floor(i / 4);
    const t = Math.min(.98, tiers[tier] + (random() - .5) * .055);
    const angle = i * 2.43 + (random() - .5) * .8;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    const length = (.36 + 1.18 * Math.pow(1 - t, .7)) * (.8 + random() * .4);
    const root = trunkAt(t), bend = root.clone().addScaledVector(direction, length * .53);
    const end = root.clone().addScaledVector(direction, length);
    bend.y += .10; end.y += .12 + random() * .07;
    branches.push([root, bend, .055 * (1 - t) + .015], [bend, end, .025]);
    for (let twig = 0; twig < twigsPerBranch; twig++) {
      const along = .24 + twig * .043 + random() * .03;
      const start = along < .53 ? root.clone().lerp(bend, along / .53)
        : bend.clone().lerp(end, (along - .53) / .47);
      const tip = start.clone().addScaledVector(direction, .12 + random() * .2)
        .addScaledVector(side, (twig % 2 ? 1 : -1) * (.12 + random() * .22));
      tip.y += .02 + random() * .09;
      branches.push([start, tip, .009]);
      for (let n = 0; n < rosettes; n++) {
        transform.position.copy(start).lerp(tip, .12 + (n + detailRandom() * .5) / rosettes * .85);
        const phase = detailRandom() * Math.PI * 2;
        for (let needle = 0; needle < needlesPerRosette; needle++) {
          const angle = phase + needle * Math.PI * 2 / needlesPerRosette + (detailRandom() - .5) * .3;
          heading.set(Math.cos(angle), .35 + detailRandom() * .65, Math.sin(angle)).normalize();
          const size = .7 + detailRandom() * .65;
          transform.quaternion.setFromUnitVectors(up, heading);
          transform.scale.set(.008 * size, .105 * size, .008 * size);
          transform.updateMatrix();
          foliage.setMatrixAt(index, transform.matrix);
          foliage.setColorAt(index, color.set(colors[Math.floor(detailRandom() * colors.length)]));
          index++;
        }
      }
    }
  }
  tree.add(createBranches("Atlas cedar branches", branches, bark, .5));
  foliage.instanceMatrix.needsUpdate = true; foliage.castShadow = true;
  foliage.computeBoundingSphere(); tree.add(foliage);
  return tree;
}
