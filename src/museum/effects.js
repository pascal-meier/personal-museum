export function createMuseumEffects({
  document = globalThis.document,
  window = globalThis.window,
  performance = globalThis.performance,
  renderer,
  scene,
  camera,
  stage,
  quality,
  isNarrow,
  requestRender
}) {
  let composer = null;
  let failed = false;
  let loading = false;
  let scheduled = false;
  let slowFrames = 0;
  let width = 1;
  let height = 1;
  let pixelRatio = 1;

  async function enable() {
    if (!quality.postProcessing || composer || failed || loading || isNarrow()) return;
    loading = true;
    performance.mark("museum:post-start");
    try {
      const modules = await Promise.all([
        import("../../vendor/three/addons/postprocessing/EffectComposer.js"),
        import("../../vendor/three/addons/postprocessing/RenderPass.js"),
        import("../../vendor/three/addons/postprocessing/GTAOPass.js"),
        import("../../vendor/three/addons/postprocessing/UnrealBloomPass.js"),
        import("../../vendor/three/addons/postprocessing/OutputPass.js")
      ]);
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { UnrealBloomPass }, { OutputPass }] = modules;
      const THREE = await import("../../vendor/three/three.module.min.js");
      const target = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: quality.samples
      });
      composer = new EffectComposer(renderer, target);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      composer.addPass(new RenderPass(scene, camera));
      const occlusion = new GTAOPass(scene, camera, width, height);
      occlusion.updateGtaoMaterial({
        radius: 1.1,
        distanceExponent: 1,
        thickness: 1.5,
        scale: 1,
        samples: 12
      });
      occlusion.blendIntensity = .85;
      composer.addPass(occlusion);
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), .12, .6, 1));
      composer.addPass(new OutputPass());
      performance.mark("museum:post-ready");
      performance.measure("museum:post-load", "museum:post-start", "museum:post-ready");
      requestRender();
    } catch (error) {
      failed = true;
      console.warn("Post-processing unavailable; rendering directly.", error);
    } finally {
      loading = false;
    }
  }

  function disable() {
    failed = true;
    composer?.dispose();
    composer = null;
    requestRender();
  }

  function schedule() {
    if (scheduled || !quality.postProcessing || isNarrow()) return;
    scheduled = true;
    const load = () => {
      if (document.hidden) {
        scheduled = false;
        return;
      }
      enable();
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(load, { timeout: 1500 });
    } else {
      window.setTimeout(load, 800);
    }
  }

  function resize(nextWidth, nextHeight, nextPixelRatio) {
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextPixelRatio;
    if (!composer) return;
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
  }

  function updateFrame(frameMs, moving) {
    if (!composer || isNarrow()) return;
    if (frameMs && moving) {
      slowFrames = frameMs > 45 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    }
    if (slowFrames <= 12) return;
    if (pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - .25);
      renderer.setDrawingBufferSize(width, height, pixelRatio);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      stage.dataset.renderQuality = quality.level + "-adaptive";
      slowFrames = 0;
    } else {
      disable();
    }
  }

  return {
    disable,
    schedule,
    resize,
    updateFrame,
    render(delta) {
      if (!composer || isNarrow()) return false;
      composer.render(delta);
      return true;
    }
  };
}
