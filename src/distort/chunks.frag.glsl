// ...
#pragma swap-at
#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  varying vec4 vColor;
#endif
#pragma swap-by
// Custom shader start.
#define USE_VERTEX_COLORS
// Custom shader end. Includes match.$&
#pragma swap-to
// ...
