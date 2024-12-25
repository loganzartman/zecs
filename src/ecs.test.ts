import { z } from 'zod';
import { component } from './component';
import { ecs } from './ecs';
import { query } from './query';

describe('ecs', () => {
  describe('aliasing', () => {
    it('aliases entities', () => {
      const position = component(
        'position',
        z.object({
          x: z.number(),
          y: z.number(),
        }),
      );
      const myEcs = ecs([position]);
      const entity = myEcs.entity({ position: { x: 1, y: 2 } });
      const entityId = myEcs.add(entity);

      myEcs.alias('entity', entityId);
      expect(myEcs.get('entity')).toEqual(entity);
    });
  });

  describe('serialization', () => {
    it('restores aliases', () => {
      const position = component(
        'position',
        z.object({
          x: z.number(),
          y: z.number(),
        }),
      );
      const myEcs = ecs([position]);
      const entity = myEcs.entity({ position: { x: 1, y: 2 } });
      const entityId = myEcs.add(entity);

      myEcs.alias('entity', entityId);
      expect(myEcs.get('entity')).toEqual(entity);

      const serialized = JSON.stringify(myEcs.toJSON());

      const newEcs = ecs([position]);
      newEcs.loadJSON(JSON.parse(serialized));
      expect(newEcs.get('entity')).toEqual(entity);
    });
  });

  describe('singletons', () => {
    it('creates singletons', () => {
      const rectangle = component(
        'rectangle',
        z.object({
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        }),
      );
      const rectangular = query().has(rectangle);
      const myEcs = ecs([rectangle]);

      const view = myEcs.singleton('viewKey', rectangular, () => ({
        rectangle: { x: 1, y: 2, w: 3, h: 4 },
      }));

      expect(view).toEqual({ rectangle: { x: 1, y: 2, w: 3, h: 4 } });
    });

    it("doesn't replace existing singletons", () => {
      const rectangle = component(
        'rectangle',
        z.object({
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        }),
      );
      const rectangular = query().has(rectangle);
      const myEcs = ecs([rectangle]);

      const view1 = myEcs.singleton('viewKey', rectangular, () => ({
        rectangle: { x: 1, y: 2, w: 3, h: 4 },
      }));

      expect(view1).toEqual({ rectangle: { x: 1, y: 2, w: 3, h: 4 } });

      const view2 = myEcs.singleton('viewKey', rectangular, () => ({
        rectangle: { x: 5, y: 6, w: 7, h: 8 },
      }));

      expect(view2).toEqual({ rectangle: { x: 1, y: 2, w: 3, h: 4 } });
    });
  });
});
