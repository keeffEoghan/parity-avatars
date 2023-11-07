let {
    AWS_BUCKET_NAME: bucket, AWS_PATH: uploadPath, AWS_REGION: region,
    AWS_ACCESS_SECRET: secretAccessKey, AWS_ACCESS_KEY_ID: accessKeyId
  } = process.env;

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import parseHDR from 'parse-hdr';
import toNormals from 'geom-normals';
import screenshotter from 'canvas-screenshot';
// import { Recorder, RecorderStatus, Encoders } from 'canvas-record';
import { invert44 } from '@thi.ng/matrices/invert';
import { mulVQ } from '@thi.ng/matrices/mulv';
import { mulQ } from '@thi.ng/matrices/mulq';
import { X3 as x3, Y3 as y3, Z3 as z3 } from '@thi.ng/vectors/api';
import { set3, set4 } from '@thi.ng/vectors/set';
import { setC2, setC3, setC4 } from '@thi.ng/vectors/setc';
import { mulN2, mulN3 } from '@thi.ng/vectors/muln';
import { subN2 } from '@thi.ng/vectors/subn';
import { addN2, addN3 } from '@thi.ng/vectors/addn';
import { maddN3 } from '@thi.ng/vectors/maddn';
import { normalize3 } from '@thi.ng/vectors/normalize';
import { dist3 } from '@thi.ng/vectors/dist';
import { mixN3 } from '@thi.ng/vectors/mixn';
import { mix } from '@thi.ng/math/mix';
import { Smush32 as Random } from '@thi.ng/random';
import { color } from '@thi.ng/color/color';
import LSystem from 'lindenmayer';
import { map } from '@epok.tech/fn-lists/map';
import { reduce } from '@epok.tech/fn-lists/reduce';
import { each } from '@epok.tech/fn-lists/each';
import { range } from '@epok.tech/fn-lists/range';
import { wrap } from '@epok.tech/fn-lists/wrap';
import toTimer from '@epok.tech/fn-time';

import toCube from 'primitive-geometry/src/cube';
import toRoundedCube from 'primitive-geometry/src/rounded-cube';
import toSphere from 'primitive-geometry/src/sphere';
import toIcosphere from 'primitive-geometry/src/icosphere';
import toEllipsoid from 'primitive-geometry/src/ellipsoid';
import toCylinder from 'primitive-geometry/src/cylinder';
import toCone from 'primitive-geometry/src/cone';
import toCapsule from 'primitive-geometry/src/capsule';
import toTorus from 'primitive-geometry/src/torus';
import toTetrahedron from 'primitive-geometry/src/tetrahedron';
import toIcosahedron from 'primitive-geometry/src/icosahedron'

import * as shapeInVolume from './shape-in-volume';
import * as distort from './distort';

const api = self.x_api = {};

const {
    min, max, abs, floor, round, sqrt, sin, cos, PI: pi, TAU: tau = pi*2
  } = Math;

const axisAngleToQuat = (to, x, y, z, a) =>
  normalize3(to, setC4(to, x, y, z, cos(a *= 0.5)), sin(a));

/**
 * @see [Spherical distribution](https://observablehq.com/@rreusser/equally-distributing-points-on-a-sphere)
 */
const onSphere = (angle, depth, to = []) =>
  mulN2(to, setC3(to, cos(angle), sin(angle), depth), sqrt(1-(depth*depth)));

/** All the main inputs are passed in as query-string parameters. */
const query = api.query = new URLSearchParams(location.search);

/**
 * The string ID of the avatar distinguishes its assets in the bucket/folder.
 * Default is `id`.
 */
const id = api.id = query.get('id') ?? 'id';

/** A random seed `integer`, for deterministic random number generation. */
const seed = api.seed = parseInt(query.get('seed') ?? 0x67229302) || 0;
const random = new Random(seed);
const randomFloat = () => random.float();
const randomInt = () => random.int();

/**
 * Flag `boolean` to pause rendering when the page is blurred.
 * Default is `true`.
 */
const pauseOnBlur = api.pauseOnBlur = query.get('pause-on-blur') !== 'false';

/** The `number` level of quality of shadows, `0` to `4`. Default is `4`. */
const shadows = api.shadows = parseFloat(query.get('shadows') || 4) || 0;

const state = api.state = {
  /** Flag `boolean` to start the app in a paused state. Default is `false`. */
  pause: query.get('pause') === 'true',
  /** Flag `boolean` to animate or update instantly. Default is `true`. */
  animate: query.get('animate') !== 'false'
};

/** Flag `boolean` to capture screenshots. Default is `false`. */
const screenshots = api.screenshots = query.get('screenshots') === 'true';

/**
 * Camera `number` positions to capture screenshots from, up to 4 denoted
 * `screenshot-at-0` to `screenshot-at-3`.
 *
 * 3 `number` values per position, 1 per-axis, like
 * `screenshot-at-0=0&screenshot-at-0=1&screenshot-at-0=2`.
 *
 * To disable a position and screenshot, pass any non-`number` value.
 * Default is 4 valid camera positions.
 */
const screenshotsAt = api.screenshotsAt = ((!screenshots)? null : [
    ((query.has('screenshot-at-0'))?
        map((v) => parseFloat(v), query.getAll('screenshot-at-0'), 0)
      : [0.17, 0.19, 0.74]),
    ((query.has('screenshot-at-1'))?
        map((v) => parseFloat(v), query.getAll('screenshot-at-1'), 0)
      : [0.42, 0.26, 0.58]),
    ((query.has('screenshot-at-2'))?
        map((v) => parseFloat(v), query.getAll('screenshot-at-2'), 0)
      : [-0.78, -0.19, -0.03]),
    ((query.has('screenshot-at-3'))?
        map((v) => parseFloat(v), query.getAll('screenshot-at-3'), 0)
      : [0.09, 0.14, 0.51])
  ]
  .filter((at) => !isNaN(min(...at))));

// const records = api.records = query.get('records') === 'true';

/**
 * Flag `boolean` to upload screenshots to `S3`, or local download otherwise.
 *
 * Requires a `.env` file at the project root with valid values for:
 * - `AWS_BUCKET_NAME`
 * - `AWS_REGION`
 * - `AWS_ACCESS_SECRET`
 * - `AWS_ACCESS_KEY_ID`
 * - `AWS_PATH`
 * - `AWS_URL`
 *
 * Default is `false`.
 */
const upload = api.upload = query.get('upload') === 'true';

/** Flag `boolean` to use the anti-aliasing post-process. Default is `true`. */
const fxaa = api.fxaa = query.get('fxaa') !== 'false';

