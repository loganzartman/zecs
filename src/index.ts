import { component } from './component';
import { ecs } from './ecs';
import { event } from './event';
import { keyLookup } from './keyLookup';
import { observe } from './observe';
import { query } from './query';

export * from './component';
export * from './ecs';
export * from './event';
export * from './keyLookup';
export * from './observe';
export * from './query';

const zecs = { component, ecs, event, keyLookup, observe, query };
export default zecs;
