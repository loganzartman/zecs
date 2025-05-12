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

const gravitySystem = zecs.system({
  name: 'gravity',
  query: zecs.query().has(acceleration),
  updateParams: z.object({ g: z.number(), dt: z.number() }),
  onUpdated: ({ entity, updateParams: { g, dt } }) => {
    entity.acceleration.y = g * dt;
  },
});

const tetheringSystem = zecs.system({
  name: 'tethering',
  query: zecs.query().has(tether, position, acceleration, mass),
  updateParams: z.object({ dt: z.number() }),
  deps: [],
  onUpdated: ({ entity, updateParams: { dt } }) => {
    const { tether, position, acceleration, mass } = entity;
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
});

const kinematicsSystem = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(acceleration, velocity, position),
  updateParams: z.object({ dt: z.number() }),
  deps: [gravitySystem, tetheringSystem],
  onUpdated: ({ entity, updateParams: { dt } }) => {
    const { acceleration, velocity, position } = entity;
    velocity.x += acceleration.x * dt;
    velocity.y += acceleration.y * dt;

    position.x += velocity.x * dt;
    position.y += velocity.y * dt;

    acceleration.x = 0;
    acceleration.y = 0;
  },
});

const wallsSystem = zecs.system({
  name: 'walls',
  query: zecs.query().has(collider, position, velocity),
  deps: [kinematicsSystem],
  onUpdated: ({ entity }) => {
    const { collider, position, velocity } = entity;

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
});

const drawBgSystem = zecs.system({
  name: 'drawBg',
  query: zecs.query(),
  updateParams: z.object({
    ctx: z.custom<CanvasRenderingContext2D>().optional(),
    dt: z.number(),
  }),
  deps: [wallsSystem], // Draw after physics is done
  onPreUpdate: ({ updateParams: { ctx } }) => {
    if (!ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
});

const drawTetherSystem = zecs.system({
  name: 'drawTether',
  query: zecs.query().has(tether, position),
  updateParams: z.object({
    ctx: z.custom<CanvasRenderingContext2D>().optional(),
    dt: z.number(),
  }),
  deps: [drawBgSystem], // Draw after background
  onUpdated: ({ entity, updateParams: { ctx } }) => {
    if (!ctx) return;

    const { tether, position } = entity;
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    ctx.lineTo(tether.x, tether.y);
    ctx.strokeStyle = 'rgb(127, 127, 127)';
    ctx.lineWidth = 0.01;
    ctx.stroke();
  },
});

const drawColliderSystem = zecs.system({
  name: 'drawCollider',
  query: zecs.query().has(collider, position),
  updateParams: z.object({
    ctx: z.custom<CanvasRenderingContext2D>().optional(),
    dt: z.number(),
  }),
  deps: [drawTetherSystem], // Draw after tethers
  onUpdated: ({ entity, updateParams: { ctx } }) => {
    if (!ctx) return;

    const { collider, position } = entity;
    ctx.beginPath();
    ctx.arc(position.x, position.y, collider.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${collider.restitution * 360}, 100%, 50%)`;
    ctx.fill();
  },
});

export async function makeExample({ n }: { n: number }) {
  const ecs = zecs.ecs([
    mass,
    position,
    velocity,
    acceleration,
    collider,
    tether,
  ]);

  // Create a schedule based on system dependencies
  const schedule = await zecs.scheduleSystems(
    [
      gravitySystem,
      tetheringSystem,
      kinematicsSystem,
      wallsSystem,
      drawBgSystem,
      drawTetherSystem,
      drawColliderSystem,
    ],
    ecs,
    {},
  );

  // Create entities
  for (let i = 0; i < n; ++i) {
    ecs.add({
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
    });
  }

  return { ecs, schedule };
}
