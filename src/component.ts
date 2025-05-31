import type { $ZodType, output } from 'zod/v4/core';

export type Component<TName extends string, TZodSchema extends $ZodType> = {
  name: TName;
  schema: TZodSchema;
};

export type ComponentSchema<TComponent extends Component<string, $ZodType>> =
  TComponent extends Component<any, infer TZodSchema> ? TZodSchema : never;

export type ComponentName<TComponent extends Component<string, $ZodType>> =
  TComponent extends Component<infer TName, any> ? TName : never;

export type ComponentData<TComponent extends Component<string, $ZodType>> =
  TComponent extends Component<any, infer TZodSchema extends $ZodType>
    ? output<TZodSchema>
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
  const TZodSchema extends $ZodType,
>(name: TName, schema: TZodSchema): Component<TName, TZodSchema> {
  return { name, schema };
}
