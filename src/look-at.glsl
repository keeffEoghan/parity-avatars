const vec3 upDef = vec3(0, 1, 0);

mat3 lookAt(in vec3 ahead, in vec3 up) {
  vec3 right = normalize(cross(up, ahead));

  return mat3(right, normalize(cross(ahead, right)), ahead);
}

mat3 lookAt(in vec3 ahead) { return lookAt(ahead, upDef); }

mat3 lookAt(in vec3 at, in vec3 to, in vec3 up) {
  return lookAt(normalize(to-at), up);
}

#pragma glslify: export(lookAt)
