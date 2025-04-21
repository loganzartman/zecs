import { z } from 'zod';
import { zecs } from '../src/index';

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
    x: z.number(),
    y: z.number(),
  }),
);

const acceleration = zecs.component(
  'acceleration',
  z.object({
    x: z.number(),
    y: z.number(),
  }),
);

const collider = zecs.component(
  'collider',
  z.object({
    radius: z.number(),
    restitution: z.number(),
  }),
);

const tether = zecs.component(
  'tether',
  z.object({
    x: z.number(),
    y: z.number(),
    strength: z.number(),
  }),
);

const gravity = zecs.behavior({
  name: 'gravity',
  query: zecs.query().has(acceleration),
  params: z.object({ g: z.number(), dt: z.number() }),
  deps: [],
  on: {
    updated: ({ acceleration }, { g, dt }) => {
      acceleration.y = g * dt;
    },
  },
});

const tethering = zecs.behavior({
  name: 'tethering',
  query: zecs.query().has(tether, position, acceleration, mass),
  params: z.object({ dt: z.number() }),
  deps: [],
  on: {
    updated: ({ tether, position, acceleration, mass }, { dt }) => {
      const dx = tether.x - position.x;
      const dy = tether.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const force = tether.strength * mass;

      if (distance > 0) {
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        acceleration.x += fx * dt;
        acceleration.y += fy * dt;
      }
    },
  },
});

const kinematics = zecs.behavior({
  name: 'kinematics',
  query: zecs.query().has(acceleration, velocity, position),
  params: z.object({ dt: z.number() }),
  deps: [gravity, tethering],
  on: {
    updated: ({ acceleration, velocity, position }, { dt }) => {
      velocity.x += acceleration.x * dt;
      velocity.y += acceleration.y * dt;

      position.x += velocity.x * dt;
      position.y += velocity.y * dt;

      acceleration.x = 0;
      acceleration.y = 0;
    },
  },
});

const walls = zecs.behavior({
  name: 'walls',
  query: zecs.query().has(collider, position, velocity),
  params: z.object({ dt: z.number() }),
  deps: [kinematics],
  on: {
    updated: ({ collider, position, velocity }) => {
      if (position.x < collider.radius) {
        position.x = collider.radius;
        velocity.x = -velocity.x * collider.restitution;
      } else if (position.x > 1 - collider.radius) {
        position.x = 1 - collider.radius;
        velocity.x = -velocity.x * collider.restitution;
      }

      if (position.y < collider.radius) {
        position.y = collider.radius;
        velocity.y = -velocity.y * collider.restitution;
      } else if (position.y > 1 - collider.radius) {
        position.y = 1 - collider.radius;
        velocity.y = -velocity.y * collider.restitution;
      }
    },
  },
});

const drawBg = zecs.behavior({
  name: 'drawBg',
  query: zecs.query(),
  params: z.object({ ctx: z.custom<CanvasRenderingContext2D>().optional() }),
  deps: [kinematics, walls],
  on: {
    preUpdate: ({ ctx }) => {
      if (!ctx) return;

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
  },
});

const drawTether = zecs.behavior({
  name: 'drawTether',
  query: zecs.query().has(tether, position),
  params: z.object({ ctx: z.custom<CanvasRenderingContext2D>().optional() }),
  deps: [kinematics, walls, drawBg],
  on: {
    updated: (entity, { ctx }) => {
      if (!ctx) return;

      const { tether, position } = entity;
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
      ctx.lineTo(tether.x, tether.y);
      ctx.strokeStyle = 'rgb(127, 127, 127)';
      ctx.lineWidth = 0.01;
      ctx.stroke();
    },
  },
});

const drawCollider = zecs.behavior({
  name: 'drawCollider',
  query: zecs.query().has(collider, position),
  params: z.object({ ctx: z.custom<CanvasRenderingContext2D>().optional() }),
  deps: [kinematics, walls, drawBg, drawTether],
  on: {
    updated: (entity, { ctx }) => {
      if (!ctx) return;

      const { collider, position } = entity;
      ctx.beginPath();
      ctx.arc(position.x, position.y, collider.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${collider.restitution * 360}, 100%, 50%)`;
      ctx.fill();
    },
  },
});

export function makeExample({ n }: { n: number }) {
  const plan = zecs.plan([
    gravity,
    tethering,
    kinematics,
    walls,
    drawBg,
    drawTether,
    drawCollider,
  ]);
  const ecs = zecs.ecs([
    mass,
    position,
    velocity,
    acceleration,
    collider,
    tether,
  ]);

  for (let i = 0; i < n; ++i) {
    ecs.add(
      ecs.entity({
        mass: Math.random(),
        position: { x: Math.random(), y: Math.random() },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        collider: {
          radius: Math.random() * 0.05 + 0.01,
          restitution: Math.random(),
        },
        ...(Math.random() < 0.1 && {
          tether: {
            x: Math.random(),
            y: Math.random(),
            strength: 10 + Math.random() * 10,
          },
        }),
      }),
    );
  }

  return { plan, ecs };
}