/**
 * Flag `boolean` to use the screen-space-ambient-occlusion post-process.
 * Default is `true`.
 */
const ssao = api.ssao = query.get('ssao') !== 'false';

/** Flag `boolean` to use the depth-of-field post-process. Default is `true`. */
const dof = api.dof = query.get('dof') !== 'false';

/** Flag `boolean` to use the emissive-bloom post-process. Default is `true`. */
const bloom = api.bloom = query.get('bloom') !== 'false';

/** Flag `boolean` to use the fog post-process. Default is `true`. */
const fog = api.fog = query.get('fog') !== 'false';

/**
 * The fog CSS color `string`, like `#09f` (may need `URL`-encoding).
 * Default is `#1e1e1e`.
 */
const fogColor = api.fogColor = color(query.get('fog-color') || '#1e1e1e')
  .buf.slice(0, 3);

/**
 * Distorted body flag `boolean` to calculate surface normals.
 * Default is `true`.
 */
const distortOrient = api.distortOrient =
  query.get('distort-orient') !== 'false';

/**
 * Distorted body flag `boolean` or `number` value to use cell-noise, and if so
 * which type.
 *
 * Given as `false` (uses classic noise); or a `number` (cell-noise type):
 * - `0`: nearest cell.
 * - `1`: next-nearest cell.
 * - Any other `number`: Voronoi cell (`1-0`, true boundary).
 *
 * Default is `2`, for Voronoi cell-noise.
 */
let distortCell = query.get('distort-cell') || 2;

distortCell = api.distortCell = ((distortCell !== 'false') && distortCell);

/**
 * Distorted body noise input `number` scaling values per-axis.
 * 3 values, like `distort-noise=0&distort-noise=1&distort-noise=2`.
 * Default is `4`, `4`, `4` for `x`, `y`, `z` scales.
 */
const distortNoise = api.distortNoise = ((query.has('distort-noise'))?
    map((v) => parseFloat(v) || 0, query.getAll('distort-noise'), 0)
  // : [12, 12, 1]);
  : [4, 4, 4]);

/**
 * Distorted body noise input `number` velocity values, per-axis.
 * 3 values, like `distort-speed=0&distort-speed=1&distort-speed=2`.
 */
const distortSpeed = api.distortSpeed = ((query.has('distort-speed'))?
    map((v) => parseFloat(v) || 0, query.getAll('distort-speed'), 0)
  : [0, 0, 5e-5]);

/**
 * Distorted body cell-noise `number` jitter amount.
 * No jitter at `0` gives a linear grid; full jitter at `1` gives organic cells.
 * Default is `1`.
 */
const distortJitter = api.distortJitter =
  parseFloat(query.get('distort-jitter') || 1) || 0;

/**
 * Distorted body distortion `number` amounts.
 * 4 values, like
 * `distort-surface=0&distort-surface=1&distort-surface=2&distort-surface=3`.
 *
 * Each entry denotes a different setting:
 * 1. Amount the initial surface expands (`+`) or shrinks (`-`).
 * 2. Amount to distort the surface normal.
 * 3. Amount the distorted surface expands (`+`) or shrinks (`-`).
 * 4. Threshold to make the distorted surface transparent (`+`) or opaque (`-`).
 */
const distortSurface = api.distortSurface = ((query.has('distort-surface'))?
    map((v) => parseFloat(v) || 0, query.getAll('distort-surface'), 0)
  : [1e-2, 0.1, 0.1, 0.3]);
  // : [3e-2, 0.1, 0.1, -1]);

/** Distorted body metallic `number` value for physically-based-rendering. */
const distortMetal = api.distortMetal =
  parseFloat(query.get('distort-metal') || 0.1) || 0;

/** Distorted body roughness `number` value for physically-based-rendering. */
const distortRough = api.distortRough =
  parseFloat(query.get('distort-rough') || 0.9) || 0;

/** Threshold `number` to give the distorted surface transparent gaps. */
const distortGaps = api.distortGaps =
  parseFloat(query.get('distort-gaps') || 0.08) || 0;
  // parseFloat(query.get('distort-gaps') || 0.92) || 0;

const distortCullAlias = {
  none: 'None',
  front: 'Front', back: 'Back',
  both: 'FrontAndBack', Both: 'FrontAndBack', 'front-and-back': 'FrontAndBack'
};

/**
 * Which polygon faces to cull (hide), any of:
 * - `none`/`None`: cull (hide) no faces, show all.
 * - `front`/`Front`: cull (hide) front-faces.
 * - `back`/`Back`: cull (hide) back-faces.
 * - `both`/`Both`/`front-and-back`/`FrontAndBack`: cull (hide) all faces.
 *
 * Default is `front`.
 */
let distortCull = query.get('distort-cull') || 'front';

distortCull = api.distortCull = distortCullAlias[distortCull] ?? distortCull;

/** Flag `boolean` to render the distorted body. Default is `true`. */
const bodyShow = api.bodyShow = query.get('body') !== 'false';

/**
 * Volume `number` taper ramp values, 4 values as 2 pairs:
 * - Values `0`-`1`: start-end ramp of distance from the volume surface.
 * - Values `2`-`3`: start-end ramp of equivalent scaling of shapes in volume.
 *
 * If animating, the ramp distance from the volume surface will animate in from
 * `0` to the end value.
 *
 * Default is `0`-`0.03` (ramp distance from the volume surface) and `0.15`-`1`
 * (equivalent scaling of shapes in volume).
 */
const volumeRamp = api.volumeRamp = [0, 3e-2, 0.15, 1];

/**
 * Distance `number` value to move shapes lying outside the volume back towards
 * the volume, relative to how far they lie outside it.
 * Controls how the shapes are clamped within the volume.
 * Default is `1.5`.
 */
const volumeClamp = api.volumeClamp =
  parseFloat(query.get('volume-clamp') || 1.5);

/**
 * Shape CSS color `string` range, like `#09f` (may need `URL`-encoding).
 * The 2 colors that are mixed between by the shape's color-noise field, and
 * applied to each shape.
 * 2 values, like `shape-color=red&shape-color=blue`.
 * Default is `#d17521` and `#0d1ec7`.
 */
const shapeColors = api.shapeColors = map((c) => color(c).buf,
    ((query.has('shape-color'))? query.getAll('shape-color')
      : ['#d17521', '#0d1ec7']),
  0);

/**
 * Distorted body noise input `number` scaling values per-axis.
 *
 * 4 values, like
 * `shape-color-noise=0&shape-color-noise=1&shape-color-noise=2&shape-color-noise=3`.
 *
 * Default is `5`, `5`, `5` for `x`, `y`, `z` scales; and `0.0003` time-scale.
 */
