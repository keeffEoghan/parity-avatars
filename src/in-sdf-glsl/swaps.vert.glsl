#pragma swap-at
void main() {
  vec4 position = vec4(aPosition, 1.0);
#pragma swap-by
// Custom vertex shader `head` start.

uniform sampler2D x_sdfTexture;
uniform mat4 x_sdfTransform;

void main() {
  /**
   * Transform the `position` as the origin instead of the `aPosition`:
   * 1. Swap the origin for `aPosition` as `position`
   * 2. Let default flow handle transforms to `position`
   * ...
   */
  vec4 position = vec4(0, 0, 0, 1);
  // Custom vertex shader `head` end. Doesn't include match.
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

  // Custom vertex shader `use` start.
  #endif

  /**
   * Transform the `position` as the origin instead of the `aPosition`:
   * ...
   * 3. Now the origin is in world-space, use it to sample the SDF
   * 4. Swap `position` back to `aPosition`
   * 5. Apply SDF transform, sampled at the origin, to `position`
   * 6. Reapply the other transforms to `position` as per default flow
   * ...
   */
  #ifdef USE_SKIN
    position = skinMat*position;
  #else
    position = uModelMatrix*position;
  #endif

  // Sample the SDF at the world-space origin.
  // vec4 x_sdf = texture2D(x_sdfTexture, x_f(x_origin, x_sdfTransform));
  float x_sdfScale = 0.1;

  // Swap `position` back to `aPosition`.
  position = vec4(x_sdfScale*aPosition, 1);

  // Reapply transforms to `position`.
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

  #if defined(DEPTH_PRE_PASS_ONLY) | defined(DEPTH_PASS_ONLY)
  #else
    vPositionWorld = vec3(uModelMatrix*position);
    vPositionView = vec3(uViewMatrix*vec4(vPositionWorld, 1));
  #endif

#ifdef USE_SKIN
  // Custom vertex shader `use` end. Includes match:$&
#pragma swap-to