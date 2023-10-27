#pragma swap-at
void main() {
  vec4 position = vec4(aPosition, 1.0);
#pragma swap-by
// Custom vertex shader start.

#pragma glslify: map = require(glsl-map);
#pragma glslify: inverse = require(glsl-inverse);

uniform sampler2D x_sdfTexture;
// Size of the SDF volume texture as `[layer-x, layer-y, layers-x, layers-y]`.
uniform vec4 x_sdfSize;
uniform mat4 x_sdfTransform;
uniform vec2 x_sdfRange;

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

  // Transform world-space origin position into SDF space.
  vec3 x_sdfAt = map(vec3(inverse(x_sdfTransform)*position).xzy,
    vec3(-1, 1, -1), vec3(1, -1, 1),
    vec3(0), vec3(1, 1, x_sdfSize.z*x_sdfSize.w));

  // Transform the SDF-space origin into SDF UV-space.
  vec2 x_sdfUV = x_sdfAt.xy+
    floor(vec2(mod(x_sdfAt.z, x_sdfSize.z), x_sdfAt.z/x_sdfSize.z));

  x_sdfUV /= x_sdfSize.zw;

  float x_sdfIn = step(abs(x_sdfUV.x-0.5), 0.5)*step(abs(x_sdfUV.y-0.5), 0.5);

  // Sample the SDF at the world-space origin.
  // float x_sdfScale = clamp(1.0-(texture2D(x_sdfTexture, x_sdfUV).x*9.0),
  //   0.0, 1.0);
  // float x_sdfScale = step(texture2D(x_sdfTexture, x_sdfUV).x, 0.0);
  float x_sdfScale = smoothstep(x_sdfRange.y, x_sdfRange.x,
    texture2D(x_sdfTexture, x_sdfUV).x);

  #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
    vColor += texture2D(x_sdfTexture, x_sdfUV);
    vColor.xyz = map(vColor.xyz, vec3(0), vec3(1), vec3(-0.2), vec3(1.4));
    vColor = mix(vec4(1), vColor, x_sdfIn);
  #endif

  // Swap `position` back, from origin, to `aPosition` scaled by the SDF lookup.
  position = vec4(map(x_sdfScale*x_sdfIn, 0.0, 1.0, 0.1, 1.0)*aPosition, 1);

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

  #if !defined(DEPTH_PRE_PASS_ONLY) && !defined(DEPTH_PASS_ONLY)
    vPositionWorld = vec3(uModelMatrix*position);
    vPositionView = vec3(uViewMatrix*vec4(vPositionWorld, 1));
  #endif

#ifdef USE_SKIN
  // Custom vertex shader end. Includes match:$&
#pragma swap-to