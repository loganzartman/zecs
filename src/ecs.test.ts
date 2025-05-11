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

    it('removes aliases when clearing all entities', () => {
      const health = component('health', z.number());
      const myEcs = ecs([health]);
      const entity = myEcs.entity({ health: 10 });
      const entityId = myEcs.add(entity);

      myEcs.alias('entity', entityId);
      expect(myEcs.get('entity')).toEqual(entity);
      expect(Object.keys(myEcs.aliases)).toHaveLength(1);

      myEcs.removeAll();
      expect(myEcs.get('entity')).toBeUndefined();
      expect(Object.keys(myEcs.aliases)).toHaveLength(0);
    });

    it('removes alias when removing entity', () => {
      const health = component('health', z.number());
      const myEcs = ecs([health]);
      const entity1 = myEcs.entity({ health: 10 });
      const entity1Id = myEcs.add(entity1);
      const entity2 = myEcs.entity({ health: 20 });
      const entity2Id = myEcs.add(entity2);

      myEcs.alias('entity1', entity1Id);
      myEcs.alias('entity2', entity2Id);
      expect(myEcs.get('entity1')).toEqual(entity1);
      expect(myEcs.get('entity2')).toEqual(entity2);
      expect(Object.keys(myEcs.aliases)).toHaveLength(2);

      myEcs.remove(entity1Id);
      expect(myEcs.get('entity1')).toBeUndefined();
      expect(myEcs.get('entity2')).toEqual(entity2);
      expect(Object.keys(myEcs.aliases)).toHaveLength(1);
    });

    it('removes all aliases to entity when removing entity', () => {
      const health = component('health', z.number());
      const myEcs = ecs([health]);
      const entity = myEcs.entity({ health: 10 });
      const entityId = myEcs.add(entity);

      myEcs.alias('entity1', entityId);
      myEcs.alias('entity2', entityId);
      expect(myEcs.get('entity1')).toEqual(entity);
      expect(myEcs.get('entity2')).toEqual(entity);
      expect(Object.keys(myEcs.aliases)).toHaveLength(2);

      myEcs.remove(entityId);
      expect(myEcs.get('entity1')).toBeUndefined();
      expect(myEcs.get('entity2')).toBeUndefined();
      expect(Object.keys(myEcs.aliases)).toHaveLength(0);
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

      myEcs.alias('test-alias', entityId);
      expect(myEcs.get('test-alias')).toEqual(entity);

      const serialized = JSON.stringify(myEcs.toJSON());

      const newEcs = ecs([position]);
      newEcs.loadJSON(JSON.parse(serialized));
      expect(newEcs.get('test-alias')).toEqual(entity);
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

      const getView = myEcs.singleton('viewKey', rectangular, () => ({
        rectangle: { x: 1, y: 2, w: 3, h: 4 },
      }));

      expect(getView()).toEqual({ rectangle: { x: 1, y: 2, w: 3, h: 4 } });
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

      const getView1 = myEcs.singleton('viewKey', rectangular, () => ({
        rectangle: { x: 1, y: 2, w: 3, h: 4 },
      }));

      expect(getView1()).toEqual({ rectangle: { x: 1, y: 2, w: 3, h: 4 } });

      const getView2 = myEcs.singleton('viewKey', rectangular, () => ({
        rectangle: { x: 5, y: 6, w: 7, h: 8 },
      }));

      expect(getView2()).toEqual({ rectangle: { x: 1, y: 2, w: 3, h: 4 } });
    });
  });
});
