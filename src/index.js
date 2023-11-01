import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import parseHDR from 'parse-hdr';
import toNormals from 'geom-normals';
import { invert44 } from '@thi.ng/matrices/invert';
import { set3 } from '@thi.ng/vectors/set';
import { setC2, setC3 } from '@thi.ng/vectors/setc';
import { mulN2, mulN3 } from '@thi.ng/vectors/muln';
import { subN2 } from '@thi.ng/vectors/subn';
import { addN2, addN3 } from '@thi.ng/vectors/addn';
import { maddN3 } from '@thi.ng/vectors/maddn';
import { normalize4 } from '@thi.ng/vectors/normalize';
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

const animate = (query.get('animate') !== 'false');
const pauseOnBlur = (query.get('pause-on-blur') !== 'false');
const shadows = parseInt(query.get('shadows') || 4, 10) || 0;

const random = new Random(parseInt(query.get('seed') ?? '0x67229302'));
const randomFloat = () => random.float();
const randomInt = () => random.int();

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

  const ease = {
    eps: 1e-4,
    orbit: mix(1, 5e-2, animate), dof: mix(1, 3e-2, animate),
    exposure: mix(1, 3e-2, animate), surface: mix(1, 1e-2, animate),
    light: mix(1, 5e-2, animate)
  };

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
    // vert: '#define x_orientToField\n#define x_cellNoise 0\n'+distort.vert,
    // vert: '#define x_orientToField\n#define x_cellNoise 1\n'+distort.vert,
    vert: '#define x_orientToField\n#define x_cellNoise 2\n'+distort.vert,
    frag: distort.frag,
    uniforms: {
      // x_distortNoise: [12, 12, 1],
      x_distortNoise: [6, 6, 6],
      x_distortSpeed: [0, 0, 5e-5],
      x_distortShake: 1,
      // x_distortSurface: [3e-2, 0.1, 5e-2, 0.4],
      x_distortSurface: [1e-2, 0.1, 0.1, 0.2],
      x_distortNormal: 1e-5,
      x_time: range(3)
    },
    metallic: 0.1, roughness: 0.9,
    castShadows: !!shadows, receiveShadows: !!shadows,
    // @todo Improve alpha blending and face-culling issues.
    alphaTest: 1,
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

  const shapeTo = { surfaceScale: 40 };

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
      x_volumeSurface: [0.1, -20],
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

  const shapesInstances = map(() => ({ instances: 0 }), shapes);

  const growth = new LSystem({
    forceObjects: true,
    axiom: 'A',
    productions: {
      // Concentric.
      // A: '[F"![^A&&A]-A++A]',
      A: [{ symbol: 'A', test: 1 }]
      // Tree.
      // A: '-F+!A:0.40',
      // A: '+F-!A:0.40',
      // A: '~(30)[--"A]A:0.1',
      // A: '~(30)[++"A]A:0.1'
    },
    finals: {
      A: ({ index, part }, ...etc) => console.log('A', index, part, ...etc),
      F: ({ index, part }, ...etc) => console.log('F', index, part, ...etc),
      /**
       * @see [3D interactive demo](https://github.com/nylki/lindenmayer/blob/main/docs/examples/interactive_lsystem_builder/index_3d.html)
       * @see [Houdini L-system syntax](https://www.sidefx.com/docs/houdini/nodes/sop/lsystem.html)
       */
      // 'F': pushSegment,
      // '+': () => rotation.multiply(yPosRotation),
      // '-': () => rotation.multiply(yNegRotation),
      // '&': () => rotation.multiply(zNegRotation),
      // '^': () => rotation.multiply(zPosRotation),
      // '\\': () => rotation.multiply(xNegRotation),
      // '<': () => rotation.multiply(xNegRotation),
      // '/': () => rotation.multiply(xPosRotation),
      // '>': () => rotation.multiply(xPosRotation),
      // '|': () => rotation.multiply(yReverseRotation),
      // '!': () => {
      //   currentSegment.scale.set(currentSegment.scale.x, currentSegment.scale.y + 0.2, currentSegment.scale.z + 0.2);
      //   colorIndex = Math.min(colors.length - 1, colorIndex + 1);
      //   for (let face of currentSegment.geometry.faces) {
      //     face.color.setHex(colors[colorIndex]);
      //   }
      //   currentSegment.geometry.colorsNeedUpdate = true;
      // },
      // '\'': () => {
      //   currentSegment.scale.set(currentSegment.scale.x, currentSegment.scale.y - 0.2, currentSegment.scale.z - 0.2);
      //   colorIndex = Math.max(0, colorIndex - 1);
      //   for (let face of currentSegment.geometry.faces) {
      //     face.color.setHex(colors[colorIndex]);
      //   }
      //   currentSegment.geometry.colorsNeedUpdate = true;
      // },
      // '[': () => stack.push(currentSegment.clone()),
      // ']': () => currentSegment = stack.pop()
    }
  });

  console.log(growth.axiom);
  console.log(growth.iterate(1), growth.getString());
  growth.final('?', '!');

  const allInstances = reduce((all, _, i, a) => {
      const to = wrap(randomInt(), shapesInstances);
      const allOffsets = (all.offsets ??= { data: a, divisor: 1 }).data;
      const toOffsets = (to.offsets ??= { data: [], divisor: 1 }).data;
      // const allRotations = (all.rotations ??= { data: [], divisor: 1 }).data;
      // const toRotations = (to.rotations ??= { data: [], divisor: 1 }).data;
      const allScales = (all.scales ??= { data: [], divisor: 1 }).data;
      const toScales = (to.scales ??= { data: [], divisor: 1 }).data;
      const { radius, centre } = wrap(randomInt(), volumeBounds);
      const p = onSphere(randomFloat()*tau, mix(-1, 1, randomFloat()));

      toOffsets.push(allOffsets[i] = maddN3(null,
        p, (randomFloat()**0.6)*radius, centre));

      // toRotations.push(allRotations[i] = normalize4(null,
      //   map((v) => v*randomFloat(), [1, 1, 1, tau], 0)));

      toScales.push(allScales[i] = range(3, mix(2e-2, 5e-2, randomFloat())));

      all.instances ??= a.length;
      ++to.instances;

      return all;
    },
    range(3e3), {});

  // console.log(shapesInstances, allInstances);

  shapes.forEach(({ root, entities }, s) => {
    const shapeInstances = shapesInstances[s];

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
    renderer.add(setup(root));
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
    [[-0.022, 0.106, 0.16], [0.065, 0.11, 0.135]], 0);

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
    const skinTo = shapeTo.surfaceScale;

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
