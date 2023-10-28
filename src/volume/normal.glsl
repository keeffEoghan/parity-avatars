#pragma glslify: volume = require(.)

// Requires `voxels` and `tile` to be defined in `glslify`'s `require` mapping.
vec4 map(vec3 at) { return volume(voxels, tile, at); }

#pragma glslify: toSDFNormal = require(glsl-sdf-normal, map=map)

vec3 toVolumeNormal(vec3 at, float eps) { return toSDFNormal(at, eps); }
vec3 toVolumeNormal(vec3 at) { return toSDFNormal(at); }

#pragma glslify: export(toVolumeNormal)
