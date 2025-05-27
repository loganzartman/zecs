import { zecs } from 'zecs';
import { z } from 'zod/v4';

export const health = zecs.component('health', z.number());
export const position = zecs.component(
  'position',
  z.object({ x: z.number(), y: z.number() }),
);
export const velocity = zecs.component(
  'velocity',
  z.object({ x: z.number(), y: z.number() }),
);
