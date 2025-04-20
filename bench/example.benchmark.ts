import { bench } from 'mitata';
import { z } from 'zod';
import zecs from '../src';

bench('example', function* () {
  const mass = zecs.component('mass', z.number());

  const position = zecs.component(
    'position',
    z.object({
      x: z.number(),
      y: z.number(),
    }),
  );

  const velocity = zecs.component(
    'velocity',
    z.object({
      dx: z.number(),
      dy: z.number(),
    }),
  );

  const gravity = zecs.behavior({
    query: zecs.query().has(mass, velocity),
    params: z.object({ g: z.number(), dt: z.number() }),
    deps: [],
    on: {
      updated: ({ mass, velocity }, { g, dt }) => {
        velocity.dx += g * mass * dt;
        velocity.dy += g * mass * dt;
      },
    },
  });

  const kinematics = zecs.behavior({
    query: zecs.query().has(position, velocity),
    params: z.object({ dt: z.number() }),
    deps: [gravity],
    on: {
      updated: ({ position, velocity }, { dt }) => {
        position.x += velocity.dx * dt;
        position.y += velocity.dy * dt;
      },
    },
  });

  yield null;
});
