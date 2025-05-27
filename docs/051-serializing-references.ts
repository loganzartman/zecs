import { zecs } from 'zecs';
import { z } from 'zod/v4';

const name = zecs.component('name', z.string());
const friend = zecs.component('friend', zecs.entitySchema([name]));
const friendlyEcs = zecs.ecs([name, friend]);

const kai = friendlyEcs.add({ name: 'kai' });
const jules = friendlyEcs.add({ name: 'jules' });
kai.friend = jules;
jules.friend = kai;

friendlyEcs.loadJSON(friendlyEcs.toJSON());
