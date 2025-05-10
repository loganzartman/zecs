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
  params: z.object({ g: z.number(), dt: z.number() }),
  deps: [], // No dependencies
  onUpdated: ({ entity, params }) => {
    entity.acceleration.y = params.g * params.dt;
  },
});

const tetheringSystem = zecs.system({
  name: 'tethering',
  query: zecs.query().has(tether, position, acceleration, mass),
  params: z.object({ dt: z.number() }),
  deps: [], // No dependencies
  onUpdated: ({ entity, params }) => {
    const { tether, position, acceleration, mass } = entity;
    const dx = tether.x - position.x;
    const dy = tether.y - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const force = tether.strength * mass;

    if (distance > 0) {
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      acceleration.x += fx * params.dt;
      acceleration.y += fy * params.dt;
    }
  },
});

const kinematicsSystem = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(acceleration, velocity, position),
  params: z.object({ dt: z.number() }),
  deps: [gravitySystem, tetheringSystem], // Depends on acceleration systems
  onUpdated: ({ entity, params }) => {
    const { acceleration, velocity, position } = entity;
    velocity.x += acceleration.x * params.dt;
    velocity.y += acceleration.y * params.dt;

    position.x += velocity.x * params.dt;
    position.y += velocity.y * params.dt;

    acceleration.x = 0;
    acceleration.y = 0;
  },
});

const wallsSystem = zecs.system({
  name: 'walls',
  query: zecs.query().has(collider, position, velocity),
  params: z.object({ dt: z.number() }),
  deps: [kinematicsSystem], // Depends on kinematics
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
  params: z.object({
    ctx: z.custom<CanvasRenderingContext2D>().optional(),
    dt: z.number(),
  }),
  deps: [wallsSystem], // Draw after physics is done
  onPreUpdate: ({ params }) => {
    const { ctx } = params;
    if (!ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
});

const drawTetherSystem = zecs.system({
  name: 'drawTether',
  query: zecs.query().has(tether, position),
  params: z.object({
    ctx: z.custom<CanvasRenderingContext2D>().optional(),
    dt: z.number(),
  }),
  deps: [drawBgSystem], // Draw after background
  onUpdated: ({ entity, params }) => {
    const { ctx } = params;
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
  params: z.object({
    ctx: z.custom<CanvasRenderingContext2D>().optional(),
    dt: z.number(),
  }),
  deps: [drawTetherSystem], // Draw after tethers
  onUpdated: ({ entity, params }) => {
    const { ctx } = params;
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

  // Function to update all systems according to the schedule
  const update = (params: { dt: number; ctx?: CanvasRenderingContext2D }) => {
    // The schedule will execute all systems in the correct dependency order
    schedule.update({
      g: 9.8,
      dt: params.dt,
      ctx: params.ctx,
    });
  };

  // Clean up function - the schedule handles stopping all system handles
  const cleanup = async () => {
    await schedule.stop();
  };

  return { ecs, update, cleanup };
}
