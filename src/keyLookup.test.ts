import { z } from 'zod';
import {
  type ComponentsEntity,
  type QueryOutput,
  component,
  ecs,
  query,
} from '.';
import { keyLookup } from './keyLookup';

describe('keyLookup', () => {
  it('can look up entities by key', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const deadEntity = {
      health: 0,
      position: { x: 0, y: 0 },
    };

    const livingEntity1 = {
      health: 1,
      position: { x: 0, y: 0 },
    };

    const livingEntity2 = {
      health: 2,
      position: { x: 0, y: 0 },
    };

    const e = ecs([health, position]);
    e.addAll([deadEntity, livingEntity1, livingEntity2]);

    const healthful = query().has(health);
    const lookup = keyLookup(e, healthful, ({ health }) => [String(health)]);

    expect(lookup.get({ health: 0 })).toEqual(new Set([deadEntity]));
  });

  it('allows a partial key function', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const e = ecs([health, position]);
    e.add(e.entity({ health: 0, position: { x: 0, y: 0 } }));

    const lookup = keyLookup(
      e,
      query().has(health, position),
      ({ position: { x, y } }: ComponentsEntity<[typeof position]>) => [
        `${x},${y}`,
      ],
    );

    lookup.get({ position: { x: 0, y: 0 } });
  });

  it('can count entities by key', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const e = ecs([health, position]);
    e.addAll([
      {
        health: 0,
        position: { x: 0, y: 0 },
      },
      {
        health: 1,
        position: { x: 0, y: 0 },
      },
      {
        health: 1,
        position: { x: 0, y: 0 },
      },
    ]);

    const healthful = query().has(health);
    const lookup = keyLookup(e, healthful, ({ health }) => [String(health)]);

    expect(lookup.count({ health: 0 })).toEqual(1);
    expect(lookup.count({ health: 1 })).toEqual(2);
    expect(lookup.count({ health: 2 })).toEqual(0);
  });

  it('can do a spatial hash', () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    /*    0   10  20  30
     *  0 +---+---+---+
     *    |   | 1 |   |
     *    | 0 |   | 2 |
     *    |   |  3|   |
     * 10 +---+---+---+
     *    |   |5  |   |
     *    |   |   | 4 |
     *    |   |   |   |
     * 20 +---+---+---+
     */
    const entities = [
      { position: { x: 5, y: 5 } },
      { position: { x: 15, y: 2 } },
      { position: { x: 25, y: 5 } },
      { position: { x: 18, y: 9 } },
      { position: { x: 25, y: 15 } },
      { position: { x: 12, y: 11 } },
    ];

    const e = ecs([position]);
    e.addAll(entities);

    const lookup = keyLookup(
      e,
      query().has(position),
      ({ position: { x, y } }: ComponentsEntity<[typeof position]>) => [
        `${Math.floor(x / 10)},${Math.floor(y / 10)}`,
      ],
    );

    expect(lookup.get(entities[1])).toEqual(
      new Set([entities[1], entities[3]]),
    );
    expect(lookup.get(entities[4])).toEqual(new Set([entities[4]]));
  });

  it('can do collision acceleration', () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const radius = component('radius', z.number());

    const entities = [
      { position: { x: 4, y: 4 }, radius: 2 },
      { position: { x: 6, y: 4 }, radius: 1 },
      { position: { x: 8, y: 8 }, radius: 1 },
    ];

    const e = ecs([position, radius]);
    e.addAll(entities);

    const collidable = query().has(position).has(radius);

    const keyFn = (entity: QueryOutput<typeof collidable>) => {
      const keys = [];
      const d0 = Math.floor(-entity.radius);
      const d1 = Math.ceil(entity.radius);
      for (let dx = d0; dx <= d1; dx++) {
        for (let dy = d0; dy <= d1; dy++) {
          const x = Math.floor(entity.position.x + dx);
          const y = Math.floor(entity.position.y + dy);
          keys.push(`${x},${y}`);
        }
      }
      return keys;
    };

    const lookup = keyLookup(e, collidable, keyFn);

    expect(lookup.get(entities[0])).toEqual(
      new Set([entities[0], entities[1]]),
    );
  });
});
