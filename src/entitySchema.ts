import * as zm from 'zod/v4-mini';
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
): zm.ZodMiniType<Partial<ComponentsEntity<TComponents>> | EncodedEntityRef> {
  return zm.looseObject({
    ...fromEntries(
      components.map((component) => [
        component.name as TComponents[number]['name'],
        zm.optional(component.schema) as TComponents[number]['schema'],
      ]),
    ),
  }) as zm.ZodMiniType<Partial<ComponentsEntity<TComponents>>>;
}
