/**
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 */

export const $at = '#pragma swap-at';
export const $by = '#pragma swap-by';
export const $to = '#pragma swap-to';

export const swapGLSLRx = new RegExp(`((?:^|\\n) *?${$at}\\n(?:.|\\n)*?)`+
    `(?:\\n *?${$by}\\n((?:.|\\n)*?))?\\n *?${$to}(?:\\n|$)`,
  'g');

export const atGLSLRx = new RegExp(`(?:^|\n) *?${$at}(?=\n)`, 'g');

export function swapGLSL(swaps, to) {
  swaps.replace(swapGLSLRx, (_, ats, by = '') =>
    ats.split(atGLSLRx).forEach((at, i) => at && (to = to.replace(at, by))));

  return to;
}

export default swapGLSL;
