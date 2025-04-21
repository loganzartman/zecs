import { formatPlan } from '../src/plan.js';
import { makeExample } from './exampleSystem.js';

const { ecs, plan } = makeExample({ n: 100 });

console.log(formatPlan(plan));

const canvas = document.getElementById('canvas');
if (!(canvas instanceof HTMLCanvasElement))
  throw new Error('Canvas element not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Failed to get canvas context');

let lastTime = Date.now();

const update = () => {
  const dt = (Date.now() - lastTime) / 1000;
  lastTime = Date.now();

  ctx.resetTransform();
  ctx.scale(ctx.canvas.width, ctx.canvas.height);

  plan.update(ecs, { g: 9.81, dt: dt * 3, ctx });
  requestAnimationFrame(update);
};

requestAnimationFrame(update);
