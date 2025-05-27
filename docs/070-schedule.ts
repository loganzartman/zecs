import { zecs } from 'zecs';
import { z } from 'zod/v4';
import { position, velocity } from './010-component';

const gravitySystem = zecs.system({
  name: 'gravity',
  query: zecs.query().has(position, velocity),

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity, updateParams }) {
    entity.velocity.y -= 9.81 * updateParams.dt;
  },
});

const kinematicsSystem = zecs.system({
  name: 'kinematics',
  query: zecs.query().has(position, velocity),

  updateParams: z.object({ dt: z.number() }),

  onUpdated({ entity, updateParams }) {
    entity.position.x += entity.velocity.x * updateParams.dt;
    entity.position.y += entity.velocity.y * updateParams.dt;
  },
});

const scheduleEcs = zecs.ecs([position, velocity]);

const schedule = await zecs.scheduleSystems(
  scheduleEcs,
  [gravitySystem, kinematicsSystem],
  {},
);

schedule.update({ dt: 0.016 });
