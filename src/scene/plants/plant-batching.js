import * as THREE from "../../../vendor/three/three.module.min.js";

// Call after cloning/recolouring the second plant. Pot/stool meshes remain separate.
export function batchPlantMeshes(root) {
  const groups = new Map();
  let meshesBefore = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    meshesBefore++;
    if (object.isInstancedMesh || !object.visible || Array.isArray(object.material) || object.material.transparent) return;
    const stem = object.userData.plantStem;
    if (!stem && object.geometry.type !== "SphereGeometry") return;
    if (object.matrixAutoUpdate) object.updateMatrix();
    if (object.matrix.determinant() <= 0) return; // Instancing does not support mirrored transforms.
    const flags = [object.castShadow, object.receiveShadow, object.renderOrder, object.layers.mask, object.frustumCulled].join(':');
    const key = [stem ? 'stem' : object.geometry.uuid, object.material.uuid, flags].join(':');
    if (!groups.has(object.parent)) groups.set(object.parent, new Map());
    const siblings = groups.get(object.parent);
    if (!siblings.has(key)) siblings.set(key, []);
    siblings.get(key).push(object);
  });
  for (const [parent, siblings] of groups) for (const objects of siblings.values()) {
    if (objects.length < 2) continue;
    const first = objects[0];
    let batch;
    if (first.userData.plantStem) {
      const geometry = mergeStems(objects);
      if (!geometry) continue;
      batch = new THREE.Mesh(geometry, first.material);
      batch.name = 'Merged static plant stems';
      batch.userData.plantStem = true;
    } else {
      batch = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
      objects.forEach((object, index) => batch.setMatrixAt(index, object.matrix));
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox(); batch.computeBoundingSphere();
      batch.name = 'Instanced static plant leaves';
    }
    for (const flag of ['castShadow', 'receiveShadow', 'renderOrder', 'frustumCulled']) batch[flag] = first[flag];
    batch.layers.mask = first.layers.mask;
    parent.add(batch);
    objects.forEach(object => parent.remove(object));
  }
  let meshesAfter = 0;
  root.traverse(object => { if (object.isMesh) meshesAfter++; });
  return { meshesBefore, meshesAfter };
}

function mergeStems(objects) {
  const names = Object.keys(objects[0].geometry.attributes);
  if (objects.some(object => names.some(name => {
    const attribute = object.geometry.getAttribute(name), first = objects[0].geometry.getAttribute(name);
    return !attribute || attribute.isInterleavedBufferAttribute || attribute.itemSize !== first.itemSize || attribute.normalized;
  }))) return null;
  const geometry = new THREE.BufferGeometry();
  const shapes = objects.map(object => object.geometry.clone().applyMatrix4(object.matrix));
  const vertices = shapes.reduce((total, shape) => total + shape.attributes.position.count, 0);
  for (const name of names) {
    const itemSize = shapes[0].getAttribute(name).itemSize;
    const values = new Float32Array(vertices * itemSize);
    let offset = 0;
    for (const shape of shapes) {
      values.set(shape.getAttribute(name).array, offset);
      offset += shape.getAttribute(name).array.length;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, itemSize));
  }
  const indices = [];
  let vertexOffset = 0;
  for (const shape of shapes) {
    const count = shape.index ? shape.index.count : shape.attributes.position.count;
    for (let i = 0; i < count; i++) indices.push(vertexOffset + (shape.index ? shape.index.getX(i) : i));
    vertexOffset += shape.attributes.position.count;
    shape.dispose();
  }
  geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
