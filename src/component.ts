import type { ZodTypeAny, z } from 'zod';

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

export function component<
  TName extends string,
  const TZodSchema extends ZodTypeAny,
>(name: TName, schema: TZodSchema): Component<TName, TZodSchema> {
  return { name, schema };
}
