import { component } from './component';
import { ecs } from './ecs';
import { event } from './event';
import { keyLookup } from './keyLookup';
import { query } from './query';

export * from './component';
export * from './ecs';
export * from './event';
export * from './keyLookup';
export * from './query';

const zecs = { component, ecs, event, keyLookup, query };
export default zecs;
