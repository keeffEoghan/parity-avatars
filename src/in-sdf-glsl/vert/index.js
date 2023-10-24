import fs from 'fs';

import depth from 'pex-renderer/shaders/pipeline/depth-pass.vert';
import main from 'pex-renderer/shaders/pipeline/material.vert';

const headAt = fs.readFileSync(__dirname+'/head-at.glsl', 'utf8');
import headTo from './head-to.glsl';

const clearAtMain = fs.readFileSync(__dirname+'/clear-at-main.glsl', 'utf8');

const useAtDepth = fs.readFileSync(__dirname+'/use-at-depth.glsl', 'utf8');
const useAtMain = fs.readFileSync(__dirname+'/use-at-main.glsl', 'utf8');
import useTo from './use-to.glsl';

// Combine vertex shader chunks into main vertex shader passes.
export const vert = `
#if defined(DEPTH_PRE_PASS_ONLY) | defined(DEPTH_PASS_ONLY)
${depth.replace(headAt, headTo).replace(useAtDepth, useTo)}
#else
${main.replace(headAt, headTo).replace(clearAtMain, '')
  .replace(useAtMain, useTo)}
#endif
`;

console.log(vert);

export default vert;
