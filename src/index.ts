import { component } from './component';
import { ecs } from './ecs';
import { query } from './query';

export * from './component';
export * from './ecs';
export * from './keyLookup';
export * from './query';

const zecs = { component, ecs, query };
export default zecs;
