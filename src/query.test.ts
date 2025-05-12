import { z } from 'zod';
import { component } from './component';
import { type EntityLike, ecs } from './ecs';
import { query } from './query';

describe('query', () => {
  describe('has()', () => {
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
      const movable = query().has(position, velocity);

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

  describe('where()', () => {
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

      function doSomething(e: EntityLike) {
        if (healthful.match(e)) {
          e.health;
        }
      }
      doSomething(entity);
    });
  });

  describe('and()', () => {
    it('combines queries', () => {
      const water = component('water', z.number());
      const light = component('light', z.number());
      const height = component('height', z.number());

      const planted = query().has(water, light);
      const heightful = query().has(height);
      const growable = planted.and(heightful);

      const myEcs = ecs([water, light, height]);
      const entity = myEcs.add({ light: 1, water: 1, height: 1 });
      const other = myEcs.add({ light: 1, water: 1 });

      const result = [...growable.query(myEcs)];
      expect(result).toEqual([entity]);
    });
  });

  describe('count()', () => {
    it('counts the number of entities that match the query', () => {
      const health = component('health', z.number());
      const position = component(
        'position',
        z.object({ x: z.number(), y: z.number() }),
      );
      const healthful = query().has(health);

      const e = ecs([health, position]);
      e.addAll([
        { health: 1, position: { x: 0, y: 0 } },
        { health: 2, position: { x: 0, y: 0 } },
        { position: { x: 0, y: 0 } },
      ]);

      const count = healthful.count(e);

      expect(count).toEqual(2);
    });
  });
});
