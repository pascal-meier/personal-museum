// Three.js expands the complete lighting equation for each spotlight. WebGL 2
// needs literal indices for shadow samplers, but can share the surface lighting.
export function shareSpotlightCalculation(chunk) {
  const sharedLoop = "for ( int spot = 0; spot < NUM_SPOT_LIGHTS; spot ++ )";
  if (chunk.includes(sharedLoop)) return chunk;
  const spotlights = /#pragma unroll_loop_start\s+for \( int i = 0; i < NUM_SPOT_LIGHTS; i \+\+ \) \{[\s\S]*?#pragma unroll_loop_end/;
  return chunk.replace(spotlights, original => {
    const lightInfo = original.match(/spotLight = spotLights\[ i \];\s*getSpotLightInfo\([^;]+;/)?.[0];
    const shadow = original.match(/spotLightShadow = spotLightShadows\[ i \];\s*directLight\.color \*= [^;]+;/)?.[0];
    const accumulate = original.match(/RE_Direct\([^;]+;/)?.[0];
    if (!lightInfo || !shadow || !accumulate) return original;

    // Projected textures use the library's original sampler indexing and LOD.
    return `
#if NUM_SPOT_LIGHT_MAPS > 0
  ${original}
#else
  ${sharedLoop} {
    ${lightInfo.replace("spotLights[ i ]", "spotLights[ spot ]")}
    if ( !directLight.visible ) continue;
    #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
      #pragma unroll_loop_start
      for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
        if ( spot == UNROLLED_LOOP_INDEX ) {
          ${shadow}
        }
      }
      #pragma unroll_loop_end
    #endif
    ${accumulate}
  }
#endif`;
  });
}
