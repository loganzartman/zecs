import z from 'zod';
import type { ZodType } from 'zod';
import packageJson from '../package.json';
import type { ZodTypeAny } from 'zod';

type Expand<T> = T extends any ? { [K in keyof T]: T[K] } : never;

export type Empty = Record<never, never>;

export type Component<TName extends string, TZodSchema extends ZodTypeAny> = {
  name: TName;
  schema: TZodSchema;
};

export type EntityLike = Record<string, unknown>;

export type ComponentArrayLike = Array<Component<string, ZodTypeAny>>;

export type ComponentsEntity<TComponents extends ComponentArrayLike> = Expand<{
  [TComponent in TComponents[number] as TComponent['name']]: z.infer<
    TComponent['schema']
  >;
}>;

export type EntityComponent<TEntity extends EntityLike> = {
  [Key in keyof TEntity]: Component<Key & string, ZodType<TEntity[Key]>>;
}[keyof TEntity];

export type ECSWith<TQuery extends Query<EntityLike, EntityLike>> =
  TQuery extends Query<infer TInput, any> ? ECS<Expand<TInput>> : never;

export function component<
  TName extends string,
  const TZodSchema extends ZodTypeAny,
>(name: TName, schema: TZodSchema): Component<TName, TZodSchema> {
  return { name, schema };
}

export class ECS<TEntity extends EntityLike> {
  components: Array<EntityComponent<TEntity>>;
  entities: Array<Partial<TEntity>>;

  constructor(components: Array<EntityComponent<TEntity>>) {
    this.components = components;
    this.entities = [];
  }

  serializationSchema() {
    return z.object({
      version: z.literal(packageJson.version),
      entities: z.array(
        z.object(
          Object.fromEntries(
            this.components.map((component) => [
              component.name,
              component.schema.optional(),
            ]),
          ),
        ),
      ),
    });
  }

  add(entity: Empty & Partial<TEntity & { [key: string]: unknown }>) {
    this.entities.push(entity);
  }

  addAll(entities: Array<Partial<TEntity> & { [key: string]: unknown }>) {
    this.entities.push(...entities);
  }

  toJSON() {
    return { version: packageJson.version, entities: this.entities };
  }

  loadJSON(json: unknown) {
    const entities = this.serializationSchema().parse(json).entities;
    this.entities = entities as Array<TEntity>;
  }
}

export function ecs<const TComponents extends ComponentArrayLike>(
  components: TComponents,
): ECS<ComponentsEntity<TComponents>> {
  return new ECS(
    components as Array<EntityComponent<ComponentsEntity<TComponents>>>,
  );
}

export class Query<TInput extends EntityLike, TOutput extends TInput> {
  filter: (entity: Partial<TInput>) => entity is TOutput;

  constructor(filter: (entity: Partial<TInput>) => entity is TOutput) {
    this.filter = filter;
  }

  has<TName extends string, TZodSchema extends ZodTypeAny>(
    component: Component<TName, TZodSchema>,
  ): Query<
    TInput & { [key in TName]: z.infer<TZodSchema> },
    TOutput & { [key in TName]: z.infer<TZodSchema> }
  > {
    return new Query(
      (
        entity: Partial<TInput>,
      ): entity is TOutput & { [key in TName]: z.infer<TZodSchema> } =>
        this.filter(entity) && component.name in entity,
    );
  }

  where(filter: (entity: TOutput) => boolean): Query<TInput, TOutput>;
  where<TNewOutput extends TOutput>(
    filter: (entity: TOutput) => entity is TNewOutput,
  ): Query<TInput, TNewOutput> {
    return new Query(
      (entity: Partial<TInput>) => this.filter(entity) && filter(entity),
    );
  }

  *query<TEntity extends TInput>(ecs: ECS<TEntity>): Generator<TOutput> {
    for (const entity of ecs.entities) {
      if (this.filter(entity)) {
        yield entity;
      }
    }
  }
}

export function query(): Query<Empty, Empty> {
  return new Query((_entity): _entity is Empty => true);
}

const zecs = { component, ecs, query };
export default zecs;
