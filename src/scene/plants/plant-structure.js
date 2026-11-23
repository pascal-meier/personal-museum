import * as THREE from "../../../vendor/three/three.module.min.js";

// Both colour variants share one botanical structure. Petioles join the inward
// leaf tips, rather than ending at their centres or leaving floating blades.
export function connectPlantStructure(plant) {
  const leaves = [];
  plant.traverse(object => {
    if (!object.isMesh) return;
    if (object.geometry.type === "SphereGeometry") leaves.push(object);
  });
  const material = new THREE.MeshStandardMaterial({ color: "#64533d", roughness: .88 });
  const pointAtHeight = y => {
    const t = (y - .84) / 2.26;
    return new THREE.Vector3(.065 * Math.sin(t * 5) + .07 * t, y, .035 * Math.sin(t * 4));
  };
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => pointAtHeight(.84 + i / 24 * 2.26)));
  const geometry = new THREE.TubeGeometry(curve, 48, .035, 10, false);
  const positions = geometry.attributes.position, vertex = new THREE.Vector3();
  for (let ring = 0; ring <= 48; ring++) {
    const t = ring / 48, center = curve.getPointAt(t), taper = 1.2 - .65 * t;
    for (let side = 0; side <= 10; side++) {
      const index = ring * 11 + side;
      vertex.fromBufferAttribute(positions, index).sub(center).multiplyScalar(taper).add(center);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  function addStem(shape, name) {
    const stem = new THREE.Mesh(shape, material);
    stem.name = name; stem.userData.plantStem = true; stem.castShadow = true;
    plant.add(stem); return stem;
  }
  addStem(geometry, "Curved plant trunk");
  leaves.forEach((leaf, index) => {
    leaf.updateMatrix();
    const ends = [-.90, .90].map(x => new THREE.Vector3(x, 0, 0).applyMatrix4(leaf.matrix));
    const end = ends.reduce((a, b) => a.distanceToSquared(pointAtHeight(a.y)) < b.distanceToSquared(pointAtHeight(b.y)) ? a : b);
    const root = pointAtHeight(THREE.MathUtils.clamp(end.y - .14, .94, 3.06));
    const bend = root.clone().lerp(end, .55); bend.y += .055;
    const petiole = new THREE.QuadraticBezierCurve3(root, bend, end);
    addStem(new THREE.TubeGeometry(petiole, 12, .006 + index % 3 * .001, 6, false), "Connected leaf petiole");
  });
  return plant;
}
