// ...
#pragma swap-at
#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  varying vec4 vColor;
#endif
#pragma swap-by
// Custom shader start.

// Time now, step, looped.
uniform highp vec3 x_time;
uniform highp vec3 x_distortNoise;
uniform highp vec3 x_distortSpeed;
uniform highp vec4 x_distortSurface;

vec3 x_atNoise(vec3 at) {
  return (at*x_distortNoise)+(x_time.z*x_distortSpeed);
}

#ifdef x_cellNoise
  uniform highp float x_distortShake;

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

varying highp vec3 x_position;
// Custom shader end. Includes match.$&
#pragma swap-to
// ...
#pragma swap-at
    #ifdef USE_ALPHA_TEST
      alphaTest(data);
    #endif
#pragma swap-at
  #ifdef USE_ALPHA_TEST
    alphaTest(data);
  #endif
#pragma swap-by
  float x_alpha = x_toNoise(x_atNoise(x_position))*x_distortSurface.a;

  data.opacity *= mix(1.0+x_alpha, x_alpha, max(0.0, sign(x_alpha)));

  // Custom shader end. Includes match.$&
#pragma swap-to
// ...