const shapeColorNoise = api.shapeColorNoise = ((query.has('shape-color-noise'))?
    map((v) => parseFloat(v), query.getAll('shape-color-noise'), 0)
  : [5, 5, 5, 3e-4]);

/** Shape metallic `number` value for physically-based-rendering. */
const shapeMetal = api.shapeMetal =
  parseFloat(query.get('shape-metal') || 0.7) || 0;

/** Shape roughness `number` value for physically-based-rendering. */
const shapeRough = api.shapeRough =
  parseFloat(query.get('shape-rough') || 0.3) || 0;

/**
 * Shape scale `number` value range, a start-end scale range the shapes vary
 * over according to their position relative to the volume.
 * 2 values, like `shape-scale=0&shape-scale=1`.
 * Default is `0.02` start scale, `0.05` end scale.
 */
const shapeScales = api.shapeScales = ((query.has('shape-scale'))?
    map((v) => parseFloat(v), query.getAll('shape-scale'), 0)
  : [2e-2, 5e-2]);

/**
 * Shape geometry `string` names to use when generating shapes.
 * Any number of values, like `shape=cube-f&shape=cone-g` and any others.
 * Default is `cube-f`, `tetrahedron-f`.
 */
const useShapes = api.useShapes = ((query.has('shape'))? query.getAll('shape')
  : ['cube-f', 'tetrahedron-f']);

/**
 * Scatter `number` of shape instances randomly before growing the L-system.
 * Default is `600`.
 */
const scatter = api.scatter = parseFloat(query.get('scatter') || 6e2) || 0;

/** Scatter flag `boolean` to use offset instances. Default is `true`. */
const scatterOffsets = api.scatterOffsets =
  query.get('scatter-offsets') !== 'false';

/**
 * Scatter flag `boolean` to use rotate instances.
 * Leave disabled to better see shapes align to the volume surface.
 * Default is `false`.
 */
const scatterRotates = api.scatterRotates =
  query.get('scatter-rotates') === 'true';

/** Scatter flag `boolean` to use scale instances. Default is `true`. */
const scatterScales = api.scatterScales =
  query.get('scatter-scales') !== 'false';

/**
 * Flag `boolean` to grow an L-system at each scattered point, or use it as a
 * single separate processes otherwise.
 *
 * Caution! Can be costly at high settings or inputs, and is combinatorially
 * explosive with scatter and grow amounts.
 *
 * Default is `true`.
 */
const scatterGrow = api.scatterGrow = query.get('scatter-grow') !== 'false';

/** Grow L-system `number` of steps to iterate. Default is `2`. */
const growSteps = api.growSteps = parseInt(query.get('grow-steps') || 2) || 0;

/** Grow L-system flag `boolean` to use offset instances. Default is `true`. */
const growOffsets = api.growOffsets = query.get('grow-offsets') !== 'false';

/**
 * Grow L-system flag `boolean` to use rotate instances.
 * Leave disabled to better see shapes align to the volume surface.
 * Default is `false`.
 */
const growRotates = api.growRotates = query.get('grow-rotates') === 'true';

/** Grow L-system flag `boolean` to use scale instances. Default is `true`. */
const growScales = api.growScales = query.get('grow-scales') !== 'false';

// Instance properties.

/**
 * Grow L-system `number` offset position to start growing from.
 *
 * 3 `number` values, 1 per-axis, like
 * `grow-offset=0&grow-offset=1&grow-offset=2`.
 *
 * Ignored if `scatter-grow` is `true`, as scattered instances are used instead.
 * Default is `-0.01`, `0.2`, `0` (in the middle of the bust's head).
 */
const growOffset = api.growOffset = ((query.has('grow-offset'))?
    map((v) => parseFloat(v), query.getAll('grow-offset'), 0)
  : [-0.01, 0.2, 0]);

/**
 * Grow L-system `number` rotation to start growing from.
 *
 * 4 `number` values, as a quaternion rotation, like
 * `grow-rotate=0&grow-rotate=1&grow-rotate=2&grow-rotate=3`.
 *
 * Ignored if `scatter-grow` is `true`, as scattered instances are used instead.
 * Default is a `y`-axis rotation (rotated to face out from the bust's head).
 */
const growRotate = api.growRotate = ((query.has('grow-rotate'))?
    map((v) => parseFloat(v), query.getAll('grow-rotate'), 0)
  : axisAngleToQuat([], ...y3, pi*0.08));

/**
 * Grow L-system `number` scale to start growing from.
 * 1 `number` value, uniform across all axes, like `grow-scale=1`.
 * Ignored if `scatter-grow` is `true`, as scattered instances are used instead.
 * Default is halfway between the `shape-scale` range.
 */
const growScale = api.growScale =
  parseFloat(query.get('grow-scale') || mix(...shapeScales, 0.5)) || 0;

// Step scales.

/**
 * Grow L-system `number` length to advance offset at each growth step.
 * Default is `0.03`.
 */
const growLength = api.growLength =
  parseFloat(query.get('grow-length') || 3e-2) || 0;

/**
 * Grow L-system `number` angle to rotate by at each growth step.
 * This value is multiplied by `pi` to convert it to an angle.
 * Default is `0.25`, giving a 45 degree angle.
 */
const growAngle = api.growAngle =
  parseFloat(query.get('grow-angle') || 0.25)*pi || 0;

// Step scale rates of change.

/**
 * Grow L-system `number` length rate to change the `grow-length` by rules.
 * The rate of change, used to either multiply or divide the step amount.
 * Default is `1.2`, giving a 20% increase or decrease any time a rule uses it.
 */
const growLengthRate = api.growLengthRate =
  parseFloat(query.get('grow-length-rate') || 1.2) || 0;

/**
 * Grow L-system `number` scale rate to change the `grow-scale` by rules.
 * The rate of change, used to either multiply or divide the step amount.
 * Default is `1.2`, giving a 20% increase or decrease any time a rule uses it.
 */
const growWidthRate = api.growWidthRate =
  parseFloat(query.get('grow-width-rate') || 1.2) || 0;

/**
 * Grow L-system `number` angle rate to change the `grow-angle` by rules.
 * Default is `1.2`, giving a 20% increase or decrease any time a rule uses it.
 */
const growAngleRate = api.growAngleRate =
  parseFloat(query.get('grow-angle-rate') || 1.2) || 0;

