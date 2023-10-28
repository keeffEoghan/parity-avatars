#pragma glslify: map = require(glsl-map);

const vec3 ndcMin = vec3(-1, 1, -1);
const vec3 ncdMax = vec3(1, -1, 1);
const vec3 xzyMin = vec3(0);
const vec2 xzMax = vec2(1, 1);

vec4 volume(sampler2D voxels, vec2 tile, in vec3 at) {
  // Map the lookup position into volume space.
  vec3 xzy = map(at.xzy, ndcMin, ncdMax, xzyMin, vec3(xzMax, tile.x*tile.y));
  // Transform the volume-space origin into volume UV-space.
  vec2 uv = (xzy.xy+floor(vec2(mod(xzy.z, tile.x), xzy.z/tile.x)))/tile;
  // Sample the volume at the world-space origin.
  vec4 voxel = texture2D(voxels, uv);
  vec2 inside = 1.0-step(0.5, abs(uv-0.5));

  voxel.w *= inside.x*inside.y;

  return voxel;
}

#pragma glslify: export(volume);
