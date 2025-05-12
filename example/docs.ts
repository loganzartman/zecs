// replace this with `from 'zecs'` in your code!
import { attachSystem, zecs } from '../src/index';
import { z } from 'zod';

// biome-ignore lint/correctness/noConstantCondition: example
if (1 > 0) throw new Error('This is an example file!');

// === 1. component ===
export const health = zecs.component('health', z.number());
export const position = zecs.component(
  'position',
  z.object({ x: z.number(), y: z.number() }),
);
export const velocity = zecs.component(
  'velocity',
  z.object({ x: z.number(), y: z.number() }),
);

// === 2. entity ===
const player = {
  health: 100,
  position: { x: 10, y: 20 },
};

// === 3. ecs ===
const ecs = zecs.ecs([health, position, velocity]);
ecs.add(player);

// === 4.1. query ===
const movable = zecs.query().has(position, velocity);

// queries are reusable and not bound to a specific ECS!
for (const entity of movable.query(ecs)) {
  entity.position.x += entity.velocity.x;
  entity.position.y += entity.velocity.y;
}

// === 4.2. query: refinement ===
declare const keys: Record<string, boolean>;

const canJump = zecs
  .query()
  .has(position, velocity)
  .where(({ position: { y } }) => y === 0);

for (const entity of canJump.query(ecs)) {
  if (keys.space) {
    entity.velocity.y = -10;
  }
}

// === 5.1. serialization ===
declare function mySave(data: string): void;
declare function myLoad(): string;

const data = ecs.toJSON();

// your serializing and saving logic
mySave(JSON.stringify(data));
const loaded = JSON.parse(myLoad());

ecs.loadJSON(loaded);

// === 5.2. serialization: references ===
const name = zecs.component('name', z.string());
const friend = zecs.component('friend', zecs.entitySchema([name]));
const friendlyEcs = zecs.ecs([name, friend]);

const kai = friendlyEcs.add({ name: 'kai' });
const jules = friendlyEcs.add({ name: 'jules' });
kai.friend = jules;
jules.friend = kai;

friendlyEcs.loadJSON(friendlyEcs.toJSON());

// === 6.1. system ===
const kinematics = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(position, velocity),

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity: { position, velocity }, updateParams: { dt } }) {
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
  },
});

const kinematicsHandle = await attachSystem(kinematics, ecs, {});

kinematicsHandle.update({ dt: 0.016 });

// === 6.2. system: lifecycle ===
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

const drawLinesHandle = await attachSystem(drawLines, lineEcs, {
  ctx,
});
drawLinesHandle.update({ ctx });

// === 6.3. system: resources ===
// pixi.js stubs
declare class Asset {}
declare const Assets: { load(src: string): Promise<Asset> };
declare class Sprite {
  position: { x: number; y: number };
  constructor(p: { texture: Asset; position: { x: number; y: number } });
  destroy(): void;
}

const drawSprites = zecs.system({
  name: 'drawSprites',
  query: zecs.query().has(position),

  initParams: z.object({
    texturePath: z.string(),
  }),

  shared: {
    async create({ initParams: { texturePath } }) {
      const texture = await Assets.load(texturePath);
      return { texture };
    },
  },

  each: {
    create({ shared: { texture }, entity }) {
      const sprite = new Sprite({
        texture,
        position: { x: entity.position.x, y: entity.position.y },
      });
      return { sprite };
    },
    destroy({ each: { sprite } }) {
      sprite.destroy();
    },
  },

  onUpdated({ each: { sprite }, entity }) {
    sprite.position.x = entity.position.x;
    sprite.position.y = entity.position.y;
  },
});

const drawSpritesHandle = await attachSystem(drawSprites, ecs, {
  texturePath: './texture.png',
});

drawSpritesHandle.update({});

// === 7.1. schedule ===
const gravitySystem = zecs.system({
  name: 'gravity',
  query: zecs.query().has(position, velocity),

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity, updateParams }) {
    entity.velocity.y -= 9.81 * updateParams.dt;
  },
});

const kinematicsSystem = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(position, velocity),

  deps: [gravitySystem],

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity, updateParams }) {
    entity.position.x += entity.velocity.x * updateParams.dt;
    entity.position.y += entity.velocity.y * updateParams.dt;
  },
});

const scheduleEcs = zecs.ecs([position, velocity]);

const schedule = await zecs.scheduleSystems(
  [kinematicsSystem, gravitySystem],
  scheduleEcs,
  {},
);

schedule.update({ dt: 0.016 });