/**
 * L-system grow axiom and rules.
 * Original set, based on the Houdini syntax: `FHGfhJKMT+-&^\/|*~"!;_?@[]<>`.
 * URL aliases, substitutions for URL-encodings: `FHGfhJKMT -$^\/|*~"!;_.@[]<>`.
 *
 * Each rule is a character that's mapped to an instruction, and can be replaced
 * by new character by iterating the L-system growth:
 * - `F`: Move forward, creating geometry.
 * - `H`: Move forward half the length, creating geometry.
 * - `G`: Move forward but don't record a vertex.
 * - `f`: Move forward, no geometry created.
 * - `h`: Move forward a half length, no geometry created.
 * - `J`: Copy geometry from leaf `J` at the turtle's position.
 * - `K`: Copy geometry from leaf `K` at the turtle's position.
 * - `M`: Copy geometry from leaf `M` at the turtle's position.
 * - `T`: Apply tropism vector (gravity).
 * - `+` (URL alias ` `): Turn right by angle.
 * - `-`: Turn left by angle.
 * - `&` (URL alias `$`): Pitch down by angle.
 * - `^`: Pitch up by angle.
 * - `\\`: Roll clockwise by angle.
 * - `/`: Roll counter-clockwise by angle.
 * - `|`: Turn back.
 * - `*`: Roll over.
 * - `~`: Pitch/roll/turn random amount up to angle.
 * - `"`: Multiply current length by step size scale.
 * - `!`: Multiply current width by thickness scale.
 * - `;`: Multiply current angle by angle scale.
 * - `_`: Divide current length by step size scale.
 * - `?` (URL alias `.`): Divide current width by thickness scale.
 * - `@`: Divide current angle by angle scale.
 * - `[`: Push turtle state (start a branch).
 * - `]`: Pop turtle state (end a branch).
 * - `<`: Check left context.
 * - `>`: Check right context.
 *
 * @see [3D interactive demo](https://github.com/nylki/lindenmayer/blob/main/docs/examples/interactive_lsystem_builder/index_3d.html)
 * @see [Houdini L-system syntax](https://www.sidefx.com/docs/houdini/nodes/sop/lsystem.html)
 * @see [Houdini L-system recipes](https://www.houdinikitchen.net/2019/12/21/how-to-create-l-systems/)
 */

const ruleURL = (rule) =>
  rule.replace(` `, `+`).replace(`$`, `&`).replace(`.`, `?`);

/**
 * Grow L-system `string` axiom rule, to start the L-system growth to be
 * replaced according to the `grow-rules`.
 * Default is `^^A`.
 *
 * @see Full L-system grow-rules for their meaning.
 */
const growAxiom = api.growAxiom = ruleURL(query.get('grow-axiom') ?? '^^A');

/**
 * Grow L-system `string` production rules, to iterate the L-system growth by
 * replacing the `grow-axiom`.
 * Any number of values, like `grow-rule=A->FA&grow-rule=F->AF` and any others.
 * Default is `A->M[F"![^A&&A]-A++A]`, growing a simple concentric form.
 *
 * @see Full L-system grow-rules for their meaning.
 */
const growRules = api.growRules = ((query.has('grow-rule'))?
    map(ruleURL, query.getAll('grow-rule'), 0)
  : [
        // Tree (c) by edge-rewriting from Houdini Kitchen.
        // 'F->F[+F]F[-F]F',
        // Variations...
        // 'F->F[_?@\\&+F]F[_?@/^-F]F',
        // 'A->MF'

        // Tree (e) by node-rewriting from Houdini Kitchen.
        // 'A->F[+A][-A]FA',
        // 'A->MF',
        // Variations...
        // 'F->/F[+A]\\f[-A]F',
        // 'F->fMfM',

        // Tree (f) by node-rewriting from Houdini Kitchen.
        // 'A->F-[[A]+A]+F[+FA]-A',
        // 'A->MF',

        // Concentric by Shadi.
        // 'A->[F"![^A&&A]-A++A]',
        // Variations...
        'A->M[F"![^A&&A]-A++A]',

        // Tree by Shadi.
        // 'A->-F+!A:0.40',
        // 'A->+F-!A:0.40',
        // 'A->~(30)[--"A]A:0.1',
        // 'A->~(30)[++"A]A:0.1',
    ]);

/** Eye `number` scale, uniform across all axes. Default is `0.03`. */
const eyeScale = api.eyeScale =
  range(3, parseFloat(query.get('eye-scale') || 3e-2) || 0);

/** Eye `number` intensity of light emitted. Default is `0.2`. */
const eyeIntense = api.eyeIntense =
  parseFloat(query.get('eye-intense') || 0.2) || 0;

/** Eye `number` alpha transparency. Default is `0.6`. */
const eyeAlpha = api.eyeAlpha = parseFloat(query.get('eye-alpha') || 0.6) || 0;

/**
 * Eye CSS color `string`, like `#09f` (may need `URL`-encoding).
 * Color of the eye shape and the light it emits.
 * Default is `#fff` (white).
 */
const eyeColor = api.eyeColor = color(query.get('eye-color') || '#fff').buf;

/** Eye `number` emissive color, scales `eye-color`. Default is `2`. */
const eyeEmit = api.eyeEmit = parseFloat(query.get('eye-emit') || 2) || 0;

/**
 * Eye `number` positions, up to 2 denoted `eye-l` and `eye-r`.
 *
 * 3 `number` values per position, 1 per-axis, like
 * `eye-l=0&eye-l=1&eye-l=2` and `eye-r=3&eye-r=4&eye-r=5`.
 *
 * To disable an eye, pass any non-`number` value.
 * Default is 2 valid eye positions.
 */
const eyesAt = api.eyesAt = [
    ((query.has('eye-l'))? map((v) => parseFloat(v), query.getAll('eye-l'), 0)
      : [-0.022, 0.106, 0.158]),
    ((query.has('eye-r'))? map((v) => parseFloat(v), query.getAll('eye-r'), 0)
      : [0.065, 0.11, 0.135])
  ]
  .filter((at) => !isNaN(min(...at)));

/**
 * Lights `number` positions, up to 4 denoted `lit-at-0` to `lit-at-3`.
 *
 * 3 `number` values per position, 1 per-axis, like
 * `lit-at-0=0&lit-at-0=1&lit-at-0=2`.
 *
 * To disable a light, pass any non-`number` value.
 * Default is 4 valid light positions.
 */
const lightsAt = api.lightsAt = [
    ((!query.has('lit-at-0'))? [-1, -1, -1]
      : map((v) => parseFloat(v), query.getAll('lit-at-0'), 0)),
    ((!query.has('lit-at-1'))? [-1, 1, 1]
      : map((v) => parseFloat(v), query.getAll('lit-at-1'), 0)),
    ((!query.has('lit-at-2'))? [1, -1, -1]
      : map((v) => parseFloat(v), query.getAll('lit-at-2'), 0)),
    ((!query.has('lit-at-3'))? [1, 1, 1]
      : map((v) => parseFloat(v), query.getAll('lit-at-3'), 0))
  ]
  .filter((at) => !isNaN(min(...at)));

