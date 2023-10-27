#pragma swap-at
void main() {
  vec4 position = vec4(aPosition, 1.0);
#pragma swap-by
// Custom vertex shader start.

#pragma glslify: map = require(glsl-map);
#pragma glslify: inverse = require(glsl-inverse);

uniform sampler2D x_volumeTexture;
// Size of the volume texture as `[layer-x, layer-y, layers-x, layers-y]`.
uniform vec4 x_volumeSize;
uniform mat4 x_volumeTransform;
uniform vec2 x_volumeRange;

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

  // Transform world-space origin position into volume space.
  vec3 x_volumeAt = map(vec3(inverse(x_volumeTransform)*position).xzy,
    vec3(-1, 1, -1), vec3(1, -1, 1),
    vec3(0), vec3(1, 1, x_volumeSize.z*x_volumeSize.w));

  // Transform the volume-space origin into volume UV-space.
  vec2 x_volumeUV = x_volumeAt.xy+
    floor(vec2(mod(x_volumeAt.z, x_volumeSize.z), x_volumeAt.z/x_volumeSize.z));

  x_volumeUV /= x_volumeSize.zw;

  float x_volumeIn = step(abs(x_volumeUV.x-0.5), 0.5)*
    step(abs(x_volumeUV.y-0.5), 0.5);

  // Sample the volume at the world-space origin.
  vec4 x_voxel = texture2D(x_volumeTexture, x_volumeUV);

  #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
    vColor.rgb = map(vColor.rgb+x_voxel.rgb,
      vec3(0), vec3(1), vec3(-0.2), vec3(1.4));

    vColor = mix(vec4(1), vColor, x_volumeIn);
  #endif

  x_voxel = smoothstep(x_volumeRange.y, x_volumeRange.x, x_voxel);

  // Swap `position` back, from origin, to `aPosition` scaled by volume sample.
  position = vec4(aPosition*
      map(x_volumeIn*x_voxel.rgb, vec3(0), vec3(1), vec3(0), vec3(1)),
    1);

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