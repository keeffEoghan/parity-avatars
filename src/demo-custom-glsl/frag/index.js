/**
 * Example custom fragment shader.
 *
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 *
 * @todo This is an awful coding workflow, but the best readily on offer. Switch
 *   to use a `regex` to find `#pragma replace:`, followed by the pipeline
 *   shader string to be replaced, followed by a new line; something like:
 *   `/#pragma replace: ?((?:.|(?:\\\n))+?$)/gm`
 */
import fs from 'fs';

import depthPre from 'pex-renderer/shaders/pipeline/depth-pre-pass.frag';
import depth from 'pex-renderer/shaders/pipeline/depth-pass.frag';
import main from 'pex-renderer/shaders/pipeline/material.frag';

// Import fragment shader chunks.
const chunkAt = fs.readFileSync(__dirname+'/chunk-at.glsl', 'utf8');
import chunkTo from './chunk-to.glsl';

// Combine fragment shader chunks into main fragment shader passes.
export const frag = `
#ifdef DEPTH_PRE_PASS_ONLY
${depthPre.replace(chunkAt, chunkTo)}
#elif defined(DEPTH_PASS_ONLY)
${depth.replace(chunkAt, chunkTo)}
#else
${main.replace(chunkAt, chunkTo)}
#endif
`;

export default frag;
