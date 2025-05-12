import z from 'zod';
import { component } from './component';
import { type ECSWith, ecs } from './ecs';
import { entitySchema } from './entitySchema';
import { query } from './query';

describe('zecs', () => {
  it('works end-to-end', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const velocity = component(
      'velocity',
      z.object({ dx: z.number(), dy: z.number() }),
    );

    const healthful = query().has(health);
    const movable = query().has(position).has(velocity);

    const e = ecs([health, position, velocity]);

    const healthfulEntity = {
      health: 1,
      position: { x: 0, y: 0 },
    };

    const movableEntity = {
      health: 1,
      position: { x: 0, y: 0 },
      velocity: { dx: 1, dy: 0 },
    };

    e.addAll([healthfulEntity, movableEntity]);

    function healthSystem(e: ECSWith<typeof healthful>) {
      for (const ent of healthful.query(e)) {
        ent.health += 1;
      }
    }

    function moveSystem(e: ECSWith<typeof movable>, dt: number) {
      for (const ent of movable.query(e)) {
        ent.position.x += ent.velocity.dx * dt;
        ent.position.y += ent.velocity.dy * dt;
      }
    }

    expect(healthfulEntity.health).toBe(1);
    healthSystem(e);
    expect(healthfulEntity.health).toBe(2);

    expect(movableEntity.position.x).toBe(0);
    moveSystem(e, 1);
    expect(movableEntity.position.x).toBe(1);
  });

  it('rejects entities with components not matching schema', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const entity1 = {
      position: { x: 0, y: 0 },
      health: 1,
    };

    const entity2 = {
      position: { x: 0, y: 0 },
    };

    const entity3 = {
      someOther: 'component',
    };

    const incompatibleEntity = {
      position: 'second',
    };

    const e = ecs([health, position]);

    e.add(entity1);
    e.add(entity2);
    e.add(entity3);
    // @ts-expect-error
    e.add(incompatibleEntity);
  });

  describe('serialization', () => {
    it('can serialize and deserialize an ecs', () => {
      const health = component('health', z.number());
      const position = component(
        'position',
        z.object({ x: z.number(), y: z.number() }),
      );
      const velocity = component(
        'velocity',
        z.object({ dx: z.number(), dy: z.number() }),
      );

      const healthfulEntity = {
        health: 1,
        position: { x: 0, y: 0 },
      };

      const movableEntity = {
        health: 1,
        position: { x: 0, y: 0 },
        velocity: { dx: 1, dy: 0 },
      };

      const e = ecs([health, position, velocity]);
      e.addAll([healthfulEntity, movableEntity]);

      const originalEntities = [...e.getAll()];
      const serialized = JSON.stringify(e.toJSON());

      e.loadJSON(JSON.parse(serialized));
      const deserializedEntities = [...e.getAll()];

      expect(deserializedEntities).toEqual(originalEntities);
    });

    it('can serialize and deserialize an ecs with entity references', () => {
      const x = component('x', z.number());
      const ref = component('ref', entitySchema([x]));
      const e1 = {
        x: 1,
      };
      const e2 = {
        x: 2,
        ref: e1,
      };
      const e3 = {
        x: 3,
        ref: e2,
      };

      const e = ecs([x, ref]);
      e.addAll([e1, e2, e3]);

      const originalEntities = [...e.getAll()];
      const serialized = JSON.stringify(e.toJSON());

      e.loadJSON(JSON.parse(serialized));
      const deserializedEntities = [...e.getAll()];
      expect(deserializedEntities).toEqual(originalEntities);
    });
  });
});
