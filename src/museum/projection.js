import * as THREE from "../../vendor/three/three.module.min.js";

export function isWorldVisible(object) {
  for (let ancestor = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return false;
  return true;
}

// One projector per camera avoids allocations while positioning native hit
// areas. Reject near-plane crossings: they otherwise produce giant invisible
// buttons covering the screen when the visitor walks behind an exhibit.
export function createPlaneProjector(camera) {
  const point = new THREE.Vector3(), center = new THREE.Vector3(), normal = new THREE.Vector3();
  const towardCamera = new THREE.Vector3();
  return function projectPlane(mesh, width, height) {
    mesh.getWorldPosition(center);
    mesh.getWorldDirection(normal);
    towardCamera.copy(camera.position).sub(center);
    if (normal.dot(towardCamera) <= 0) return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
      point.set(x, y, 0).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if (point.z >= -camera.near || point.z < -camera.far) return null;
      point.applyMatrix4(camera.projectionMatrix);
      const screenX = (point.x + 1) * width / 2, screenY = (1 - point.y) * height / 2;
      left = Math.min(left, screenX); right = Math.max(right, screenX);
      top = Math.min(top, screenY); bottom = Math.max(bottom, screenY);
    }
    if (right <= 0 || bottom <= 0 || left >= width || top >= height) return null;
    left = Math.max(0, left); top = Math.max(0, top);
    right = Math.min(width, right); bottom = Math.min(height, bottom);
    if (right - left < 1 || bottom - top < 1) return null;
    return { left, top, width: right - left, height: bottom - top };
  };
}

// Native HTML hit areas must obey the same opaque architecture as canvas
// picking. Call after scene/camera world matrices have been updated.
export function createOcclusionTester(camera, objects) {
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(), center = new THREE.Vector3(), direction = new THREE.Vector3();
  const hits = [];
  return function isOccluded(target) {
    origin.setFromMatrixPosition(camera.matrixWorld);
    center.setFromMatrixPosition(target.matrixWorld);
    direction.copy(center).sub(origin);
    const distance = direction.length();
    if (distance <= .025) return false;
    raycaster.set(origin, direction.multiplyScalar(1 / distance));
    raycaster.near = 0;
    raycaster.far = distance - .025;
    hits.length = 0;
    raycaster.intersectObjects(objects, false, hits);
    for (const hit of hits) {
      if (hit.object === target) continue;
      if (!isWorldVisible(hit.object)) continue;
      const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
      if (materials.some(material => material?.visible && !material.transparent)) return true;
    }
    return false;
  };
}
