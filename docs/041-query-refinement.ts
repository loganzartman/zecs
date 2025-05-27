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
