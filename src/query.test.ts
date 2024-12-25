import { z } from 'zod';
import { component } from './component';
import { type ECSWith, ecs } from './ecs';
import { query } from './query';

describe('query', () => {
  it('intersects queries', () => {
    const water = component('water', z.number());
    const light = component('light', z.number());
    const height = component('height', z.number());

    const planted = query().has(water).has(light);
    const heightful = query().has(height);
    const growable = planted.intersect(heightful);

    const myEcs = ecs([water, light, height]);
    const entity = myEcs.entity({ light: 1, water: 1, height: 1 });

    myEcs.add(entity);
    const result = [...growable.query(myEcs)];
    expect(result).toEqual([entity]);
  });
});
