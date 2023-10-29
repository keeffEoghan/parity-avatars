import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import parseHDR from 'parse-hdr';

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
import toIcosahedron from 'primitive-geometry/src/icosahedron';

import toNormals from 'geom-normals';
import { setC2, setC3 } from '@thi.ng/vectors/setc';
import { mulN2, mulN3 } from '@thi.ng/vectors/muln';
import { divN3 } from '@thi.ng/vectors/divn';
import { subN2 } from '@thi.ng/vectors/subn';
import { addN2, addN3 } from '@thi.ng/vectors/addn';
import { maddN3 } from '@thi.ng/vectors/maddn';
import { normalize4 } from '@thi.ng/vectors/normalize';
import { mixN3 } from '@thi.ng/vectors/mixn';
import { mix } from '@thi.ng/math/mix';
import { Smush32 as Random } from '@thi.ng/random';
import { map } from '@epok.tech/fn-lists/map';
import { reduce } from '@epok.tech/fn-lists/reduce';
import { each } from '@epok.tech/fn-lists/each';
import { range } from '@epok.tech/fn-lists/range';
import { wrap } from '@epok.tech/fn-lists/wrap';
import toTimer from '@epok.tech/fn-time';

import * as shapeInVolume from './shape-in-volume';

const {
    min, max, abs, floor, round, sqrt, sin, cos, PI: pi, TAU: tau = pi*2
  } = Math;

const query = new URLSearchParams(location.search);

const pauseOnBlur = !(query.get('pause-on-blur') === 'false');
const shadows = parseInt(query.get('shadows') || 4, 10) || 0;

const random = new Random(parseInt(query.get('seed') ?? '0x67229302'));
const randomFloat = () => random.float();
const randomInt = () => random.int();

// For `pex-renderer`'s `gltf` loader to play nicely with `parcel`'s asset hash.
const gltfURL = (url) => url.href.replace(/\?.*$/, '');

