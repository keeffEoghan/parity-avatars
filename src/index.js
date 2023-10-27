import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import math from 'pex-math/utils';
import quat from 'pex-math/quat';
import parseHDR from 'parse-hdr';
import { setC3 } from '@thi.ng/vectors/setc';
import { mulN2, mulN3 } from '@thi.ng/vectors/muln';
import { mix } from '@thi.ng/math/mix';
import { map } from '@epok.tech/fn-lists/map';
import { reduce } from '@epok.tech/fn-lists/reduce';
import { range } from '@epok.tech/fn-lists/range';

import * as inSDF from './in-sdf-glsl';

const { max, abs, random, floor, sqrt, sin, cos, PI: pi, TAU: tau = pi*2 } = Math;
const { lerp } = math;

// For `pex-renderer`'s `gltf` loader to play nicely with `parcel`'s asset hash.
const gltfURL = (url) => url.href.replace(/\?.*$/, '');

(async () => {
  const canvas = document.querySelector('canvas');
  const context = getContext({ canvas });
  const { gl, PixelFormat, Encoding } = context;
  const renderer = getRenderer({ ctx: context, pauseOnBlur: true });
  const pipelineShaders = renderer.shaders.pipeline;

  console.log('pipeline', pipelineShaders);

  const { skyHDR, sdfImage } = await load({
    skyHDR: { arrayBuffer: new URL('../media/sky-0.hdr', import.meta.url)+'' },
    // sdfImage: { image: new URL('../media/volume-sdf.png', import.meta.url)+'' }
    sdfImage: { image: new URL('../media/volume-density.png', import.meta.url)+'' }
    // sdfImage: { image: new URL('../media/volume-test.png', import.meta.url)+'' }
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
    fov: pi*0.5, near: 1e-2, far: 1e2, fStop: 1, sensorFit: 'overscan'
  });

  const ease = { orbit: 1e-1, dof: 4e-2 };

  const orbit = renderer.orbiter({
    target: [0, 0, 0], position: [0, 0, 0.45], easing: 5e-2, element: canvas,
    minDistance: 0.45, maxDistance: 1.1
    // target: [0, 0.25, 0], position: [0, 0.25, 0.45], easing: 5e-2, element: canvas,
    // maxDistance: 1.1
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

  renderer.add(renderer.entity([skybox, reflector]));

  const sdf = renderer.add(renderer.entity());
  const sdfTexture = context.texture2D(sdfImage);
  const { width: sdfLayerX, height: sdfLayerY } = sdfTexture;
  const sdfSize = [sdfLayerX, sdfLayerY, 8, 8];

  // sdf.transform.set({ position: [0, -0.3, -5e-2] });
  sdf.transform.set({
    scale: range(3, 0.8),
    // position: [0, 0.1, 0],
    // rotation: [0, 0, sin(0.5), cos(0.5)]
  });

  // scenes.forEach((s) => renderer.add(s.root));

  const [humanoid, shape] = scenes;

  const humanoidMaterial = renderer.material({
    metallic: 0.2, roughness: 0.8, blend: true, opacity: 1e-2
  });

  humanoid.entities.forEach((e) =>
    e.getComponent('Material') && e.addComponent(humanoidMaterial));

  // renderer.add(humanoid.root, sdf);
  humanoid.root.transform.set({ scale: range(3, 2.3), position: [0, -0.6, 0] });

  const shapeMaterial = renderer.material({
    ...inSDF,
    uniforms: {
      x_sdfTexture: sdfTexture,
      x_sdfSize: sdfSize,
      x_sdfTransform: sdf.transform.modelMatrix,
      x_sdfRange: [0, 1*(2**-8)]
    },
    castShadows: true, receiveShadows: true, metallic: 1, roughness: 0.3
  });

  /**
   * @see [Spherical distribution](https://observablehq.com/@rreusser/equally-distributing-points-on-a-sphere)
   */
  const onSphere = (angle, depth) =>
    mulN2(null, [cos(angle), sin(angle), depth], sqrt(1-(depth*depth)))

  const shapeInstances = reduce((to, _, i, a) => {
      // const head = random() > 0.5;
      const r = random()*0.6;
      const p = mulN3(null, onSphere(random()*tau, mix(-1, 1, random())), r);

      (to.offsets ??= { data: a, divisor: 1 }).data[i] = p;

      const q = map(random, range(4), 0);

      q[3] *= tau;
      (to.rotations ??= { data: [], divisor: 1 }).data[i] = quat.normalize(q);

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
    g?.set?.(shapeInstances);
  });

  shape.root.transform.set({ position: [0, -0.1, 0] });
  renderer.add(shape.root);

  const pointLights = map(({ color, position }) =>
      renderer.add(renderer.entity([
        renderer.pointLight({ intensity: 2, castShadows: true, color }),
        renderer.transform({ position })
      ])),
    [
      { color: [0, 0, 1, 1], position: [-1, 1, -1] },
      { color: [1, 0, 1, 1], position: [1, 1, 1] }
    ],
    0);

  function resize() {
    const width = self.innerWidth;
    const height = self.innerHeight;
    const { pixelRatio: pr } = context;

    context.set({ width, height });
    camera.set({ viewport: [0, 0, width*pr, height*pr] });
    renderer.draw();
  }

  resize();
  addEventListener('resize', resize);

  orbit.set({ distance: lerp(orbit.minDistance, orbit.maxDistance, 0.5) });

  context.frame(() => {
    const d = orbit.distance;
    const dof = post.dofFocusDistance;

    (abs(dof-d) > 1e-4) &&
      post.set({ dofFocusDistance: lerp(dof, d, ease.dof) });

    renderer.draw();
  });

  self.context = context;
  self.renderer = renderer;
  self.scenes = scenes;
})();
