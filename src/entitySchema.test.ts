import { z } from 'zod/v4';
import { component } from './component';
import { entitySchema } from './entitySchema';

describe('entitySchema', () => {
  it('makes schema that matches corresponding entity', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const entity = {
      health: 1,
      position: { x: 0, y: 0 },
    };
    const schema = entitySchema([health, position]);

    expect(schema.safeParse(entity).success).toBe(true);
  });

  it('makes schema that matches a partial entity', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const entity = {
      health: 1,
    };
    const schema = entitySchema([health, position]);

    expect(schema.safeParse(entity).success).toBe(true);
  });

  it('makes schema that rejects entities with components not matching schema', () => {
    const health = component('health', z.number());
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const entity = {
      health: 1,
      position: { x: 0, y: 'not a number' },
    };
    const schema = entitySchema([health, position]);

    expect(schema.safeParse(entity).success).toBe(false);
  });
});
