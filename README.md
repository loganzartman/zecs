# zecs

strongly-typed, unopinionated, fast-enough **entity-component-system** system for hobby use[^1]

[^1]: that's what i use it for, so ymmv

_zecs_ is a **composition-based** approach to organizing data and updates!

tightly integrated with [zod](https://zod.dev/) for schemas

```sh
pnpm add zecs
```

```sh
npm install --save zecs
```

```sh
yarn add zecs
```

you can import individual pieces, or the whole thing:

```ts
import {component, query} from 'zecs';
import {zecs} from 'zecs';
```

## basics

### component

**components** are just [zod types](https://zod.dev/?id=introduction) with names:

```ts
// docs/010-component.ts

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

```

### entity

**entities** are plain objects where each property matches a component:

```ts
// docs/020-entity.ts

export const player = {
  health: 100,
  position: { x: 10, y: 20 },
};

```

### ecs

an **ecs** stores entities that conform to some set of components:

```ts
// docs/030-ecs.ts

import { zecs } from 'zecs';
import { health, position, velocity } from './010-component';
import { player } from './020-entity';

export const ecs = zecs.ecs([health, position, velocity]);
ecs.add(player);

```

> [!NOTE]
> every component is optional! this allows behavior to differ between entities, and it's why we need queries.

### query

**queries** select entities based on what components they have...

```ts
// docs/040-query.ts

import { zecs } from 'zecs';
import { position, velocity } from './010-component';
import { ecs } from './030-ecs';

const movable = zecs.query().has(position, velocity);

// queries are reusable and not bound to a specific ECS!
for (const entity of movable.query(ecs)) {
  entity.position.x += entity.velocity.x;
  entity.position.y += entity.velocity.y;
}

```

or any condition you want:

```ts
// docs/041-query-refinement.ts

import { zecs } from 'zecs';
import { position, velocity } from './010-component';
import { ecs } from './030-ecs';

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

```

## serialization

every zecs ECS is serializable, meaning that it can be converted to and from a plain object:

```ts
// docs/050-serialization.ts

import { ecs } from './030-ecs';

declare function mySave(data: string): void;
declare function myLoad(): string;

const data = ecs.toJSON();

// your serializing and saving logic
mySave(JSON.stringify(data));
const loaded = JSON.parse(myLoad());

ecs.loadJSON(loaded);

```

components may contain other entities, and zecs will automatically convert them to and from references when serializing:

```ts
// docs/051-serializing-references.ts

import { zecs } from 'zecs';
import { z } from 'zod/v4';

const name = zecs.component('name', z.string());
const friend = zecs.component('friend', zecs.entitySchema([name]));
const friendlyEcs = zecs.ecs([name, friend]);

const kai = friendlyEcs.add({ name: 'kai' });
const jules = friendlyEcs.add({ name: 'jules' });
kai.friend = jules;
jules.friend = kai;

friendlyEcs.loadJSON(friendlyEcs.toJSON());

```

## system

it's just fine to put a query in a function and be done with it.

i'll also offer you the **system**. the simplest system is just like looping over every entity in a query:

```ts
// docs/060-system.ts

import { zecs } from 'zecs';
import { z } from 'zod/v4';
import { position, velocity } from './010-component';
import { ecs } from './030-ecs';

const kinematics = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(position, velocity),

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity: { position, velocity }, updateParams: { dt } }) {
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
  },
});

const kinematicsHandle = await zecs.attachSystem(ecs, kinematics, {});

kinematicsHandle.update({ dt: 0.016 });

```

a system, much like a component or a query, is just a description. **attaching** the system to an ECS returns a stateful "handle", which can be `.update()` every frame or step.

```ts
// docs/061-system-lifecycle.ts

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

```

### resources

a system can also have **resources**--both **shared** and for **each** entity:

```ts
// docs/062-system-resources.ts

import { zecs } from 'zecs';
import { z } from 'zod/v4';
import { position } from './010-component';
import { ecs } from './030-ecs';

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

const drawSpritesHandle = await zecs.attachSystem(ecs, drawSprites, {
  texturePath: './texture.png',
});

drawSpritesHandle.update({});

```

**shared** resources get created when the system is **attached** to an ECS. in most cases, this is just once.

**each** resources are created for each entity that matches the query. they persist as long as it keeps matching, and then they get destroyed.

## schedule

you can attach an individual system to an ECS and update it by hand, but what if you have a lot?

sure can be tedious to juggle a bunch of system `update()`s.

schedules take a list of systems and give you a handle to update all of them at once (in a strongly-typed fashion, of course.)

```ts
// docs/070-schedule.ts

import { zecs } from 'zecs';
import { z } from 'zod/v4';
import { position, velocity } from './010-component';

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

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity, updateParams }) {
    entity.position.x += entity.velocity.x * updateParams.dt;
    entity.position.y += entity.velocity.y * updateParams.dt;
  },
});

const scheduleEcs = zecs.ecs([position, velocity]);

const schedule = await zecs.scheduleSystems(
  scheduleEcs,
  [gravitySystem, kinematicsSystem],
  {},
);

schedule.update({ dt: 0.016 });

```