/**
 * Lights CSS color `string` values, like `#09f` (may need `URL`-encoding), up
 * to 4 denoted `lit-color-0` to `lit-color-3`, like
 * `lit-color-0=red&lit-color-1=blue&lit-color-2=green&lit-color-3=white`.
 * To disable a light, pass a value resulting in black.
 * Default is 4 light colors.
 */
const lightsColor = api.lightsColor = [
  color(query.get('lit-color-0') || '#00f').buf,
  color(query.get('lit-color-1') || '#00f').buf,
  color(query.get('lit-color-2') || '#f0f').buf,
  color(query.get('lit-color-3') || '#f0f').buf
];

// For `pex-renderer`'s `gltf` loader to play nicely with `parcel`'s asset hash.
const gltfURL = (url) => url.href.replace(/\?.*$/, '');

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey }
});

async function toS3(to, at, type) {
  const c = { Bucket: bucket, Key: uploadPath+at, Body: to, ContentType: type };

  try { console.log('S3 uploaded', c, await s3.send(new PutObjectCommand(c))); }
  catch(e) { console.warn('S3 error', c, e); }
}

(async () => {
  const $canvas = api.$canvas = document.querySelector('canvas');

  const context = api.context =
    getContext({ canvas: $canvas, preserveDrawingBuffer: true });

  const renderer = api.renderer =
    getRenderer({ ctx: context, pauseOnBlur, shadowQuality: shadows });

  // console.log('pipeline', renderer.shaders.pipeline);

  const timer = api.timer = toTimer({ step: 1e3/60, loop: 1e8 });

  const { skyHDR, volumeImg } = await load({
    skyHDR: { arrayBuffer: new URL('../media/sky-0.hdr', import.meta.url)+'' },
    volumeImg: { image: new URL('../media/volume-sdf.png', import.meta.url)+'' }
  });

  /** @see [Limnu on blending](https://limnu.com/webgl-blending-youre-probably-wrong/) */
  const blend = api.blend = {
    blend: true,
    blendSrcRGBFactor: context.BlendFactor.One,
    blendDstRGBFactor: context.BlendFactor.OneMinusSrcAlpha,
    blendSrcAlphaFactor: context.BlendFactor.One,
    blendDstAlphaFactor: context.BlendFactor.OneMinusSrcAlpha
  };

  const camera = api.camera = renderer.camera({
    fov: pi*0.5, near: 1e-2, far: 1e2, fStop: 1.6, sensorFit: 'overscan',
    exposure: 0
  });

  const ease = api.ease = {
    eps: 1e-4,
    orbit: 5e-2, dof: 3e-2, exposure: 3e-2, surface: 2e-2, light: 5e-2
  };

  const easeNone = api.easeNone =
    { eps: 0, orbit: 1, dof: 1, exposure: 1, surface: 1, light: 1 };

  const orbit = api.orbit = renderer.orbiter({
    position: [-0.1, -0.1, 0], target: [0, 0.1, 0.25],
    element: $canvas, minDistance: 0.2, maxDistance: 1.5, easing: easeNone.orbit
  });

  const post = api.post = renderer.postProcessing({
    fxaa, ssao,
    dof, dofFocusDistance: orbit.minDistance*0.5,
    bloom, bloomThreshold: 1, bloomRadius: 0.5,
    fog, fogColor, fogDensity: 0.3, fogStart: orbit.minDistance,
    inscatteringCoeffs: range(3, 0.3)
  });

  const viewer = api.viewer =
    renderer.add(renderer.entity([camera, orbit, post]));

  const orbitTo = {};

  orbit.update();
  orbitTo.matrix = orbit.matrix;
  orbitTo.lat = orbit.lat;
  orbitTo.lon = orbit.lon;
  orbitTo.distance = orbit.distance;
  orbitTo.currentLat = orbit.currentLat;
  orbitTo.currentLon = orbit.currentLon;
  orbitTo.currentDistance = orbit.currentDistance;

  const skyHDRData = api.skyHDRData = parseHDR(skyHDR);
  const { data: skyData, shape: [skyW, skyH] } = skyHDRData;

  const skyTexture = api.skyTexture = context.texture2D({
    data: skyData, width: skyW, height: skyH, flipY: true,
    pixelFormat: context.PixelFormat.RGBA32F, encoding: context.Encoding.Linear
  });

  const backgroundTexture = api.backgroundTexture =
    context.texture2D({ data: [...fogColor, 1], width: 1, height: 1 });

  const skybox = api.skybox =
    renderer.skybox({ texture: skyTexture, backgroundTexture });

  const reflector = api.reflector = renderer.reflectionProbe();

  const environment = api.environment =
    renderer.add(renderer.entity([skybox, reflector]));

  environment.transform
    .set({ rotation: mulN3(null, [0, 1, 0, cos(pi*0.5)], sin(pi*0.5)) });

  const volume = api.volume = renderer.add(renderer.entity());
  const volumeTexture = api.volumeTexture = context.texture2D(volumeImg);

  volume.transform.set({ scale: range(3, 1.3) });

  const volumeBounds = api.volumeBounds = [
    { radius: 0.38, centre: [0, -0.19, -0.05] },
    { radius: 0.23, centre: [-0.01, 0.25, 0.07] }
  ];

  const gltfOptions = { enabledCameras: null };
  const toScene = (u) => renderer.loadScene(gltfURL(u), gltfOptions);

  const body = api.body = await toScene(new URL('../media/humanoid.glb',
    import.meta.url));

  // console.log('distort.vert', distort.vert);
  // console.log('distort.frag', distort.frag);

  const distortPre = api.distortPre =
    ((distortOrient)? '#define x_orientToField\n' : '')+
    ((distortCell !== false)? `#define x_cellNoise ${distortCell}\n` : '');

  const bodyMaterialState = api.bodyMaterialState = {
    vert: distortPre+distort.vert, frag: distortPre+distort.frag,
    uniforms: {
      x_distortNoise: distortNoise,
      x_distortSpeed: distortSpeed,
      x_distortJitter: distortJitter,
      x_distortSurface: distortSurface,
      x_distortNormal: 1e-5,
      x_time: range(3)
    },
    metallic: distortMetal, roughness: distortRough,
    castShadows: !!shadows, receiveShadows: !!shadows,
    // @todo Improve alpha blending and face-culling issues.
    alphaTest: distortGaps,
    ...blend,
    cullFace: distortCull !== 'None',
    cullFaceMode: context.Face[distortCull] ?? context.Face.FrontAndBack
  };

  body.entities.forEach((e) => e.getComponent('Material') &&
    e.addComponent(renderer.material(bodyMaterialState)));

  body.root.transform
    .set({ scale: range(3, 1.2), position: [0, -0.32, 0], enabled: bodyShow });

  renderer.add(body.root, volume);

  const toShapes = api.toShapes = map(([k, f], i, a, to) => to[k] = f,
    [
      ['cube-g', toCube],
      ['rounded-cube-g', toRoundedCube],
      ['sphere-g', toSphere],
      ['icosphere-g', toIcosphere],
      ['ellipsoid-g', toEllipsoid],
      ['cylinder-g', toCylinder],
      ['cone-g', toCone],
      ['capsule-g', toCapsule],
      ['torus-g', toTorus],
      ['tetrahedron-g', toTetrahedron],
      ['icosahedron-g', toIcosahedron],
      ['cube-f', () => toScene(new URL('../media/cube.glb', import.meta.url))],
      [
        'tetrahedron-f',
        () => toScene(new URL('../media/tetrahedron.glb', import.meta.url))
      ],
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      [
        'icosahedron-f',
        () => toScene(new URL('../media/icosahedron.glb', import.meta.url))
      ],
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      [
        'sphere-f',
        () => toScene(new URL('../media/sphere.glb', import.meta.url))
      ],
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      [
        'octahedron-f',
        () => toScene(new URL('../media/octahedron.glb', import.meta.url))
      ],
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      [
        'soccer-f',
        () => toScene(new URL('../media/soccer.glb', import.meta.url))
      ],
      // @todo Why is this not appearing?
      [
        'dodecahedron-f',
        () => toScene(new URL('../media/dodecahedron.glb', import.meta.url))
      ]
    ],
    {});

  const shapes = api.shapes = map((s) =>
      ((s.root)? s : { root: renderer.entity([renderer.geometry(s)]) }),
    await Promise.all(map((s) => toShapes[s](), useShapes)), 0);

  const shapeTo = api.shapeTo = { volumeClamp };

  // console.log('shapeInVolume.vert', shapeInVolume.vert);
  // console.log('shapeInVolume.frag', shapeInVolume.frag);

  const shapeMaterialState = api.shapeMaterialState = {
    // ...shapeInVolume,
    vert: '#define x_orientToVolume\n#define x_clampToVolume\n'+
      shapeInVolume.vert,
    frag: shapeInVolume.frag,
    uniforms: {
      x_volumeTexture: volumeTexture,
      x_volumeTile: [8, 8],
      x_volumeInverse: [],
      // Starting the ramp off below 0, to grow the shapes in over time.
      x_volumeRamp: addN2(null, [...volumeRamp], -volumeRamp[1]),
      x_volumeSurface: [0.1, -shapeTo.volumeClamp*1.5],
      x_colors: shapeColors,
      x_colorNoise: shapeColorNoise,
      x_time: range(3)
    },
    metallic: shapeMetal, roughness: shapeRough,
    castShadows: !!shadows, receiveShadows: !!shadows,
    ...blend
  };

  const instancesAll = api.instancesAll = { instances: 0 };

  const instancesShapes = api.instancesShapes =
    map(() => ({ ...instancesAll }), shapes);

  const instanced = api.instanced = (instances, at, to) =>
    (instances[at] ??= { data: to ?? [], divisor: 1 }).data;

  scatter && reduce((all, _, i, a) => {
      const to = wrap(randomInt(), instancesShapes);

      if(scatterOffsets) {
        const { radius, centre } = wrap(randomInt(), volumeBounds);

        instanced(to, 'offsets').push(instanced(all, 'offsets', a)[i] =
          maddN3(null, onSphere(randomFloat()*tau, mix(-1, 1, randomFloat())),
            (randomFloat()**0.6)*radius, centre));
      }

      scatterRotates &&
        instanced(to, 'rotations').push(instanced(all, 'rotations')[i] =
          axisAngleToQuat(null,
            randomFloat(), randomFloat(), randomFloat(), randomFloat()*tau));

      scatterScales &&
        instanced(to, 'scales').push(instanced(all, 'scales')[i] =
          range(3, mix(...shapeScales, randomFloat())));

      ++all.instances;
      ++to.instances;

      return all;
    },
    range(scatter), instancesAll);

  const grow = api.grow = {
    instances: { all: instancesAll, shapes: instancesShapes },
    // Current "turtle" state.
    at: {
      // Instance target.
      shape: 0,
      // Instance properties.
      offset: [...growOffset],
      rotation: [...growRotate],
      scale: range(3, growScale),
      // Step scales.
      length: growLength,
      width: growScale,
      angle: growAngle,
      // Step scale rates of change.
      lengthRate: growLengthRate,
      widthRate: growWidthRate,
      angleRate: growAngleRate,
      // Derived steps.
      ahead: undefined,
      yawR: undefined, yawL: undefined,
      pitchD: undefined, pitchU: undefined,
      rollCW: undefined, rollCCW: undefined
    },
    turnBack: axisAngleToQuat([], ...y3, pi),
    rollOver: axisAngleToQuat([], ...z3, pi),
    toInstance(to, shape, offset, rotation, scale) {
      const { at, instances, toScale, toRotation, toOffset } = to;
      const { all, shapes } = instances;
      const s = to.shape = wrap(shape ??= at.shape, shapes);

      if(growOffsets && (offset ??= toOffset(to)?.slice?.())) {
        let near;

        // Distance outside the nearest volume.
        const d = reduce((d, b) => {
            const { radius: r, centre: c } = b;

            (d > (d = dist3(offset, c)-r)) && (near = b);

            return d;
          },
          volumeBounds, Infinity);

        // Wrap inside the nearest volume.
        if(near && (d > 0)) {
          const { centre: nc, radius: nr } = near;

          mixN3(null, offset, nc, (d+nr+nr)/(d+nr));
        }

        instanced(all, 'offsets').push(offset);
        instanced(s, 'offsets').push(offset);
      }

      growRotates && (rotation ??= toRotation(to)?.slice?.()) &&
        instanced(all, 'rotations').push(rotation) &&
        instanced(s, 'rotations').push(rotation);

      growScales && (scale ??= toScale(to)?.slice?.()) &&
        instanced(all, 'scales').push(scale) &&
        instanced(s, 'scales').push(scale);

      ++all.instances;
      ++s.instances;

      return s;
    },
    toOffset: ({ at: { offset: o, length: l, ahead } }, by = 0, size = l) =>
      ((by)? maddN3(o, ahead, by*size, o) : o),
    toScale: ({ at: { scale: s, width: w } }, by = 1, size) =>
      mulN3(s, setC3(s, 1, 1, 1), by*(size ??= w)),
    toRotation: ({ at, at: { rotation: r, ahead: h = at.ahead ??= [] } }, by) =>
      mulVQ(h, ((by)? mulQ(r, r, by) : r), z3) && r,
    toLength: ({ at }, by = 1) => at.length *= by,
    toWidth: ({ at }, by = 1) => at.width *= by,
    toAngle({ at }, by = 1) {
      const { yawL, yawR, pitchD, pitchU, rollCW, rollCCW } = at;
      let { angle } = at;
      const d = (angle !== (angle = (at.angle *= by)));

      (d || !yawR) && axisAngleToQuat(at.yawR ??= [], ...y3, -angle);
      (d || !yawL) && axisAngleToQuat(at.yawL ??= [], ...y3, angle);
      (d || !pitchD) && axisAngleToQuat(at.pitchD ??= [], ...x3, -angle);
      (d || !pitchU) && axisAngleToQuat(at.pitchU ??= [], ...x3, angle);
      (d || !rollCW) && axisAngleToQuat(at.rollCW ??= [], ...z3, -angle);
      (d || !rollCCW) && axisAngleToQuat(at.rollCCW ??= [], ...z3, angle);
    },
    setup(to) {
      to.toAngle(to);
      to.toLength(to);
      to.toWidth(to);
      to.toRotation(to);
      to.toOffset(to);
      to.toScale(to);
    },
    branches: []
  };

  const growFinals = grow.finals = {
    /**
     * @see [3D interactive demo](https://github.com/nylki/lindenmayer/blob/main/docs/examples/interactive_lsystem_builder/index_3d.html)
     * @see [Houdini L-system syntax](https://www.sidefx.com/docs/houdini/nodes/sop/lsystem.html)
     * @see [Houdini L-system recipes](https://www.houdinikitchen.net/2019/12/21/how-to-create-l-systems/)
     */
    /** Move forward, creating geometry. */
    F: (i, to) => to.toOffset(to, 1, i.part.size) && to.toInstance(to),
    /** Move forward half the length, creating geometry. */
    H: (i, to) => to.toOffset(to, 0.5, i.part.size) && to.toInstance(to),
    /** Move forward but don't record a vertex. */
    G: (...etc) => console.warn('Grow L-system `G` final unused', ...etc),
    /** Move forward, no geometry created. */
    f: (i, to) => to.toOffset(to, 1, i.part.size),
    /** Move forward a half length, no geometry created. */
    h: (i, to) => to.toOffset(to, 0.5, i.part.size),
    /** Copy geometry from leaf `J` at the turtle's position. */
    J: (i, to) => to.toInstance(to, i.part.shape ?? 0),
    /** Copy geometry from leaf `K` at the turtle's position. */
    K: (i, to) => to.toInstance(to, i.part.shape ?? 1),
    /** Copy geometry from leaf `M` at the turtle's position. */
    M: (i, to) => to.toInstance(to, i.part.shape ?? randomInt()),
    /** Apply tropism vector (gravity). */
    T: (...etc) => console.warn('Grow L-system `T` final unused', ...etc),
    /** Turn right by angle. */
    '+': (i, to) => to.toRotation(to, i.part.by ?? to.at.yawR),
    /** Turn left by angle. */
    '-': (i, to) => to.toRotation(to, i.part.by ?? to.at.yawL),
    /** Pitch down by angle. */
    '&': (i, to) => to.toRotation(to, i.part.by ?? to.at.pitchD),
    /** Pitch up by angle. */
    '^': (i, to) => to.toRotation(to, i.part.by ?? to.at.pitchU),
    /** Roll clockwise by angle. */
    '\\': (i, to) => to.toRotation(to, i.part.by ?? to.at.rollCW),
    /** Roll counter-clockwise by angle. */
    '/': (i, to) => to.toRotation(to, i.part.by ?? to.at.rollCCW),
    /** Turn back. */
    '|': (i, to) => to.toRotation(to, i.part.by ?? to.turnBack),
    /** Roll over. */
    '*': (i, to) => to.toRotation(to, i.part.by ?? to.rollOver),
    /** Pitch/roll/turn random amount up to angle. */
    '~': (...etc) => console.warn('Grow L-system `~` final unused', ...etc),
    /** Multiply current length by step size scale. */
    '"': (i, to) => to.toLength(to, i.part.by ?? to.at.lengthRate),
    /** Multiply current width by thickness scale. */
    '!': (i, to) => to.toWidth(to, i.part.by ?? to.at.widthRate),
    /** Multiply current angle by angle scale. */
    ';': (i, to) => to.toAngle(to, i.part.by ?? to.at.angleRate),
    /** Divide current length by step size scale. */
    _: (i, to) => to.toLength(to, i.part.by ?? 1/to.at.lengthRate),
    /** Divide current width by thickness scale. */
    '?': (i, to) => to.toWidth(to, i.part.by ?? 1/to.at.widthRate),
    /** Divide current angle by angle scale. */
    '@': (i, to) => to.toAngle(to, i.part.by ?? 1/to.at.angleRate),
    /** Push turtle state (start a branch). */
    '[': (_, to) => {
      const { at, toOffset: o, toRotation: r, toScale: s, branches } = to;

      branches.push({
        ...at,
        ahead: undefined,
        yawR: undefined, yawL: undefined,
        pitchD: undefined, pitchU: undefined,
        rollCW: undefined, rollCCW: undefined,
        offset: [...o(to)], rotation: [...r(to)], scale: [...s(to)]
      });
    },
    /** Pop turtle state (end a branch). */
    ']': (_, to) => {
      const { branches, setup } = to;

      to.at = branches.pop();
      setup(to);
    }
  };

  const growSystem = grow.system = new LSystem({
    // forceObjects: true,
    finals: growFinals,
    productions: reduce((productions, r) => {
        const [at, to] = r.split(/(?:=|(?:->))/);

        productions[at] = to;

        return productions;
      },
      growRules, {})
  });

  const growRun = grow.run = (offset, rotation, scale) => {
    const { offset: o, rotation: r, scale: s } = grow.at;

    offset && set3(o, offset);
    rotation && set4(r, rotation);
    (scale || (scale === 0)) && setC3(s, scale, scale, scale);
    growSystem.setAxiom(growAxiom);
    grow.setup(grow);
    console.log(growSystem.axiom, growRules, growSystem.productions);
    console.log(growSystem.iterate(growSteps));
    growSystem.final(grow);
  };

  ((!scatterGrow)? growRun()
  : each((offset, i) =>
        growRun(offset,
          instanced(instancesAll, 'rotations')[i],
          instanced(instancesAll, 'scales')[i]),
      instanced(instancesAll, 'offsets')));

  const shapeRoot = api.shapeRoot = renderer.add(renderer.entity());

  shapes.forEach(({ root, entities }, s) => {
    const shapeInstances = instancesShapes[s];

    if(!shapeInstances.instances) { return; }

    function setup(e) {
      const g = e.getComponent('Geometry');

      if(!g) { return e; }

      const m = e.getComponent('Material');

      m && e.removeComponent(m);
      e.addComponent(renderer.material(shapeMaterialState));
      g.set(shapeInstances);

      // @todo Need `positions` and `cells` arrays, but have write-only buffers.
      // if(g.normals) { return; }

      // const { positions, indices: cells } = g;

      // g.set({ normals: toNormals(positions, cells) });

      return e;
    }

    entities?.forEach?.(setup);
    renderer.add(setup(root), shapeRoot);
  });

  const eyesTo = api.eyesTo = { scale: eyeScale, intensity: eyeIntense };

  const eyes = api.eyes = map((position) => renderer.add(renderer.entity([
        renderer.transform({ position, scale: range(3, 0) }),
        renderer.geometry(toSphere()),
        renderer.material({
          ...blend, opacity: eyeAlpha,
          emissiveColor: mulN3(null, [...eyeColor], eyeEmit)
        }),
        renderer.pointLight({
          color: eyeColor, intensity: 0, range: 1, castShadows: !!shadows
        })
      ]),
      volume),
    eyesAt, 0);

  const pointLights = api.pointLights = map((position, i) => {
      const color = lightsColor[i];

      return renderer.add(renderer.entity([
        renderer.pointLight({ intensity: 9, castShadows: !!shadows, color }),
        renderer.transform({ position, enabled: max(...color) > 0 })
      ]))
    },
    lightsAt, 0);

  const toRecord = () => {};

  // const tick = async () => {
  //   render();

  //   if(canvasRecorder.status !== RecorderStatus.Recording) return;
  //   await canvasRecorder.step();

  //   if(canvasRecorder.status !== RecorderStatus.Stopped) {
  //     requestAnimationFrame(() => tick());
  //   }
  // };

  // canvasRecorder = new Recorder(context,
  //   { name: `avatar-${(new Date()).toISOString()}.mp4` });

  // // Start and encode frame 0
  // await canvasRecorder.start();

  // // Animate to encode the rest
  // tick(canvasRecorder);

  const draw = api.draw = () => {
    const { pause, animate } = state;

    if(pause) { return; }

    const { eps, dof: ed, exposure: ee, surface: es, light: el } =
      ((animate)? ease : easeNone);

    const hus = bodyMaterialState.uniforms;
    const { x_time: ht } = hus;
    const sus = shapeMaterialState.uniforms;
    const { x_time: st, x_volumeRamp, x_volumeSurface, x_volumeInverse } = sus;
    const { time, dt, loop } = ((animate)? toTimer(timer) : timer);

    set3(ht, setC3(st, time, dt, abs(((time+loop)%(loop*2))-loop)));

    const [rampMin] = x_volumeRamp;

    (0-rampMin > eps) && addN2(null, x_volumeRamp, mix(rampMin, 0, es)-rampMin);

    const skin = x_volumeSurface[1];
    const skinTo = shapeTo.volumeClamp;

    (abs(skin-skinTo) > eps) && (x_volumeSurface[1] = mix(skin, skinTo, es));

    const volumeTransform = volume.transform;

    volumeTransform.update();
    invert44(x_volumeInverse, volumeTransform.modelMatrix);

    const dof = post.dofFocusDistance;
    const d = orbit.distance;

    (abs(dof-d) > eps) && post.set({ dofFocusDistance: mix(dof, d, ed) });

    const expose = camera.exposure;

    (abs(expose-1) > eps) && camera.set({ exposure: mix(expose, 1, ee) });

    const { scale: eyeS, intensity: eyeI } = eyesTo;

    each((eye) => {
        const t = eye.transform;
        const s = t.scale;
        const pl = eye.getComponent('PointLight');
        const i = pl.intensity;

        (abs(max(...eyeS)-max(...s)) > eps) &&
          t.set({ scale: mixN3(null, s, eyeS, el) });

        (abs(eyeI-i) > eps) && pl.set({ intensity: mix(i, eyeI, el) });
      },
      eyes);

    renderer.draw();
  };

  const resize = api.resize = (drew) => {
    const { innerWidth: width, innerHeight: height } = self;
    const { pixelRatio: pr } = context;

    context.set({ width, height });
    camera.set({ viewport: [0, 0, width*pr, height*pr] });

    context.frame(() => {
      draw();
      drew?.();

      // Draw only one frame.
      return false;
    });
  };

  const resized = new Promise((y) => resize(y));

  addEventListener('resize', () => resize());

  /** @todo Fix broken first image, never seems to be in the right place. */
  const screenshot = api.screenshot = (to, p = id, s = '@', type = 'png') =>
    new Promise((y) => context.frame(() => {
      const { animate } = state;
      const at = (new Date()).toISOString().replace(/(:|\.)/gi, '-');

      if(to) {
        state.animate = false;
        orbit.set(to);
        orbit.update();
      }

      draw();
      state.animate = animate;

      const filename = `${p}-${at}-${s}.${type}`;
      const shot = screenshotter($canvas, { filename, download: !upload });

      /** `POST` screens to the bucket with info in the gitignored `.env`. */
      upload && toS3(shot, filename, 'image/'+type);
      y(shot);

      // Draw only one frame.
      return false;
    }));

  await ((!screenshots)? resized
    : screenshotsAt.reduce((wait, at, i) =>
          wait.then(() => screenshot({ position: at }, id, i)),
        resized));

  addEventListener('keyup', ({ key: k }) =>
    ((k === 'f')? $canvas.requestFullscreen()
    : ((k === ' ')? (state.pause = !state.pause)
    : ((k === 's')? screenshot()
    : ((k === 'r') && toRecord())))));

  orbit.set({ ...orbitTo });
  orbit.update();

  orbit.set({
    easing: ((state.animate)? ease : easeNone).orbit,
    lat: 10, lon: -70,
    distance: mix(orbit.minDistance, orbit.maxDistance, 0.25)
  });

  context.frame(draw);
})();
