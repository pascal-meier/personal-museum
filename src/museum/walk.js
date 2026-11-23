import * as THREE from "../../vendor/three/three.module.min.js";

const TURN_SPEED = 1.5;
const MAX_STEP_DISTANCE = .08;
const MAX_STEP_ANGLE = .03;
const MAX_PITCH = Math.PI / 2 - .05;
const SPRINT_MULTIPLIER = 1.65;
const CROUCH_HEIGHT = .65;
const JUMP_HEIGHT = .45;
const JUMP_DURATION = .65;

export function createWalkControls(camera, { blocked, speed }) {
  const keys = new Set();
  const angle = new THREE.Euler(0, 0, 0, "YXZ");
  let active = false, standingHeight = 0, jumpTime = null, jumpQueued = false, touchSide = 0, touchForward = 0;
  let gamepadSide = 0, gamepadForward = 0, gamepadTurn = 0, gamepadPitch = 0;
  const applyLook = () => camera.rotation.set(angle.x, angle.y, 0, "YXZ");
  const pressed = (first, second) => keys.has(first) || (second && keys.has(second)) ? 1 : 0;

  return {
    keys,
    get active() { return active; },
    get moving() { return keys.size > 0 || touchSide !== 0 || touchForward !== 0
      || gamepadSide !== 0 || gamepadForward !== 0 || gamepadTurn !== 0 || gamepadPitch !== 0
      || jumpTime !== null || jumpQueued; },
    enter() {
      if (active) return;
      active = true;
      standingHeight = camera.position.y;
      angle.setFromQuaternion(camera.quaternion, "YXZ");
    },
    press(code) {
      if (code === "Space" && !keys.has(code)) jumpQueued = true;
      keys.add(code);
    },
    setTouchMove(side, forward) {
      if (!Number.isFinite(side) || !Number.isFinite(forward)) return;
      const magnitude = Math.max(1, Math.hypot(side, forward));
      touchSide = side / magnitude;
      touchForward = forward / magnitude;
    },
    setGamepad(side, forward, turn, pitch) {
      if (![side, forward, turn, pitch].every(Number.isFinite)) return;
      gamepadSide = side; gamepadForward = forward; gamepadTurn = turn; gamepadPitch = pitch;
    },
    release() {
      keys.clear(); jumpQueued = false; jumpTime = null;
      touchSide = touchForward = 0;
      gamepadSide = gamepadForward = gamepadTurn = gamepadPitch = 0;
      if (active) camera.position.y = standingHeight;
    },
    reset() { this.release(); active = false; },
    look(yaw, pitch) {
      if (!active || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
      angle.y = THREE.MathUtils.euclideanModulo(angle.y + yaw + Math.PI, Math.PI * 2) - Math.PI;
      angle.x = THREE.MathUtils.clamp(angle.x + pitch, -MAX_PITCH, MAX_PITCH);
      applyLook();
    },
    update(delta) {
      if (!active || !Number.isFinite(delta) || delta <= 0) return;
      const crouching = keys.has("KeyC");
      if (jumpQueued) {
        if (jumpTime === null && !crouching) jumpTime = 0;
        jumpQueued = false;
      }
      let jumpHeight = 0;
      if (jumpTime !== null) {
        jumpTime += delta;
        if (jumpTime >= JUMP_DURATION) jumpTime = null;
        else {
          const progress = jumpTime / JUMP_DURATION;
          jumpHeight = 4 * JUMP_HEIGHT * progress * (1 - progress);
        }
      }
      camera.position.y = standingHeight - (crouching ? CROUCH_HEIGHT : 0) + jumpHeight;
      const turn = THREE.MathUtils.clamp(pressed("ArrowLeft") - pressed("ArrowRight") + gamepadTurn, -1, 1);
      const pitch = THREE.MathUtils.clamp(pressed("ArrowUp") - pressed("ArrowDown") + gamepadPitch, -1, 1);
      const forward = pressed("KeyW") - pressed("KeyS") + touchForward + gamepadForward;
      const side = pressed("KeyD") - pressed("KeyA") + touchSide + gamepadSide;
      const rawSpeed = speed();
      const sprinting = !crouching && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
      const distance = Number.isFinite(rawSpeed)
        ? Math.max(0, rawSpeed) * (sprinting ? SPRINT_MULTIPLIER : 1) * delta / Math.max(1, Math.hypot(forward, side)) : 0;
      const rotation = turn * TURN_SPEED * delta;
      const steps = Math.max(1, Math.ceil(Math.abs(distance) * Math.hypot(forward, side) / MAX_STEP_DISTANCE), Math.ceil(Math.abs(rotation) / MAX_STEP_ANGLE));
      const stepAngle = rotation / steps;
      const stepDistance = distance / steps;
      // Integrate the heading over each movement step, rather than translating
      // using only the final heading. Turning while walking stays independent of FPS.
      const arcFactor = stepAngle ? Math.sin(stepAngle / 2) / (stepAngle / 2) : 1;
      for (let i = 0; i < steps; i++) {
        const heading = angle.y + stepAngle / 2;
        const dx = (-Math.sin(heading) * forward + Math.cos(heading) * side) * stepDistance * arcFactor;
        const dz = (-Math.cos(heading) * forward - Math.sin(heading) * side) * stepDistance * arcFactor;
        if (dx && !blocked(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
        if (dz && !blocked(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
        angle.y += stepAngle;
      }
      angle.y = THREE.MathUtils.euclideanModulo(angle.y + Math.PI, Math.PI * 2) - Math.PI;
      angle.x = THREE.MathUtils.clamp(angle.x + pitch * TURN_SPEED * delta, -MAX_PITCH, MAX_PITCH);
      applyLook();
    }
  };
}
