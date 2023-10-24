import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import math from 'pex-math/utils';
import parseHDR from 'parse-hdr';
import { map } from '@epok.tech/fn-lists/map';
import { range } from '@epok.tech/fn-lists/range';

import * as inSDF from './in-sdf-glsl';

const { max, abs, PI: pi } = Math;
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

  // const updateTexture = (texture, to) => texture._update(context, texture, to);

  const { skyHDR, sdfImage } = await load({
    skyHDR: { arrayBuffer: new URL('../media/sky-1.hdr', import.meta.url)+'' },
    sdfImage: { image: new URL('../media/volume-sdf.png', import.meta.url)+'' }
  });

  const gltfLoading = { enabledCameras: null };

  const scenes = await Promise.all(map((u) =>
      renderer.loadScene(gltfURL(u), gltfLoading),
    [
      new URL('../media/humanoid.glb', import.meta.url),
      // new URL('../media/cube.glb', import.meta.url),
      // new URL('../media/icosahedron.glb', import.meta.url),
      // new URL('../media/sphere.glb', import.meta.url),
      // new URL('../media/dodecahedron.glb', import.meta.url),
      // new URL('../media/octahedron.glb', import.meta.url),
      new URL('../media/tetrahedron.glb', import.meta.url),
      // new URL('../media/soccer.glb', import.meta.url)
    ],
    0));

  const camera = renderer.camera({
    fov: pi*0.5, near: 1e-2, far: 1e2, fStop: 1, sensorFit: 'overscan'
  });

  const ease = { orbit: 1e-1, dof: 4e-2 };

  const orbit = renderer.orbiter({
    target: [0, 0, 0], position: [0, 0, 0.45], easing: 5e-2,
    minDistance: 0.45, maxDistance: 1.1, element: canvas, pan: false
  });

  const post = renderer.postProcessing({
    fxaa: true, ssao: true, dof: true, dofFocusDistance: 0,
    bloom: true, bloomThreshold: 1, bloomRadius: 0.5
  });

  const viewer = renderer.entity([camera, orbit, post]);

  renderer.add(viewer);

  const skyHDRData = parseHDR(skyHDR);
  const { data: skyData, shape: [skyW, skyH] } = skyHDRData;

  const skyTexture = context.texture2D({
    data: skyData, width: skyW, height: skyH, flipY: true,
    pixelFormat: PixelFormat.RGBA32F, encoding: Encoding.Linear
  });

  const skybox = renderer.skybox({
    sunPosition: [1, 1, 1], texture: skyTexture, backgroundBlur: 1
  });

  const reflector = renderer.reflectionProbe();

  renderer.add(renderer.entity([skybox, reflector]));

  const sdf = renderer.add(renderer.entity());
  const sdfTexture = context.texture2D(sdfImage);

  const humanoidMaterial = renderer.material({
    metallic: 0.1, roughness: 0.3,
    blend: true, opacity: 0.3,
    castShadows: true, receiveShadows: true
  });

  scenes.forEach((s) => renderer.add(s.root));

  const [humanoid, tetrahedron] = scenes;

  humanoid.entities.forEach((e) =>
    e.getComponent('Material') && e.addComponent(humanoidMaterial));

  humanoid.root.transform.set({ position: [0, -0.3, -5e-2] });

  const shapeMaterial = renderer.material({
    ...inSDF,
    uniforms: {
      x_sdfTexture: sdfTexture,
      x_sdfTransform: sdf.transform.modelMatrix
    },
    castShadows: true, receiveShadows: true, metallic: 1, roughness: 0.1
  });

  tetrahedron.entities.forEach((e) =>
    e.getComponent('Material') && e.addComponent(shapeMaterial));

  tetrahedron.root.transform
    .set({ scale: range(3, 0.2), position: [0, 0.2, 0] });

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
