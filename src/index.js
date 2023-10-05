import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import getSphere from 'primitive-sphere';

const { max, PI: pi } = Math;

const canvas = document.querySelector('canvas');
const context = getContext({ canvas });
const { gl } = context;
const renderer = getRenderer({ ctx: context, pauseOnBlur: true });

context.set({ pixelRatio: max(devicePixelRatio, 1.5) || 1.5 });

const camera = renderer.camera({ fov: pi*0.5, near: 0.1, far: 1e2 });

const orbiter = renderer.orbiter({
  target: [0, 0, 0], position: [0.3, 0.3, 0.8], lat: 0, lon: pi*0.5, easing: 5e-2,
  minDistance: 0.2, maxDistance: 1, pan: false, element: canvas
});

const cameraOrbiter = renderer.entity([
  camera, orbiter, renderer.transform({ position: [0, 0, 3] })
]);

renderer.add(cameraOrbiter);

const imageSDF = new Image();
const textureSDF = context.texture2D({});

imageSDF.onload = () => textureSDF._update(context, textureSDF, imageSDF);
imageSDF.onerror = console.error;
imageSDF.src = new URL('../media/volume-sdf.png', import.meta.url);

const cube = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(getSphere(0.1)),
  renderer.material({ baseColorMap: textureSDF, metallic: 0.8, roughness: 0.1 })
]);

renderer.add(cube);

const skybox = renderer.entity([renderer.skybox({ sunPosition: [1, 1, 1] })]);

renderer.add(skybox);

const reflectionProbe = renderer.entity([renderer.reflectionProbe()]);

renderer.add(reflectionProbe);

function resize() {
  context.set({ width: innerWidth, height: innerHeight });
  camera.set({ aspect: innerWidth/innerHeight });
  renderer.draw();
}

resize();
addEventListener('resize', resize);

context.frame(() => renderer.draw());
