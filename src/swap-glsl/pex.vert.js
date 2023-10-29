/**
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 */

import depth from 'pex-renderer/shaders/pipeline/depth-pass.vert';
import main from 'pex-renderer/shaders/pipeline/material.vert';

import swapGLSL from '.';

export const swapPexVert = (swaps) => `
#if defined(DEPTH_PRE_PASS_ONLY) || defined(DEPTH_PASS_ONLY)
${swapGLSL(swaps, depth)}
#else
${swapGLSL(swaps, main)}
#endif
`;

export default swapPexVert;
