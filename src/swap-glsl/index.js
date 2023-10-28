/**
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 */

import { each } from '@epok.tech/fn-lists/each';

export const pre = '(?:^|\\n) *';
export const suf = '(?=(?: +)|\\n|$)';
export const at = '#pragma swap-at';
export const by = '#pragma swap-by';
export const to = '#pragma swap-to';
export const ify = '#define GLSLIFY';

export const swapGLSLRx = new RegExp(`(${pre+at+suf}(?:.|\\n)*?)`+
    `(?:${pre+by+suf}((?:.|\\n)*?))?${pre+to+suf}`,
  'g');

export const atGLSLRx = new RegExp(pre+at+suf, 'g');
export const ifyRx = new RegExp(`(${pre+ify}(?:(?: +.*)|\\n|$))`, 'g');

export function swapGLSL(swaps, to) {
  // Swap any chunks into their matched places.
  swaps.replace(swapGLSLRx, (_, ats, by = '') =>
    each((at) => at && (to = to.replace(at, by)), ats.split(atGLSLRx)));

  // Include any `glslify` info as-is, may be important for it to function.
  swaps.replace(ifyRx, (_, ify) => to = ify+to);

  return to;
}

export default swapGLSL;
