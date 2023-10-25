/**
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 */

import depthPre from 'pex-renderer/shaders/pipeline/depth-pre-pass.frag';
import depth from 'pex-renderer/shaders/pipeline/depth-pass.frag';
import main from 'pex-renderer/shaders/pipeline/material.frag';

import swapGLSL from '.';

export const swapPexFrag = (swaps) => `
#ifdef DEPTH_PRE_PASS_ONLY
${swapGLSL(swaps, depthPre)}
#elif defined(DEPTH_PASS_ONLY)
${swapGLSL(swaps, depth)}
#else
${swapGLSL(swaps, main)}
#endif
`;

export default swapPexFrag;
