import { makeExample } from './exampleSystem.js';

async function main() {
  const { ecs, update } = await makeExample({ n: 100 });

  const canvas = document.getElementById('canvas');
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('Canvas element not found');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  let lastTime = Date.now();

  const animationLoop = () => {
    const dt = (Date.now() - lastTime) / 1000;
    lastTime = Date.now();

    ctx.resetTransform();
    ctx.scale(ctx.canvas.width, ctx.canvas.height);

    update({ dt: dt * 3, ctx });
    requestAnimationFrame(animationLoop);
  };

  requestAnimationFrame(animationLoop);
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: demo
  console.error(error);
});