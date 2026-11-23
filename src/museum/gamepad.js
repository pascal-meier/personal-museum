const DEAD_ZONE = .18;

function stick(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const magnitude = Math.hypot(x, y);
  if (magnitude <= DEAD_ZONE) return [0, 0];
  const strength = (Math.min(magnitude, 1) - DEAD_ZONE) / (1 - DEAD_ZONE);
  return [x / magnitude * strength, y / magnitude * strength];
}

export function watchGamepads({ window, document, canControl, onInput }) {
  if (typeof window.navigator.getGamepads !== "function") return;
  let frame = null, hadInput = false, failed = false;
  function readGamepads() {
    try {
      return window.navigator.getGamepads();
    } catch (error) {
      if (!failed) console.warn("Gamepad input is unavailable:", error);
      failed = true;
      return [];
    }
  }
  function clearInput() {
    if (hadInput) onInput(0, 0, 0, 0);
    hadInput = false;
  }
  function poll() {
    frame = null;
    const pads = Array.from(readGamepads()).filter(pad => pad?.connected && pad.mapping === "standard");
    let input = null;
    if (!document.hidden && document.hasFocus() && canControl()) {
      for (const pad of pads) {
        const [side, forward] = stick(pad.axes[0], pad.axes[1]);
        const [turn, pitch] = stick(pad.axes[2], pad.axes[3]);
        if (side || forward || turn || pitch) {
          input = [side, -forward, -turn, -pitch];
          break;
        }
      }
    }
    if (input) { hadInput = true; onInput(...input); }
    else clearInput();
    if (pads.length && !document.hidden) frame = window.requestAnimationFrame(poll);
  }
  function start() {
    if (frame === null && !document.hidden && document.hasFocus() && !failed) frame = window.requestAnimationFrame(poll);
  }
  function pause() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    clearInput();
  }
  window.addEventListener("gamepadconnected", start);
  window.addEventListener("gamepaddisconnected", start);
  window.addEventListener("blur", pause);
  window.addEventListener("focus", start);
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : start());
  if (Array.from(readGamepads()).some(pad => pad?.connected && pad.mapping === "standard")) start();
}
