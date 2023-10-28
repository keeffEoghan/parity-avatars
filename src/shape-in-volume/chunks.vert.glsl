// ...
#pragma swap-at
void main() {
  vec4 position = vec4(aPosition, 1.0);
#pragma swap-by
// Custom vertex shader start.

uniform sampler2D x_volumeTexture;
uniform vec2 x_volumeTile;
uniform mat4 x_volumeTransform;
uniform vec2 x_volumeRamp;

#pragma glslify: x_map = require(glsl-map)
#pragma glslify: x_inverse = require(glsl-inverse)

#pragma glslify: x_volume = require(../volume)

#ifdef x_orientToVolume
  uniform float x_volumeNormalRange;

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
  // Custom vertex shader end. Doesn't include match.
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
  // Custom vertex shader start.
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

  #ifdef x_orientToVolume
    vec3 x_volumeNormal = x_toVolumeNormal(position.xyz, x_volumeNormalRange);
    // mat3 x_volumeOrient = x_lookAt(x_volumeNormal);
    mat4 x_volumeOrient = x_rotationByAxes(x_volumeNormal);
  #endif

  #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
    vColor.rgb = x_map(vColor.rgb+x_voxel.rgb,
      vec3(0), vec3(1), vec3(-0.2), vec3(1.4));

    vColor = mix(vec4(1), vColor, x_voxel.w);
  #endif

  x_voxel.xyz = smoothstep(x_volumeRamp.y, x_volumeRamp.x, x_voxel.xyz);

  // Swap `position` back to `aPosition` scaled by the origin's volume sample.
  // @todo Clamp position to the volume, by sampling gradient or random samples?
  position = vec4(aPosition*x_voxel.rgb*x_voxel.w, 1);

  #ifdef x_orientToVolume
    // Orient the geometry to look along the volume normal.
    // position.xyz = x_volumeOrient*position.xyz;
    // normal = x_volumeOrient*normal;
    position = x_volumeOrient*position;
    normal = vec3(x_volumeOrient*vec4(normal, 0));
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
  // Custom vertex shader end. Includes match:$&
#pragma swap-to
// ...
