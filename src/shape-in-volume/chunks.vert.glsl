#pragma swap-at
void main() {
  vec4 position = vec4(aPosition, 1.0);
#pragma swap-by
// Custom vertex shader start.

#pragma glslify: map = require(glsl-map);
#pragma glslify: inverse = require(glsl-inverse);

#pragma glslify: volume = require(../volume);

uniform sampler2D x_volumeTexture;
uniform vec2 x_volumeTile;
uniform mat4 x_volumeTransform;
uniform vec2 x_volumeRamp;

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

#pragma swap-at

  vPositionWorld = vec3(uModelMatrix * position);
  vPositionView = vec3(uViewMatrix * vec4(vPositionWorld, 1.0));
#pragma swap-to

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
  vec4 x_voxel = volume(x_volumeTexture, x_volumeTile,
    vec3(inverse(x_volumeTransform)*position).xzy);

  #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
    vColor.rgb = map(vColor.rgb+x_voxel.rgb,
      vec3(0), vec3(1), vec3(-0.2), vec3(1.4));

    vColor = mix(vec4(1), vColor, x_voxel.w);
  #endif

  x_voxel.xyz = smoothstep(x_volumeRamp.y, x_volumeRamp.x, x_voxel.xyz);

  // Swap `position` back, from origin, to `aPosition` scaled by volume sample.
  // @todo Clamp position to the volume, by sampling gradient or random samples?
  position = vec4(aPosition*x_voxel.rgb*x_voxel.w, 1);

  // Reapply transformations to `position`.
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