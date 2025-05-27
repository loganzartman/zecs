import { zecs } from 'zecs';
import { z } from 'zod/v4';

const pointSchema = z.object({ x: z.number(), y: z.number() });
const line = zecs.component(
  'line',
  z.object({ a: pointSchema, b: pointSchema }),
);

const drawLines = zecs.system({
  name: 'drawLines',
  query: zecs.query().has(line),

  updateParams: z.object({
    ctx: z.custom<CanvasRenderingContext2D>(),
  }),

  onPreUpdate({ updateParams: { ctx } }) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.strokeStyle = 'red';
  },

  onUpdated({ entity: { line }, updateParams: { ctx } }) {
    ctx.beginPath();
    ctx.moveTo(line.a.x, line.a.y);
    ctx.lineTo(line.b.x, line.b.y);
    ctx.stroke();
  },

  onPostUpdate({ updateParams: { ctx } }) {
    ctx.restore();
  },
});

const lineEcs = zecs.ecs([line]);

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Failed to get canvas context');
}

const drawLinesHandle = await zecs.attachSystem(lineEcs, drawLines, {
  ctx,
});
drawLinesHandle.update({ ctx });
