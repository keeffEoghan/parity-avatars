import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import parseHDR from 'parse-hdr';
import toNormals from 'geom-normals';
import { invert44 } from '@thi.ng/matrices/invert';
import { mulVQ } from '@thi.ng/matrices/mulv';
import { mulQ } from '@thi.ng/matrices/mulq';
import { X3 as x3, Y3 as y3, Z3 as z3 } from '@thi.ng/vectors/api';
import { set3 } from '@thi.ng/vectors/set';
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

const {
    min, max, abs, floor, round, sqrt, sin, cos, PI: pi, TAU: tau = pi*2
  } = Math;

const query = new URLSearchParams(location.search);

const pauseOnBlur = (query.get('pause-on-blur') !== 'false');
const shadows = parseInt(query.get('shadows') || 4, 10) || 0;
const animate = (query.get('animate') !== 'false');
const scatter = parseInt(query.get('scatter') || 1e3, 10) || 0;

const growSteps = parseInt(query.get('grow-steps') || 6, 10) || 0;
const growAxiom = query.get('grow-axiom') ?? '[!A]^^MAfF[&"!A]f[&"!A]AM[!!ffA]';

const growRules = ((query.has('grow-rule'))? query.getAll('grow-rule')
  : [
        // Concentric.
        // 'A->[fM"![^A&&A]-A++A]',
        'A->;\\F[fM_?[^@@A&&@@A]-A++A]',
        // 'M->[F_?[^M&&M]-M++M]',
        // 'M->[F_?[^[fM]&&[fM]]-[fM]++[fM]]',
        // M: [{ symbol: 'M', test: 1 }],
        // Tree.
        // 'M->-F+!M:0.40',
        // 'M->+F-!M:0.40',
        // 'M->~(30)[--"M]M:0.1',
        // 'M->~(30)[++"M]M:0.1',
    ]);

const random = new Random(parseInt(query.get('seed') ?? '0x67229302'));
const randomFloat = () => random.float();
const randomInt = () => random.int();

const axisAngleToQuat = (to, x, y, z, a) =>
  normalize3(to, setC4(to, x, y, z, cos(a *= 0.5)), sin(a));

// For `pex-renderer`'s `gltf` loader to play nicely with `parcel`'s asset hash.
const gltfURL = (url) => url.href.replace(/\?.*$/, '');

