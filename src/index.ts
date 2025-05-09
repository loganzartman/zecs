import { behavior } from './behavior';
import { component } from './component';
import { ecs } from './ecs';
import { event } from './event';
import { keyLookup } from './keyLookup';
import { observe } from './observe';
import { plan } from './plan';
import { query } from './query';
import { system } from './system';

export * from './component';
export * from './ecs';
export * from './event';
export * from './keyLookup';
export * from './observe';
export * from './query';
export * from './behavior';
export * from './plan';
export * from './system';

export const zecs = {
  component,
  ecs,
  event,
  keyLookup,
  observe,
  query,
  behavior,
  plan,
  system,
};

export default zecs;