(async () => {
  const canvas = document.querySelector('canvas');
  const context = getContext({ canvas });
  const { gl, PixelFormat, Encoding } = context;

  const renderer = getRenderer({
    ctx: context, pauseOnBlur, shadowQuality: shadows
  });

  const pipelineShaders = renderer.shaders.pipeline;
  const timer = toTimer({ step: '-', loop: 1e5 });

  // console.log('pipeline', pipelineShaders);
  // console.log('shape-in-volume', shapeInVolume.vert, shapeInVolume.frag);

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

  const camera = renderer.camera({
    fov: pi*0.5, near: 1e-2, far: 1e2, fStop: 1.6, sensorFit: 'overscan',
    exposure: 0
  });

  const ease = {
    eps: 1e-4,
    orbit: 5e-2, dof: 3e-2, exposure: 4e-2, ramp: 1e-2, light: 5e-2
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
    pixelFormat: PixelFormat.RGBA32F, encoding: Encoding.Linear
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

  const humanoidMaterial = renderer.material({
    metallic: 0.2, roughness: 0.8, blend: true, opacity: 1e-2
  });

  humanoid.entities.forEach((e) =>
    e.getComponent('Material') && e.addComponent(humanoidMaterial));

  // renderer.add(humanoid.root, volume);
  humanoid.root.transform
    .set({ scale: range(3, 1.2), position: [0, -0.32, 0] });

  const shapeMaterial = renderer.material({
    // ...shapeInVolume,
    vert: '#define x_orientToVolume\n#define x_clampToVolume\n'+
      shapeInVolume.vert,
    frag: shapeInVolume.frag,
    uniforms: {
      x_volumeTexture: volumeTexture,
      x_volumeTile: [8, 8],
      x_volumeTransform: volume.transform.modelMatrix,
      // Starting the ramp off below 0, to grow the shapes in over time.
      x_volumeRamp: [-3e-2, 0, 0.1, 1],
      x_volumeSurface: [0.1, 30],
      x_colors: map((v) => divN3(v, v, 255),
        [[199, 134, 75, 1], [12, 24, 145, 1]], 0),
      x_colorNoise: [5, 5, 5, 3e-4],
      x_time: range(3, 0)
    },
    castShadows: !!shadows, receiveShadows: !!shadows,
    metallic: 0.7, roughness: 0.3
  });

  /**
   * @see [Spherical distribution](https://observablehq.com/@rreusser/equally-distributing-points-on-a-sphere)
   */
  const onSphere = (angle, depth, to = []) =>
    mulN2(null, setC3(to, cos(angle), sin(angle), depth), sqrt(1-(depth**2)));

  const shapesInstances = shapes.map(({ entities, root }, s) => {
    const shapeInstances = reduce((to, _, i, a) => {
        const { radius, centre } = wrap(randomInt(), volumeBounds);
        const p = onSphere(randomFloat()*tau, mix(-1, 1, randomFloat()));

        (to.offsets ??= { data: a, divisor: 1 }).data[i] = maddN3(null,
          p, (randomFloat()**0.6)*radius, centre);

        // (to.rotations ??= { data: [], divisor: 1 }).data[i] = normalize4(null,
        //   map((v) => v*randomFloat(), [1, 1, 1, tau], 0));

        (to.scales ??= { data: [], divisor: 1 }).data[i] = range(3,
          // 2e-2);
          // 5e-2);
          // mix(1e-2, 3e-2, randomFloat()));
          mix(3e-2, 6e-2, randomFloat()));

        to.instances ??= a.length;

        return to;
      },
      // range(1e4), {});
      range(1e3), {});

    entities.forEach((e) => {
      const g = e.getComponent('Geometry');

      if(!g) { return; }

      const m = e.getComponent('Material');

      m && e.removeComponent(m);
      e.addComponent(shapeMaterial);
      g.set(shapeInstances);

      // @todo Need `positions` and `cells` arrays, but have write-only buffers.
      // if(g.normals) { return; }

      // const { positions, indices: cells } = g;

      // g.set({ normals: toNormals(positions, cells) });
    });

    root.transform.set({ position: [0, -0.1, 0] });
    renderer.add(root);

    return shapeInstances;
  });

  const eyesTo = { scale: range(3, 3e-2), intensity: 0.2 };

  const eyes = map((position) => renderer.add(renderer.entity([
        renderer.transform({ position, scale: range(3, 0) }),
        renderer.geometry(toSphere()),
        renderer.material({
          blend: true, opacity: 0.6, unlit: true, baseColor: range(4, 5)
        }),
        renderer.pointLight({ intensity: 0, range: 1, castShadows: !!shadows })
      ]),
      volume),
    [[-0.022, 0.106, 0.16], [0.065, 0.11, 0.135]], 0);

  const pointLights = map(({ color, position }) =>
      renderer.add(renderer.entity([
        renderer.pointLight({ intensity: 5, castShadows: !!shadows, color }),
        renderer.transform({ position })
      ])),
    [
      { color: [0, 0, 1, 1], position: [-1, -1, -1] },
      { color: [0, 0, 1, 1], position: [-1, 1, 1] },
      { color: [1, 0, 1, 1], position: [1, -1, -1] },
      { color: [1, 0, 1, 1], position: [1, 1, 1] }
    ],
    0);

  function resize() {
    const { innerWidth: width, innerHeight: height } = self;
    const { pixelRatio: pr } = context;

    context.set({ width, height });
    camera.set({ viewport: [0, 0, width*pr, height*pr] });
    renderer.draw();
  }

  resize();
  addEventListener('resize', resize);

  orbit.set({
    distance: mix(orbit.minDistance, orbit.maxDistance, 0.25),
    lat: 10, lon: -70
  });

  context.frame(() => {
    const { eps, dof: ed, exposure: ee, ramp: er, light: el } = ease;
    const d = orbit.distance;
    const dof = post.dofFocusDistance;

    (abs(d-dof) > eps) && post.set({ dofFocusDistance: mix(dof, d, ed) });

    const expose = camera.exposure;

    (1-expose > eps) && camera.set({ exposure: mix(expose, 1, ee) });

    const shapeUniforms = shapeMaterial.uniforms;
    const ramp = shapeUniforms.x_volumeRamp;
    const [ramp0] = ramp;

    (0-ramp0 > eps) && addN2(null, ramp, mix(ramp0, 0, er)-ramp0);

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

    const { time, dt, loop } = toTimer(timer);

    setC3(shapeUniforms.x_time, time, dt, abs(((time+loop)%(loop*2))-loop));

    renderer.draw();
  });

  self.context = context;
  self.renderer = renderer;
  self.scenes = scenes;
})();
