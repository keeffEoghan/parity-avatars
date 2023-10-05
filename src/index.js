import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import { load } from 'pex-io';
import parseHDR from 'parse-hdr';
import { map } from '@epok.tech/fn-lists/map';

const { max, PI: pi } = Math;

// For `pex-renderer`'s `gltf` loader to play nicely with `parcel`'s asset hash.
const gltfURL = (url) => url.href.replace(/\?.*$/, '');

(async () => {
  const canvas = document.querySelector('canvas');
  const context = getContext({ canvas });
  const { gl, PixelFormat, Encoding } = context;
  const renderer = getRenderer({ ctx: context, pauseOnBlur: true });

  // const updateTexture = (texture, to) => texture._update(context, texture, to);

  const { skyBuffer, sdfImage } = await load({
    skyBuffer: { arrayBuffer: new URL('../media/sky.hdr', import.meta.url)+'' },
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
      // new URL('../media/tetrahedron.glb', import.meta.url),
      // new URL('../media/soccer.glb', import.meta.url)
    ],
    0));

  context.set({ pixelRatio: max(self.devicePixelRatio, 1.5) || 1.5 });

  const camera = renderer.camera({ fov: pi*0.5, near: 0.1, far: 1e2 });

  const orbiter = renderer.orbiter({
    target: [0, 0.2, 0], position: [0.3, 0.3, 0.6], lat: 0, lon: pi*0.5,
    easing: 5e-2, minDistance: 0.4, maxDistance: 1, pan: false, element: canvas
  });

  const cameraOrbiter = renderer.entity([
    camera, orbiter, renderer.transform({ position: [0, 0, 3] })
  ]);

  renderer.add(cameraOrbiter);

  const sdfMaterial = renderer.material({
    baseColorMap: context.texture2D(sdfImage), metallic: 1, roughness: 0.1
  });

  scenes.forEach((s) => renderer.add(s.root));

  const [humanoid] = scenes;

  humanoid.entities.forEach((e) =>
    e.getComponent('Material') && e.addComponent(sdfMaterial));

  const skyHDR = parseHDR(skyBuffer);
  const { data: skyData, shape: [skyW, skyH] } = skyHDR;

  const skyTexture = context.texture2D({
    data: skyData, width: skyW, height: skyH, flipY: true,
    pixelFormat: PixelFormat.RGBA32F, encoding: Encoding.Linear
  });

  const skybox = renderer.skybox({ texture: skyTexture, backgroundBlur: 1 });
  const reflectionProbe = renderer.reflectionProbe();

  renderer.add(renderer.entity([skybox, reflectionProbe]));

  function resize() {
    context.set({ width: innerWidth, height: innerHeight });
    camera.set({ aspect: innerWidth/innerHeight });
    renderer.draw();
  }

  resize();
  addEventListener('resize', resize);

  context.frame(() => renderer.draw());

  self.context = context;
  self.renderer = renderer;
})();
