import * as THREE from "../../vendor/three/three.module.min.js";
import { isWorldVisible } from "./projection.js";

// Replace pending demand as the camera moves. Finished requests remain shared;
// already running requests may finish, but unseen queued files never start.
export function createTextureQueue({ load, onLoad = () => {}, onError = () => {}, concurrency = 4 }) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Invalid texture concurrency");
  const cache = new Map(), running = new Set(), failed = new Set();
  let wanted = new Set();
  function pump() {
    for (const src of wanted) {
      if (running.size >= concurrency) break;
      if (cache.has(src) || running.has(src) || failed.has(src)) continue;
      running.add(src);
      Promise.resolve().then(() => load(src)).then(value => {
        cache.set(src, value);
        onLoad(src, value);
      }).catch(error => {
        failed.add(src);
        onError(src, error);
      }).finally(() => {
        running.delete(src);
        pump();
      });
    }
  }
  return {
    setWanted(sources) {
      const next = new Set(sources);
      for (const src of next) if (!wanted.has(src)) failed.delete(src);
      wanted = next;
      pump();
    },
    retry() { failed.clear(); pump(); },
    has: src => cache.has(src),
    get: src => cache.get(src)
  };
}

// Slightly expand the field of view to start loading before a frame enters it.
// A frustum test also accepts partially visible planes crossing the near plane.
export function createMediaViewport(camera, margin = 1.15) {
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), matrix = new THREE.Matrix4();
  const center = new THREE.Vector3(), normal = new THREE.Vector3(), towardCamera = new THREE.Vector3();
  return {
    update() {
      projection.copy(camera.projectionMatrix);
      projection.elements[0] /= margin;
      projection.elements[5] /= margin;
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(projection, camera.matrixWorldInverse));
    },
    visible(mesh) {
      if (!isWorldVisible(mesh) || !frustum.intersectsObject(mesh)) return false;
      center.setFromMatrixPosition(mesh.matrixWorld);
      mesh.getWorldDirection(normal);
      towardCamera.copy(camera.position).sub(center);
      return normal.dot(towardCamera) > 0;
    }
  };
}
