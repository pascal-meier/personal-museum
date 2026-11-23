import * as THREE from "../../../vendor/three/three.module.min.js";

export function createBranches(name, segments, bark, tipRadius) {
  const geometry = new THREE.CylinderGeometry(tipRadius, 1, 1, 6);
  const branches = new THREE.InstancedMesh(geometry, bark, segments.length);
  branches.name = name;
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const transform = new THREE.Object3D();
  segments.forEach(([start, end, width], index) => {
    direction.subVectors(end, start);
    transform.position.copy(start).add(end).multiplyScalar(.5);
    transform.scale.set(width, direction.length(), width);
    transform.quaternion.setFromUnitVectors(up, direction.normalize());
    transform.updateMatrix();
    branches.setMatrixAt(index, transform.matrix);
  });
  branches.castShadow = true;
  branches.instanceMatrix.needsUpdate = true;
  branches.computeBoundingSphere();
  return branches;
}
