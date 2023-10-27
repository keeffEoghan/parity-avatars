import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import parseHDR from 'parse-hdr';
import { setC3 } from '@thi.ng/vectors/setc';
import { mulN2, mulN3 } from '@thi.ng/vectors/muln';
import { maddN3 } from '@thi.ng/vectors/maddn';
import { normalize4 } from '@thi.ng/vectors/normalize';
import { mix } from '@thi.ng/math/mix';
import { Smush32 as Random } from '@thi.ng/random';
import { map } from '@epok.tech/fn-lists/map';
import { reduce } from '@epok.tech/fn-lists/reduce';
import { range } from '@epok.tech/fn-lists/range';
import { wrap } from '@epok.tech/fn-lists/wrap';

import * as inVolume from './in-volume-glsl';

const {
    max, abs, floor, round, sqrt, sin, cos, PI: pi, TAU: tau = pi*2
  } = Math;

const random = new Random(0x67229302);
const randomFloat = () => random.float();
const randomInt = () => random.int();

// For `pex-renderer`'s `gltf` loader to play nicely with `parcel`'s asset hash.
const gltfURL = (url) => url.href.replace(/\?.*$/, '');

(async () => {
  const canvas = document.querySelector('canvas');
  const context = getContext({ canvas });
  const { gl, PixelFormat, Encoding } = context;
  const renderer = getRenderer({ ctx: context, pauseOnBlur: true });
  const pipelineShaders = renderer.shaders.pipeline;

  console.log('pipeline', pipelineShaders);

  const { skyHDR, volumeImg } = await load({
    skyHDR: { arrayBuffer: new URL('../media/sky-0.hdr', import.meta.url)+'' },
    volumeImg: { image: new URL('../media/volume-sdf.png', import.meta.url)+'' }
    // volumeImg: { image: new URL('../media/volume-density.png', import.meta.url)+'' }
    // volumeImg: { image: new URL('../media/volume-test.png', import.meta.url)+'' }
  });

  const gltfLoading = { enabledCameras: null };

  const scenes = await Promise.all(map((u) =>
      renderer.loadScene(gltfURL(u), gltfLoading),
    [
      new URL('../media/humanoid.glb', import.meta.url),
      // new URL('../media/cube.glb', import.meta.url),
      // new URL('../media/icosahedron.glb', import.meta.url), // white?
      // new URL('../media/sphere.glb', import.meta.url), // white?
      // new URL('../media/dodecahedron.glb', import.meta.url), // missing?
      // new URL('../media/octahedron.glb', import.meta.url), // white?
      new URL('../media/tetrahedron.glb', import.meta.url),
      // new URL('../media/soccer.glb', import.meta.url) // white?
    ],
    0));

  const camera = renderer.camera({
    fov: pi*0.5, near: 1e-2, far: 1e2, fStop: 1, sensorFit: 'overscan',
    exposure: 0
  });

  const ease = { orbit: 1e-1, dof: 4e-2, exposure: 4e-2 };

  const orbit = renderer.orbiter({
    element: canvas, target: [0, 0.1, 0.18], position: [-0.1, 0.4, 0.1],
    minDistance: 0.3, maxDistance: 1.5, easing: 5e-2
  });

  const post = renderer.postProcessing({
    fxaa: true, ssao: true, dof: true, dofFocusDistance: 0,
    bloom: true, bloomThreshold: 1, bloomRadius: 0.5
  });

  const viewer = renderer.entity([camera, orbit, post]);
  // const viewer = renderer.entity([camera, orbit]);

  renderer.add(viewer);

  const skyHDRData = parseHDR(skyHDR);
  const { data: skyData, shape: [skyW, skyH] } = skyHDRData;

  const skyTexture = context.texture2D({
    data: skyData, width: skyW, height: skyH, flipY: true,
    pixelFormat: PixelFormat.RGBA32F, encoding: Encoding.Linear
  });

  const backgroundTexture = context
    .texture2D({ data: [8, 8, 8, 0], width: 1, height: 1 });

  const skybox = renderer.skybox({ texture: skyTexture, backgroundTexture });
  const reflector = renderer.reflectionProbe();
  const environment = renderer.entity([skybox, reflector]);

  environment.transform
    .set({ rotation: mulN3(null, [0, 1, 0, cos(pi*0.5)], sin(pi*0.5)) });

  renderer.add(environment);

  const volume = renderer.add(renderer.entity());
  const volumeTexture = context.texture2D(volumeImg);
  const { width: volumeLayerX, height: volumeLayerY } = volumeTexture;
  const volumeSize = [volumeLayerX, volumeLayerY, 8, 8];

  // volume.transform.set({ scale: range(3, 0.8) });
  volume.transform.set({ scale: range(3, 1.3) });

  const volumeBounds = [
    { radius: 0.38, centre: [0, -0.19, -0.05] },
    { radius: 0.23, centre: [-0.01, 0.25, 0.07] }
  ];

  const [humanoid, shape] = scenes;

  const humanoidMaterial = renderer.material({
    metallic: 0.2, roughness: 0.8, blend: true, opacity: 1e-2
  });

  humanoid.entities.forEach((e) =>
    e.getComponent('Material') && e.addComponent(humanoidMaterial));

  // renderer.add(humanoid.root, volume);
  humanoid.root.transform.set({ scale: range(3, 1.2), position: [0, -0.32, 0] });

  const shapeMaterial = renderer.material({
    ...inVolume,
    uniforms: {
      x_volumeTexture: volumeTexture,
      x_volumeSize: volumeSize,
      x_volumeTransform: volume.transform.modelMatrix,
      x_volumeRange: [0, 3e-2]
    },
    castShadows: true, receiveShadows: true, metallic: 1, roughness: 0.3
  });

  /**
   * @see [Spherical distribution](https://observablehq.com/@rreusser/equally-distributing-points-on-a-sphere)
   */
  const onSphere = (angle, depth, to = []) =>
    mulN2(null, setC3(to, cos(angle), sin(angle), depth), sqrt(1-(depth**2)));

  const shapeInstances = reduce((to, _, i, a) => {
      const { radius: r, centre: c } = wrap(randomInt(), volumeBounds);
      const p = onSphere(randomFloat()*tau, mix(-1, 1, randomFloat()));
      const q = map(randomFloat, range(4), 0);

      maddN3(p, p, (randomFloat()**0.6)*r, c);
      (to.offsets ??= { data: a, divisor: 1 }).data[i] = p;

      q[3] *= tau;
      (to.rotations ??= { data: [], divisor: 1 }).data[i] = normalize4(q, q);

      (to.scales ??= { data: [], divisor: 1 }).data[i] = range(3, 2e-2);
      to.instances ??= a.length;

      return to;
    },
    range(1e4), {});

  shape.entities.forEach((e) => {
    const g = e.getComponent('Geometry');

    if(!g) { return; }

    const m = e.getComponent('Material');

    m && e.removeComponent(m);
    e.addComponent(shapeMaterial);
    g.set({ ...shapeInstances });
  });

  shape.root.transform.set({ position: [0, -0.1, 0] });
  renderer.add(shape.root);

  const pointLights = map(({ color, position }) =>
      renderer.add(renderer.entity([
        renderer.pointLight({ intensity: 30, castShadows: true, color }),
        renderer.transform({ position })
      ])),
    [
      { color: [0, 0, 1, 1], position: [-1, 1, -2] },
      { color: [0, 0, 1, 1], position: [-1, 1, 2] },
      { color: [1, 0, 1, 1], position: [1, 1, -2] },
      { color: [1, 0, 1, 1], position: [1, 1, 2] }
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
    distance: mix(orbit.minDistance, orbit.maxDistance, 0.2),
    lat: 10, lon: -70
  });

  context.frame(() => {
    const d = orbit.distance;
    const dof = post.dofFocusDistance;
    const e = camera.exposure;

    (abs(dof-d) > 1e-4) &&
      post.set({ dofFocusDistance: mix(dof, d, ease.dof) });

    (abs(e-1) > 1e-4) && camera.set({ exposure: mix(e, 1, ease.exposure) });
    renderer.draw();
  });

  self.context = context;
  self.renderer = renderer;
  self.scenes = scenes;
})();
