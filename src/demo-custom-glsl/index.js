/**
 * Example custom shader.
 *
 * @see [`pex` custom shader setup](https://github.com/pex-gl/pex-renderer/blob/main/examples/custom-shader.js)
 *
 * @todo This is an awful coding workflow, but the best readily on offer. Switch
 *   to use a `regex` to find `#pragma replace:`, followed by the pipeline
 *   shader string to be replaced, followed by a new line; something like:
 *   `/#pragma replace: ?((?:.|(?:\\\n))+?$)/gm`
 */

export vert from './vert';
export frag from './frag';
