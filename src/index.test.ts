import z from 'zod';
import { Ecs, EcsQuery, EcsSchema, type EcsWith } from '.';

describe('zecs', () => {
  it('works end-to-end', () => {
    const healthSchema = z.number();
    const positionSchema = z.object({ x: z.number(), y: z.number() });
    const velocitySchema = z.object({ dx: z.number(), dy: z.number() });

    const healthful = EcsQuery.create().hasComponent('health', healthSchema);
    const movable = EcsQuery.create()
      .hasComponent('position', positionSchema)
      .hasComponent('velocity', velocitySchema);

    const schema = EcsSchema.create()
      .component('health', healthSchema)
      .component('position', positionSchema)
      .component('velocity', velocitySchema);

    const healthfulEntity = {
      health: 1,
      position: { x: 0, y: 0 },
    };

    const movableEntity = {
      health: 1,
      position: { x: 0, y: 0 },
      velocity: { dx: 1, dy: 0 },
    };

    const ecs = Ecs.from({
      schema,
      entities: [healthfulEntity, movableEntity],
    });

    function healthSystem(ecs: EcsWith<typeof healthful>) {
      for (const ent of healthful.query(ecs)) {
        ent.health += 1;
      }
    }

    function moveSystem(ecs: EcsWith<typeof movable>, dt: number) {
      for (const ent of movable.query(ecs)) {
        ent.position.x += ent.velocity.dx * dt;
        ent.position.y += ent.velocity.dy * dt;
      }
    }

    expect(healthfulEntity.health).toBe(1);
    healthSystem(ecs);
    expect(healthfulEntity.health).toBe(2);

    expect(movableEntity.position.x).toBe(0);
    moveSystem(ecs, 1);
    expect(movableEntity.position.x).toBe(1);
  });

  it('rejects entities with components not matching schema', () => {
    const healthSchema = z.number();
    const schema = EcsSchema.create().component('health', healthSchema);

    const healthfulEntity1 = {
      position: { x: 0, y: 0 },
      health: 1,
    };

    const healthfulEntity2 = {
      health: { value: 1 },
    };

    const unhealthfulEntity = {
      position: { x: 0, y: 0 },
    };

    Ecs.from({
      schema,
      entities: [
        healthfulEntity1,
        unhealthfulEntity,
        // @ts-expect-error: healthfulEntity2 has the wrong schema
        healthfulEntity2,
      ],
    });
  });

  describe('hasComponent queries', () => {
    it('can query for entities with a single component', () => {
      const healthSchema = z.number();
      const healthful = EcsQuery.create().hasComponent('health', healthSchema);
      const schema = EcsSchema.create().component('health', healthSchema);

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

      const ecs = Ecs.from({
        schema,
        entities: [healthfulEntity1, unhealthfulEntity, healthfulEntity2],
      });

      const healthfulEntities = [...healthful.query(ecs)];

      expect(healthfulEntities).toEqual([healthfulEntity1, healthfulEntity2]);
    });

    it('can query for entities with two components', () => {
      const positionSchema = z.object({ x: z.number(), y: z.number() });
      const velocitySchema = z.object({ dx: z.number(), dy: z.number() });

      const movable = EcsQuery.create()
        .hasComponent('position', positionSchema)
        .hasComponent('velocity', velocitySchema);

      const schema = EcsSchema.create()
        .component('position', positionSchema)
        .component('velocity', velocitySchema);

      const movableEntity = {
        position: { x: 0, y: 0 },
        velocity: { dx: 0, dy: 0 },
      } as const;

      const immovableEntity = {
        position: { x: 0, y: 0 },
      } as const;

      const ecs = Ecs.from({
        schema,
        entities: [movableEntity, immovableEntity],
      });

      const movableEntities = [...movable.query(ecs)];

      expect(movableEntities).toEqual([movableEntity]);
    });
  });

  describe('where queries', () => {
    it('can query for an entity with specific data', () => {
      const healthSchema = z.number();

      const alive = EcsQuery.create()
        .hasComponent('health', healthSchema)
        .where(({ health }) => health > 0);

      const schema = EcsSchema.create().component('health', healthSchema);

      const aliveEntity = {
        health: 1,
      } as const;

      const deadEntity = {
        health: 0,
      } as const;

      const ecs = Ecs.from({ schema, entities: [aliveEntity, deadEntity] });

      const aliveEntities = [...alive.query(ecs)];

      expect(aliveEntities).toEqual([aliveEntity]);
    });

    it('can be chained', () => {
      const healthSchema = z.number();

      const hurt = EcsQuery.create()
        .hasComponent('health', healthSchema)
        .where(({ health }) => health > 0)
        .where(({ health }) => health < 1);

      const schema = EcsSchema.create().component('health', healthSchema);

      const healthyEntity = {
        health: 1,
      } as const;

      const hurtEntity = {
        health: 0.5,
      } as const;

      const ecs = Ecs.from({ schema, entities: [healthyEntity, hurtEntity] });

      const hurtEntities = [...hurt.query(ecs)];

      expect(hurtEntities).toEqual([hurtEntity]);
    });
  });

  describe('serialization', () => {
    it('can serialize and deserialize an ecs', () => {
      const healthSchema = z.number();
      const positionSchema = z.object({ x: z.number(), y: z.number() });
      const velocitySchema = z.object({ dx: z.number(), dy: z.number() });

      const schema = EcsSchema.create()
        .component('health', healthSchema)
        .component('position', positionSchema)
        .component('velocity', velocitySchema);

      const healthfulEntity = {
        health: 1,
        position: { x: 0, y: 0 },
      };

      const movableEntity = {
        health: 1,
        position: { x: 0, y: 0 },
        velocity: { dx: 1, dy: 0 },
      };

      const ecs = Ecs.from({
        schema,
        entities: [healthfulEntity, movableEntity],
      });

      const serialized = JSON.stringify(ecs.serialize());
      const deserialized = Ecs.deserialize({
        schema,
        data: JSON.parse(serialized),
      });

      expect(deserialized.entities).toEqual(ecs.entities);
    });
  });

  describe('filter', () => {
    it('can filter entities', () => {
      const healthSchema = z.number();

      const schema = EcsSchema.create().component('health', healthSchema);

      const healthfulEntity1 = {
        health: 1,
      };
      const healthfulEntity2 = {
        health: 2,
      };
      const unhealthfulEntity = {
        health: 0,
      };

      const ecs = Ecs.from({
        schema,
        entities: [healthfulEntity1, healthfulEntity2, unhealthfulEntity],
      });

      const alive = EcsQuery.create()
        .hasComponent('health', healthSchema)
        .where(({ health }) => health > 0);

      ecs.filter(alive);

      expect(ecs.entities).not.toContain(unhealthfulEntity);
      expect(ecs.entities).toEqual([healthfulEntity1, healthfulEntity2]);
    });
  });
});
