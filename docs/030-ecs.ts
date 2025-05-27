import { zecs } from 'zecs';
import { health, position, velocity } from './010-component';
import { player } from './020-entity';

export const ecs = zecs.ecs([health, position, velocity]);
ecs.add(player);
