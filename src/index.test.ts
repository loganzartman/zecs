import z from 'zod';
import { component } from './component';
import { type ECSWith, ecs } from './ecs';
import { query } from './query';
import type { Empty } from './util';

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

  describe('has() queries', () => {
    it('can query for entities with a single component', () => {
      const health = component('health', z.number());
      const healthful = query().has(health);

      const healthfulEntity1 = {
        position: { x: 0, y: 0 },
        health: 1,
      };

      const healthfulEntity2 = {
        health: 1,
      };

      const unhealthfulEntity = {
        position: { x: 0, y: 0 },
      };

      const e = ecs([health]);
      e.addAll([healthfulEntity1, healthfulEntity2, unhealthfulEntity]);

      const healthfulEntities = [...healthful.query(e)];

      expect(healthfulEntities).toEqual([healthfulEntity1, healthfulEntity2]);
    });

    it('can query for entities with two components', () => {
      const position = component(
        'position',
        z.object({ x: z.number(), y: z.number() }),
      );
      const velocity = component(
        'velocity',
        z.object({ dx: z.number(), dy: z.number() }),
      );
      const movable = query().has(position).has(velocity);

      const movableEntity = {
        position: { x: 0, y: 0 },
        velocity: { dx: 0, dy: 0 },
      };

      const immovableEntity = {
        position: { x: 0, y: 0 },
      };

      const e = ecs([position, velocity]);
      e.addAll([movableEntity, immovableEntity]);

      const movableEntities = [...movable.query(e)];

      expect(movableEntities).toEqual([movableEntity]);
    });
  });

  describe('where queries', () => {
    it('can query for an entity with specific data', () => {
      const health = component('health', z.number());
      const alive = query()
        .has(health)
        .where(({ health }) => health > 0);

      const aliveEntity = {
        health: 1,
      } as const;

      const deadEntity = {
        health: 0,
      } as const;

      const e = ecs([health]);
      e.addAll([aliveEntity, deadEntity]);

      const aliveEntities = [...alive.query(e)];

      expect(aliveEntities).toEqual([aliveEntity]);
    });

    it('can be chained', () => {
      const health = component('health', z.number());
      const hurt = query()
        .has(health)
        .where(({ health }) => health > 0)
        .where(({ health }) => health < 1);

      const healthyEntity = {
        health: 1,
      } as const;

      const hurtEntity = {
        health: 0.5,
      } as const;

      const e = ecs([health]);
      e.addAll([healthyEntity, hurtEntity]);

      const hurtEntities = [...hurt.query(e)];

      expect(hurtEntities).toEqual([hurtEntity]);
    });
  });

  describe('queryOnly()', () => {
    it('returns the matching entity', () => {
      const health = component('health', z.number());
      const healthful = query().has(health);

      const healthfulEntity = {
        health: 1,
      };

      const e = ecs([health]);
      e.add(healthfulEntity);

      const entity = healthful.queryOnly(e);

      expect(entity).toEqual(healthfulEntity);
    });

    it('throws if no entity matches', () => {
      const health = component('health', z.number());
      const healthful = query().has(health);

      const e = ecs([health]);

      expect(() => healthful.queryOnly(e)).toThrow();
    });

    it('throws if more than one entity matches', () => {
      const health = component('health', z.number());
      const healthful = query().has(health);

      const healthfulEntity1 = {
        health: 1,
      };

      const healthfulEntity2 = {
        health: 1,
      };

      const e = ecs([health]);
      e.addAll([healthfulEntity1, healthfulEntity2]);

      expect(() => healthful.queryOnly(e)).toThrow();
    });
  });

  describe('match()', () => {
    it('returns true if the entity matches the query', () => {
      const health = component('health', z.number());
      const position = component(
        'position',
        z.object({ x: z.number(), y: z.number() }),
      );
      const healthful = query().has(health);

      const entity = {
        health: 1,
        position: { x: 0, y: 0 },
      };

      expect(healthful.match(entity)).toBe(true);
    });

    it('returns false if the entity does not match the query', () => {
      const health = component('health', z.number());
      const healthful = query().has(health);

      const entity = {
        position: { x: 0, y: 0 },
      };

      expect(healthful.match(entity)).toBe(false);
    });

    it('refines the type of the entity', () => {
      const health = component('health', z.number());
      const healthful = query().has(health);

      const entity = {
        health: 1,
      };

      function doSomething(e: Empty) {
        if (healthful.match(e)) {
          e.health;
        }
      }
      doSomething(entity);
    });
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
      const ref = component('ref', z.unknown());
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