(async () => {
  const canvas = document.querySelector('canvas');
  const context = getContext({ canvas });

  const renderer = getRenderer({
    ctx: context, pauseOnBlur, shadowQuality: shadows
  });

  const pipelineShaders = renderer.shaders.pipeline;
  const timer = toTimer({ step: '-', loop: 1e8 });

  // console.log('pipeline', pipelineShaders);

  const { skyHDR, volumeImg } = await load({
    skyHDR: { arrayBuffer: new URL('../media/sky-0.hdr', import.meta.url)+'' },
    volumeImg: { image: new URL('../media/volume-sdf.png', import.meta.url)+'' }
  });

  const gltfLoading = { enabledCameras: null };

  const scenes = await Promise.all(map((u) =>
      renderer.loadScene(gltfURL(u), gltfLoading),
    [
      new URL('../media/humanoid.glb', import.meta.url),
      new URL('../media/cube.glb', import.meta.url),
      new URL('../media/tetrahedron.glb', import.meta.url),
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      // new URL('../media/icosahedron.glb', import.meta.url),
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      // new URL('../media/sphere.glb', import.meta.url),
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      // new URL('../media/octahedron.glb', import.meta.url),
      // @todo Why is this white? Might be broken normals, tangents, even UVs?
      // new URL('../media/soccer.glb', import.meta.url),
      // @todo Why is this not appearing?
      // new URL('../media/dodecahedron.glb', import.meta.url)
    ],
    0));

  /** @see [Limnu on blending](https://limnu.com/webgl-blending-youre-probably-wrong/) */
  const blend = {
    blend: true,
    blendSrcRGBFactor: context.BlendFactor.One,
    blendDstRGBFactor: context.BlendFactor.OneMinusSrcAlpha,
    blendSrcAlphaFactor: context.BlendFactor.One,
    blendDstAlphaFactor: context.BlendFactor.OneMinusSrcAlpha
  };

  const camera = renderer.camera({
    fov: pi*0.5, near: 1e-2, far: 1e2, fStop: 1.6, sensorFit: 'overscan',
    exposure: 0
  });

  const ease = ((animate)? {
        eps: 1e-4,
        orbit: 5e-2, dof: 3e-2, exposure: 3e-2, surface: 2e-2, light: 5e-2
      }
    : { eps: 0, orbit: 1, dof: 1, exposure: 1, surface: 1, light: 1 });

  const orbit = renderer.orbiter({
    element: canvas, target: [0, 0.1, 0.25], position: [-0.1, -0.1, 0],
    minDistance: 0.2, maxDistance: 1.5, easing: ease.orbit
  });

  const fog = range(3, 30/255);

  const post = renderer.postProcessing({
    fxaa: true, ssao: true,
    dof: true, dofFocusDistance: orbit.minDistance*0.5,
    bloom: true, bloomThreshold: 1, bloomRadius: 0.5,
    fog: true, fogColor: fog, fogDensity: 0.3, fogStart: orbit.minDistance,
    inscatteringCoeffs: range(3, 0.3)
  });

  const viewer = renderer.entity([camera, orbit, post]);

  renderer.add(viewer);

  const skyHDRData = parseHDR(skyHDR);
  const { data: skyData, shape: [skyW, skyH] } = skyHDRData;

  const skyTexture = context.texture2D({
    data: skyData, width: skyW, height: skyH, flipY: true,
    pixelFormat: context.PixelFormat.RGBA32F, encoding: context.Encoding.Linear
  });

  const backgroundTexture = context
    .texture2D({ data: [...fog, 1], width: 1, height: 1 });

  const skybox = renderer.skybox({ texture: skyTexture, backgroundTexture });
  const reflector = renderer.reflectionProbe();
  const environment = renderer.entity([skybox, reflector]);

  environment.transform
    .set({ rotation: mulN3(null, [0, 1, 0, cos(pi*0.5)], sin(pi*0.5)) });

  renderer.add(environment);

  const volume = renderer.add(renderer.entity());
  const volumeTexture = context.texture2D(volumeImg);

  volume.transform.set({ scale: range(3, 1.3) });

  const volumeBounds = [
    { radius: 0.38, centre: [0, -0.19, -0.05] },
    { radius: 0.23, centre: [-0.01, 0.25, 0.07] }
  ];

  const [humanoid, ...shapes] = scenes;

  // console.log('distort.vert', distort.vert);
  // console.log('distort.frag', distort.frag);

  const humanoidMaterialState = {
    // ...distort,
    // vert: '#define x_orientToField\n'+distort.vert,
    // frag: '#define x_orientToField\n'+distort.frag,
    // vert: '#define x_orientToField\n#define x_cellNoise 0\n'+distort.vert,
    // frag: '#define x_orientToField\n#define x_cellNoise 0\n'+distort.frag,
    // vert: '#define x_orientToField\n#define x_cellNoise 1\n'+distort.vert,
    // frag: '#define x_orientToField\n#define x_cellNoise 1\n'+distort.frag,
    vert: '#define x_orientToField\n#define x_cellNoise 2\n'+distort.vert,
    frag: '#define x_orientToField\n#define x_cellNoise 2\n'+distort.frag,
    uniforms: {
      // x_distortNoise: [12, 12, 1],
      x_distortNoise: [4, 4, 4],
      x_distortSpeed: [0, 0, 5e-5],
      x_distortShake: 1,
      x_distortSurface: [3e-2, 0.1, 0.1, -1],
      // x_distortSurface: [1e-2, 0.1, 0.1, 0.3],
      x_distortNormal: 1e-5,
      x_time: range(3)
    },
    metallic: 0.1, roughness: 0.9,
    castShadows: !!shadows, receiveShadows: !!shadows,
    // @todo Improve alpha blending and face-culling issues.
    alphaTest: 0.92,
    // alphaTest: 0.08,
    ...blend,
    // cullFace: false,
    cullFaceMode: context.Face.Front
  };

  humanoid.entities.forEach((e) => e.getComponent('Material') &&
    e.addComponent(renderer.material(humanoidMaterialState)));

  humanoid.root.transform
    .set({ scale: range(3, 1.2), position: [0, -0.32, 0] });

  renderer.add(humanoid.root, volume);

  // shapes.push(toCube, toRoundedCube, toSphere, toIcosphere, toEllipsoid,
  //   toCylinder, toCone, toCapsule, toTorus, toTetrahedron, toIcosahedron);

  map((s) => ((typeof s !== 'function')? s
      : { root: renderer.entity([renderer.geometry(s())]) }),
    shapes, 0);

  const shapeTo = { surfaceClamp: 1.5 };

  // console.log('shapeInVolume.vert', shapeInVolume.vert);
  // console.log('shapeInVolume.frag', shapeInVolume.frag);

  const shapeMaterialState = {
    // ...shapeInVolume,
    vert: '#define x_orientToVolume\n#define x_clampToVolume\n'+
      shapeInVolume.vert,
    frag: shapeInVolume.frag,
    uniforms: {
      x_volumeTexture: volumeTexture,
      x_volumeTile: [8, 8],
      x_volumeInverse: [],
      // Starting the ramp off below 0, to grow the shapes in over time.
      x_volumeRamp: [-3e-2, 0, 0.15, 1],
      x_volumeSurface: [0.1, -shapeTo.surfaceClamp*1.5],
      x_colors: map((v) => mulN3(v, v, 1/255),
        [[199, 134, 75, 1], [12, 24, 145, 1]], 0),
      x_colorNoise: [5, 5, 5, 3e-4],
      x_time: range(3)
    },
    metallic: 0.7, roughness: 0.3,
    castShadows: !!shadows, receiveShadows: !!shadows,
    ...blend
  };

  /**
   * @see [Spherical distribution](https://observablehq.com/@rreusser/equally-distributing-points-on-a-sphere)
   */
  const onSphere = (angle, depth, to = []) =>
    mulN2(to, setC3(to, cos(angle), sin(angle), depth), sqrt(1-(depth*depth)));

  const instancesShapes = map(() => ({ instances: 0 }), shapes);
  const instancesAll = { instances: 0 };

  scatter && reduce((all, _, i, a) => {
      const to = wrap(randomInt(), instancesShapes);
      const allOffsets = (all.offsets ??= { data: a, divisor: 1 }).data;
      const offsets = (to.offsets ??= { data: [], divisor: 1 }).data;
      const allRotations = (all.rotations ??= { data: [], divisor: 1 }).data;
      const rotations = (to.rotations ??= { data: [], divisor: 1 }).data;
      const allScales = (all.scales ??= { data: [], divisor: 1 }).data;
      const scales = (to.scales ??= { data: [], divisor: 1 }).data;
      const { radius, centre } = wrap(randomInt(), volumeBounds);

      offsets.push(allOffsets[i] = maddN3(null,
        onSphere(randomFloat()*tau, mix(-1, 1, randomFloat())),
        (randomFloat()**0.6)*radius, centre));

      rotations.push(allRotations[i] = axisAngleToQuat(null,
        randomFloat(), randomFloat(), randomFloat(), randomFloat()*tau));

      scales.push(allScales[i] = range(3, mix(2e-2, 5e-2, randomFloat())));

      ++all.instances;
      ++to.instances;

      return all;
    },
    range(scatter), instancesAll);

  const growth = {
    instances: { all: instancesAll, shapes: instancesShapes },
    // Current "turtle" state.
    at: {
      // Instance target.
      shape: 0,
      // Instance properties.
      offset: [-0.01, 0.2, 0],
      rotation: axisAngleToQuat([], ...y3, pi*0.08),
      scale: range(3, 1),
      // Step scales.
      length: 5e-2,
      width: 5e-2,
      angle: pi*0.25,
      // Step scale rates of change.
      lengthRate: 1.2,
      widthRate: 1.2,
      angleRate: 1.2,
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

      (scale ??= [...toScale(to)]) &&
        (all.scales ??= { data: [], divisor: 1 }).data.push(scale) &&
        (s.scales ??= { data: [], divisor: 1 }).data.push(scale);

      (rotation ??= [...toRotation(to)]) &&
        (all.rotations ??= { data: [], divisor: 1 }).data.push(rotation) &&
        (s.rotations ??= { data: [], divisor: 1 }).data.push(rotation);

      if(offset ??= [...toOffset(to)]) {
        let near;

        const d = reduce((d, b) => {
            const { radius: r, centre: c } = b;

            (d > (d = dist3(offset, c)-r)) && (near = b);

            return d;
          },
          volumeBounds, Infinity);

        // @todo Wrap instead of clamp.
        (d > 0) &&
          mixN3(null, offset, near.centre, d/(d+near.radius));

        offset &&
          (all.offsets ??= { data: [], divisor: 1 }).data.push(offset) &&
          (s.offsets ??= { data: [], divisor: 1 }).data.push(offset);
      }

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
    branches: [],
    finals: {
      /**
       * @see [3D interactive demo](https://github.com/nylki/lindenmayer/blob/main/docs/examples/interactive_lsystem_builder/index_3d.html)
       * @see [Houdini L-system syntax](https://www.sidefx.com/docs/houdini/nodes/sop/lsystem.html)
       */
      /** Move forward, creating geometry. */
      F: (i, to) => to.toOffset(to, 1, i.part.size) && to.toInstance(to),
      /** Move forward half the length, creating geometry. */
      H: (i, to) => to.toOffset(to, 0.5, i.part.size) && to.toInstance(to),
      /** Move forward but don't record a vertex. */
      G: (...etc) => console.warn('Growth L-system `G` final unused', ...etc),
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
      T: (...etc) => console.warn('Growth L-system `T` final unused', ...etc),
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
      '~': (...etc) => console.warn('Growth L-system `~` final unused', ...etc),
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
    }
  };

  const growthSystem = growth.system = new LSystem({
    // forceObjects: true,
    finals: growth.finals,
    axiom: growAxiom,
    productions: reduce((productions, r) => {
        const [at, to] = r.split(/(?:=|(?:->))/);

        productions[at] = to;

        return productions;
      },
      growRules, {})
  });

  growth.setup(growth);
  console.log(growthSystem.axiom, growthSystem.productions);
  console.log(growthSystem.iterate(growSteps));
  growthSystem.final(growth);

  console.log(instancesShapes, instancesAll);

  const shapeRoot = renderer.add(renderer.entity());

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

  const eyesTo = { scale: range(3, 3e-2), intensity: 0.2 };

  const eyes = map((position) => renderer.add(renderer.entity([
        renderer.transform({ position, scale: range(3, 0) }),
        renderer.geometry(toSphere()),
        renderer.material({
          ...blend, opacity: 0.6,
          unlit: true, baseColor: range(4, 5)
        }),
        renderer.pointLight({ intensity: 0, range: 1, castShadows: !!shadows })
      ]),
      volume),
    [[-0.022, 0.106, 0.158], [0.065, 0.11, 0.135]], 0);

  const pointLights = map(({ color, position }) =>
      renderer.add(renderer.entity([
        renderer.pointLight({ intensity: 9, castShadows: !!shadows, color }),
        renderer.transform({ position })
      ])),
    [
      // { color: [1, 1, 1, 1], position: [1, 1, -1] },
      { color: [0, 0, 1, 1], position: [-1, -1, -1] },
      { color: [0, 0, 1, 1], position: [-1, 1, 1] },
      { color: [1, 0, 1, 1], position: [1, -1, -1] },
      { color: [1, 0, 1, 1], position: [1, 1, 1] }
    ],
    0);

  function draw() {
    const { eps, dof: ed, exposure: ee, surface: es, light: el } = ease;
    const hus = humanoidMaterialState.uniforms;
    const { x_time: ht } = hus;
    const sus = shapeMaterialState.uniforms;
    const { x_time: st, x_volumeRamp, x_volumeSurface, x_volumeInverse } = sus;
    const { time, dt, loop } = ((animate)? toTimer(timer) : timer);

    set3(ht, setC3(st, time, dt, abs(((time+loop)%(loop*2))-loop)));

    const [rampMin] = x_volumeRamp;

    (0-rampMin > eps) && addN2(null, x_volumeRamp, mix(rampMin, 0, es)-rampMin);

    const skin = x_volumeSurface[1];
    const skinTo = shapeTo.surfaceClamp;

    (abs(skin-skinTo) > eps) && (x_volumeSurface[1] = mix(skin, skinTo, es));

    const volumeTransform = volume.transform;

    volumeTransform.update();
    invert44(x_volumeInverse, volumeTransform.modelMatrix);

    const d = orbit.distance;
    const dof = post.dofFocusDistance;

    (abs(d-dof) > eps) && post.set({ dofFocusDistance: mix(dof, d, ed) });

    const expose = camera.exposure;

    (1-expose > eps) && camera.set({ exposure: mix(expose, 1, ee) });

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
  }

  function resize() {
    const { innerWidth: width, innerHeight: height } = self;
    const { pixelRatio: pr } = context;

    context.set({ width, height });
    camera.set({ viewport: [0, 0, width*pr, height*pr] });
    draw();
  }

  resize();
  addEventListener('resize', resize);

  orbit.set({
    distance: mix(orbit.minDistance, orbit.maxDistance, 0.25),
    lat: 10, lon: -70
  });

  context.frame(draw);

  self.context = context;
  self.renderer = renderer;
  self.scenes = scenes;
})();
