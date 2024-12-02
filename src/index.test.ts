import { Ecs, EcsQuery, EcsSchema, type EcsWith } from '.';

describe('zecs', () => {
  it('works end-to-end', () => {
    const healthComponent = { health: 1 };
    const positionComponent = { x: 0, y: 0 };
    const velocityComponent = { dx: 0, dy: 0 };

    const healthful = EcsQuery.create().hasComponent('health', healthComponent);
    const movable = EcsQuery.create()
      .hasComponent('position', positionComponent)
      .hasComponent('velocity', velocityComponent);

    const schema = EcsSchema.create()
      .component('health', healthComponent)
      .component('position', positionComponent)
      .component('velocity', velocityComponent);

    const healthfulEntity = {
      position: { x: 0, y: 0 },
      health: { health: 1 },
    } as const;

    const movableEntity = {
      position: { x: 0, y: 0 },
      velocity: { dx: 1, dy: 0 },
      health: { health: 1 },
    } as const;

    const ecs = Ecs.fromEntities(schema, [healthfulEntity, movableEntity]);

    function healthSystem(ecs: EcsWith<typeof healthful>) {
      for (const ent of healthful.query(ecs)) {
        ent.health.health += 1;
      }
    }

    function moveSystem(ecs: EcsWith<typeof movable>, dt: number) {
      for (const ent of movable.query(ecs)) {
        ent.position.x += ent.velocity.dx * dt;
        ent.position.y += ent.velocity.dy * dt;
      }
    }

    expect(healthfulEntity.health.health).toBe(1);
    healthSystem(ecs);
    expect(healthfulEntity.health.health).toBe(2);

    expect(movableEntity.position.x).toBe(0);
    moveSystem(ecs, 1);
    expect(movableEntity.position.x).toBe(1);
  });

  describe('component queries', () => {
    it('can query for entities with a single component', () => {
      const healthComponent = { health: 1 };

      const healthful = EcsQuery.create().hasComponent(
        'health',
        healthComponent,
      );

      const schema = EcsSchema.create().component('health', healthComponent);

      const healthfulEntity1 = {
        position: { x: 0, y: 0 },
        health: { health: 1 },
      } as const;

      const healthfulEntity2 = {
        health: { health: 1 },
      } as const;

      const unhealthfulEntity = {
        position: { x: 0, y: 0 },
      } as const;

      const ecs = Ecs.fromEntities(schema, [
        healthfulEntity1,
        unhealthfulEntity,
        healthfulEntity2,
      ]);

      const healthfulEntities = [...healthful.query(ecs)];

      expect(healthfulEntities).toEqual([healthfulEntity1, healthfulEntity2]);
    });
  });
});
