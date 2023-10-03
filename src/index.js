import getContext from 'pex-context';
import getRenderer from 'pex-renderer';
import getSphere from 'primitive-sphere';

const { max, PI: pi } = Math;

const canvas = document.querySelector('canvas');
const context = getContext({ canvas });
const { gl } = context;
const renderer = getRenderer({ ctx: context, pauseOnBlur: true });

context.set({ pixelRatio: max(devicePixelRatio, 1.5) || 1.5 });

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({ fov: pi*0.5, near: 0.1, far: 1e2 })
]);

renderer.add(camera);

const cube = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(getSphere(1)),
  renderer.material({ baseColor: [1, 0, 0, 1] })
]);

renderer.add(cube);

const skybox = renderer.entity([
  renderer.skybox({ sunPosition: [1, 1, 1] })
]);

renderer.add(skybox);

const reflectionProbe = renderer.entity([renderer.reflectionProbe()]);

renderer.add(reflectionProbe);

function resize() {
  context.set({ width: innerWidth, height: innerHeight });
  camera.getComponent('Camera').set({ aspect: innerWidth/innerHeight });
  renderer.draw();
}

resize();
addEventListener('resize', resize);

context.frame(() => renderer.draw());
