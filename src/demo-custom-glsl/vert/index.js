/**
 * Example custom vertex shader.
 *
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 *
 * @todo This is an awful coding workflow, but the best readily on offer. Switch
 *   to use a `regex` to find `#pragma replace:`, followed by the pipeline
 *   shader string to be replaced, followed by a new line; something like:
 *   `/#pragma replace: ?((?:.|(?:\\\n))+?$)/gm`
 */
import fs from 'fs';

import depth from 'pex-renderer/shaders/pipeline/depth-pass.vert';
import main from 'pex-renderer/shaders/pipeline/material.vert';

// Import vertex shader chunks.
const chunkAt = fs.readFileSync(__dirname+'/chunk-at.glsl', 'utf8');
import chunkTo from './chunk-to.glsl';

// Combine vertex shader chunks into main vertex shader passes.
export const vert = `
#if defined(DEPTH_PRE_PASS_ONLY) | defined(DEPTH_PASS_ONLY)
${depth.replace(chunkAt, chunkTo)}
#else
${main.replace(chunkAt, chunkTo)}
#endif
`;

export default vert;
