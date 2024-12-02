import { Ecs, EcsQuery, EcsSchema, EcsWith } from ".";

describe("index", () => {
  it("works end-to-end", () => {
    const healthComponent = { health: 1 };
    const positionComponent = { x: 0, y: 0 };
    const velocityComponent = { dx: 0, dy: 0 };

    const healthful = EcsQuery.create().hasComponent("health", healthComponent);
    const movable = EcsQuery.create()
      .hasComponent("position", positionComponent)
      .hasComponent("velocity", velocityComponent);

    const schema = EcsSchema.create()
      .component("health", healthComponent)
      .component("position", positionComponent)
      .component("velocity", velocityComponent);

    const ecs = Ecs.fromEmpty(schema);

    function healthSystem(ecs: EcsWith<typeof healthful>) {
      for (const ent of healthful.query(ecs)) {
        ent.health.health += (1 - ent.health.health) * 0.1;
      }
    }

    function moveSystem(ecs: EcsWith<typeof movable>, dt: number) {
      for (const ent of movable.query(ecs)) {
        ent.position.x += ent.velocity.dx * dt;
        ent.position.y += ent.velocity.dy * dt;
      }
    }
  });
});
