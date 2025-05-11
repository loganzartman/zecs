# zecs

strongly-typed, unopinionated, fast-enough **entity-component-system** system for hobby use

tightly integrated with [zod](https://zod.dev/) for schemas

`pnpm add zecs`

`npm install --save zecs`

## basics

zecs is a composition-based approach to organizing data and updates:

**components** are just named types:

```ts
import {z} from 'zod';
import {component} from 'zecs';

export const health = component('health', z.number());
export const position = component('position', z.object({x: z.number(), y: z.number()}));
export const velocity = component('velocity', z.object({x: z.number(), y: z.number()}));
```

**entities** are plain objects, and each property is a component:

```ts
const player = {
  health: 100,
  position: {x: 10, y: 20},
};
```

an **ecs** stores entities:

```ts
import {ecs} from 'zecs';

const myEcs = ecs([health, position, velocity]);
myEcs.add(player);
```

**queries** select entities based on what components they have...

```ts
import {query} from 'zecs';

const movable = query().has(position, velocity);
const alive = query().has(health).where(({health}) => health > 0);

for (const entity of movable.query(myEcs)) {
  if (!alive.match(entity)) continue;
  entity.position.x += entity.velocity.x;
  entity.position.y += entity.velocity.y;
}
```

or any condition you want:

```ts
import {query} from 'zecs';

const canJump = query().has(position, velocity)
  .where(({position: {y}) => y === 0);

for (const entity of canJump.query(myEcs)) {
  if (keys.space) {
    entity.velocity.y = -10;
  }
}
```

## serialization

every zecs ECS is serializable, meaning that it can be converted to and from a plain object:

```ts
import {ecs} from 'zecs';

const myEcs = ecs([]);

const data = myECS.toJSON();

// your serializing and saving logic
mySave(JSON.stringify(data));
const loaded = JSON.parse(myLoad(data));

myECS.loadJSON(loaded);
```

components may contain other entities, and zecs will automatically convert them to and from references when serializing:

```ts
import {component, ecs} from 'zecs';

const name = component('name', z.string());
const friend = component('friend', z.object({name: name.schema}));
const myEcs = ecs([name, friend]);

const kai = {name: 'kai'};
const jules = {name: 'jules'};
kai.friend = jules;
jules.friend = kai;

myEcs.
```

and for a limited time only:

* `toJSON` and `fromJSON`: turn an `ecs` to and from a plain object
* `alias` for assigning a key to a specific entity
* `singleton` for storing a unique object (and maybe serializing it)
* `event`: tiny, strongly-typed event emitter
* airtight, intuitive types
