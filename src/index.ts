import { component } from './component';
import { ecs } from './ecs';
import { entitySchema } from './entitySchema';
import { event } from './event';
import { keyLookup } from './keyLookup';
import { observe } from './observe';
import { query } from './query';
import { scheduleSystems } from './schedule';
import { system } from './system';
import { attachSystem } from './system';

export * from './component';
export * from './query';
export * from './ecs';
export * from './entitySchema';
export * from './event';
export * from './keyLookup';
export * from './observe';
export * from './system';
export * from './schedule';

export const zecs = {
  attachSystem,
  component,
  ecs,
  entitySchema,
  event,
  keyLookup,
  observe,
  query,
  system,
  scheduleSystems,
};

export default zecs;
