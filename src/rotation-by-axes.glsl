/**
 * @see [GameDev](https://gamedev.stackexchange.com/a/11484)
 */

const vec3 atDef = vec3(0, 1, 0);

#pragma glslify: rotation = require(glsl-rotate/rotation-3d)

mat4 rotationByAxes(in vec3 at, in vec3 to) {
  vec3 axis = cross(to, at);
  float angle = acos(dot(to, at));

  return rotation(axis, angle);
}

mat4 rotationByAxes(in vec3 to) { return rotationByAxes(atDef, to); }

#pragma glslify: export(rotationByAxes)
