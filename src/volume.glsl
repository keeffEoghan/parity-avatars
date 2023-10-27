#pragma glslify: map = require(glsl-map);

const vec3 ndcMin = vec3(-1, 1, -1);
const vec3 ncdMax = vec3(1, -1, 1);
const vec3 stpMin = vec3(0);
const vec2 stMax = vec2(1, 1);

vec4 volume(sampler2D voxels, vec2 tile, in vec3 at) {
  // Map the lookup position into volume space.
  at = map(at, ndcMin, ncdMax, stpMin, vec3(stMax, tile.x*tile.y));

  // Transform the volume-space origin into volume UV-space.
  vec2 uv = (at.xy+floor(vec2(mod(at.z, tile.x), at.z/tile.x)))/tile;
  // Sample the volume at the world-space origin.
  vec4 voxel = texture2D(voxels, uv);
  vec2 inside = 1.0-step(0.5, abs(uv-0.5));

  voxel.w *= inside.x*inside.y;

  return voxel;
}

#pragma glslify: export(volume);
