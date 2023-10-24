
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

