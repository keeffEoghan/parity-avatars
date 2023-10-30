// ...
#pragma swap-at
#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
varying vec4 vColor;
#endif
#pragma swap-by
// Custom shader start.
varying vec4 vColor;
// Custom shader end. Doesn't include match.
#pragma swap-to
// ...
#pragma swap-at
void main() {
#pragma swap-by
// Custom shader start.

// Time now, step, looped.
uniform vec3 x_time;
uniform vec3 x_distortNoise;
uniform vec3 x_distortSpeed;
uniform vec4 x_distortSurface;

vec3 x_atNoise(vec3 at) {
  return (at*x_distortNoise)+(x_time.z*x_distortSpeed);
}

#ifdef x_cellNoise
  uniform float x_distortShake;

  #pragma glslify: x_noiseCell = require(glsl-worley/worley3D)

  float x_toNoise(vec3 at) {
    vec2 f1f2 = x_noiseCell(at, x_distortShake, false);

    #if (x_cellNoise >= 0) && (x_cellNoise < 2)
      return f1f2[x_cellNoise];
    #else
      return f1f2.y-f1f2.x;
    #endif
  }
#else
  #pragma glslify: x_noiseSimplex = require(glsl-noise/simplex/3d)

  // @todo Make the noise properly symmetrical, expand on this `abs` idea.
  // float x_toNoise(vec3 at) { return x_noiseSimplex(abs(at)); }
  float x_toNoise(vec3 at) { return x_noiseSimplex(at); }
#endif

#ifdef x_orientToField
  // Scale for sampling normals.
  uniform float x_distortNormal;

  vec2 x_mapNoise(vec3 at) { return vec2(x_toNoise(at)); }

  #pragma glslify: x_toSDFNormal = require(glsl-sdf-normal, map=x_mapNoise)
#endif

// Custom shader end. Includes match.$&
#pragma swap-to
// ...
#pragma swap-at
    #ifdef USE_VERTEX_COLORS
      vColor = aVertexColor;
    #endif
  #endif
#pragma swap-at
  #ifdef USE_VERTEX_COLORS
    vColor = aVertexColor;
  #endif
#endif
#pragma swap-by
  // Custom shader end. Includes match.$&

  /**
   * Transform the local-space `position` and `normal` by the noise field:
   * 1. Now the `position` is in local-space, use it to sample the noise field
   * 2. Move `position` and `normal` by the noise samples
   */

  // Sample the noise at the local-space `position`.
  vec3 x_positionNoise = x_atNoise(position.xyz);
  float x_distort = x_distortSurface.x*x_toNoise(x_positionNoise);

  #if !defined(USE_VERTEX_COLORS) && !defined(USE_INSTANCED_COLOR)
    vColor = vec4(1);
  #endif

  vColor.a *= x_distort;

  // Move `position` by a given amount along the current `normal`.
  position.xyz += normal*x_distortSurface.y;

  #ifdef x_orientToField
    normal = normalize(mix(normal,
      x_toSDFNormal(x_positionNoise, x_distortNormal), x_distortSurface.z));
  #endif

  // Move `position` by the noise field sample along the new `normal`.
  position.xyz += normal*x_distort*x_distortSurface.w;

  // Custom shader end.
#pragma swap-to
// ...
