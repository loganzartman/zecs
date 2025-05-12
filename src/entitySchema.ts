import { type ZodType, z } from 'zod';
import type { ComponentArrayLike, ComponentsEntity } from './ecs';
import type { EncodedEntityRef } from './serialization';
import { fromEntries } from './util';

/**
 * Create a zod schema for an entity with any of the given components.
 *
 * Use this to reference an entity as part of a component schema.
 */
export function entitySchema<const TComponents extends ComponentArrayLike>(
  components: TComponents,
): ZodType<Partial<ComponentsEntity<TComponents>> | EncodedEntityRef> {
  return z
    .object({
      ...fromEntries(
        components.map((component) => [
          component.name as TComponents[number]['name'],
          component.schema.optional() as TComponents[number]['schema'],
        ]),
      ),
    })
    .passthrough() as ZodType<Partial<ComponentsEntity<TComponents>>>;
}
