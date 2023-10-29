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
  vec4 position = vec4(aPosition, 1.0);
#pragma swap-by
// Custom shader start.

uniform sampler2D x_volumeTexture;
uniform vec2 x_volumeTile;
uniform mat4 x_volumeTransform;
uniform vec4 x_volumeRamp;

#pragma glslify: x_map = require(glsl-map)
#pragma glslify: x_inverse = require(glsl-inverse)

#if !defined(DEPTH_PRE_PASS_ONLY) && !defined(DEPTH_PASS_ONLY)
  uniform vec4 x_colors[2];
  uniform vec4 x_colorNoise;
  // Time now, step, looped.
  uniform vec3 x_time;

  #pragma glslify: x_noise = require(glsl-noise/simplex/4d)
#endif

#pragma glslify: x_volume = require(../volume)

#if defined(x_orientToVolume) || defined(x_clampToVolume)
  // Scales for sampling normals and distance to clamp.
  uniform vec2 x_volumeSurface;

  // #pragma glslify: x_lookAt = require(../look-at)
  #pragma glslify: x_rotationByAxes = require(../rotation-by-axes)
  #pragma glslify: x_toVolumeNormal = require(../volume/normal, voxels=x_volumeTexture, tile=x_volumeTile)
#endif

void main() {
  /**
   * Transform the `position` as the origin instead of the `aPosition`:
   * 1. Swap the origin for `aPosition` as `position`
   * 2. Let default flow handle transforms to `position`
   * ...
   */
  vec4 position = vec4(0, 0, 0, 1);

  // Custom shader end. Doesn't include match.
#pragma swap-to
// ...
#pragma swap-at

  vPositionWorld = vec3(uModelMatrix * position);
  vPositionView = vec3(uViewMatrix * vec4(vPositionWorld, 1.0));
#pragma swap-to
// ...
#pragma swap-at
    positionView = uViewMatrix * skinMat * position;
#pragma swap-at
  gl_Position = uProjectionMatrix * uViewMatrix * skinMat * position;
#pragma swap-by
  // Custom shader start.
  #endif

  /**
   * Transform the `position` as the origin instead of the `aPosition`:
   * ...
   * 3. Now the origin is in world-space, use it to sample the volume
   * 4. Swap `position` back to `aPosition`
   * 5. Apply volume transform, sampled at the origin, to `position`
   * 6. Reapply the other transforms to `position` as per default flow
   * ...
   */
  #ifdef USE_SKIN
    position = skinMat*position;
  #else
    position = uModelMatrix*position;
  #endif

  // Sample the volume at the world-space origin `position` transformed into the
  // volume's local space.
  vec4 x_voxel = x_volume(x_volumeTexture, x_volumeTile,
    vec3(x_inverse(x_volumeTransform)*position));

  #if defined(x_orientToVolume) || defined(x_clampToVolume)
    vec3 x_volumeNormal = x_toVolumeNormal(position.xyz, x_volumeSurface.x);
    // mat3 x_volumeOrient = x_lookAt(x_volumeNormal);
    mat4 x_volumeOrient = x_rotationByAxes(x_volumeNormal);
  #endif

  #if !defined(USE_VERTEX_COLORS) && !defined(USE_INSTANCED_COLOR)
    vColor = vec4(1);
  #endif
  #if !defined(DEPTH_PRE_PASS_ONLY) && !defined(DEPTH_PASS_ONLY)
    vColor *= mix(x_colors[0], x_colors[1],
      // @todo Make the noise properly symmetrical, expand on this `abs` idea.
      x_noise(abs(vec4(position.xyz, x_time.z)*x_colorNoise)));
  #endif

  // Ramp the voxel by its distance from the volume, map it to a scale vector.
  vec3 x_scale = x_voxel.xyz*x_voxel.a;

  x_scale = x_map(smoothstep(x_volumeRamp.y, x_volumeRamp.x, x_scale),
    vec3(0), vec3(1), vec3(x_volumeRamp.z), vec3(x_volumeRamp.w));

  // Swap `position` back to `aPosition` scaled by the origin's volume sample.
  position = vec4(aPosition*x_scale, 1);

  #ifdef x_orientToVolume
    // Orient the geometry to look along the volume normal.
    // position.xyz = x_volumeOrient*position.xyz;
    // normal = x_volumeOrient*normal;
    position = x_volumeOrient*position;
    normal = vec3(x_volumeOrient*vec4(normal, 0));
  #endif
  #ifdef x_clampToVolume
    // Clamp position within the volume, move it back along the volume normal.
    position.xyz -= x_volumeNormal*max(x_voxel.xyz*x_volumeSurface.y, 0.0);
  #endif

  // Reapply transformations to `position`.
  // @todo Possible bug in the pipeline, should transform the normal first?
  #ifdef USE_DISPLACEMENT_MAP
    position.xyz += uDisplacement*h*normal;
  #endif
  #ifdef USE_INSTANCED_SCALE
    position.xyz *= aScale;
  #endif
  #ifdef USE_INSTANCED_ROTATION
    position = rotationMat*position;
  #endif
  #ifdef USE_INSTANCED_OFFSET
    position.xyz += aOffset;
  #endif

  #if !defined(DEPTH_PRE_PASS_ONLY) && !defined(DEPTH_PASS_ONLY)
    vPositionWorld = vec3(uModelMatrix*position);
    vPositionView = vec3(uViewMatrix*vec4(vPositionWorld, 1));
  #endif

#ifdef USE_SKIN
  // Custom shader end. Includes match:$&
#pragma swap-to
// ...
