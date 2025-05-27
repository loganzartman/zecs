import { zecs } from 'zecs';
import { position, velocity } from './010-component';
import { ecs } from './030-ecs';

const movable = zecs.query().has(position, velocity);

// queries are reusable and not bound to a specific ECS!
for (const entity of movable.query(ecs)) {
  entity.position.x += entity.velocity.x;
  entity.position.y += entity.velocity.y;
}
