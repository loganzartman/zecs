import type { ZodTypeAny, z } from 'zod/v4';

export type Component<TName extends string, TZodSchema extends ZodTypeAny> = {
  name: TName;
  schema: TZodSchema;
};

export type ComponentSchema<TComponent extends Component<string, ZodTypeAny>> =
  TComponent extends Component<any, infer TZodSchema> ? TZodSchema : never;

export type ComponentName<TComponent extends Component<string, ZodTypeAny>> =
  TComponent extends Component<infer TName, any> ? TName : never;

export type ComponentData<TComponent extends Component<string, ZodTypeAny>> =
  TComponent extends Component<any, infer TZodSchema>
    ? z.infer<TZodSchema>
    : never;

/**
 * Declare a component that can be used in an ECS
 *
 * @param name - The name of the component; the property name in the entity
 * @param schema - The zod schema for the component data
 * @returns a component definition
 */
export function component<
  TName extends string,
  const TZodSchema extends ZodTypeAny,
>(name: TName, schema: TZodSchema): Component<TName, TZodSchema> {
  return { name, schema };
}
