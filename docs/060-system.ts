import { zecs } from 'zecs';
import { z } from 'zod/v4';
import { position, velocity } from './010-component';
import { ecs } from './030-ecs';

const kinematics = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(position, velocity),

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity: { position, velocity }, updateParams: { dt } }) {
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
  },
});

const kinematicsHandle = await zecs.attachSystem(ecs, kinematics, {});

kinematicsHandle.update({ dt: 0.016 });
