import z from 'zod';
import type { ZodType } from 'zod';
import type { ZodTypeAny } from 'zod';
import packageJson from '../package.json';
import { deserializeRefs, entitySymbol, serializeRefs } from './serialization';
import { entries, fromEntries } from './util';

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

export type EntityComponents<TEntity extends EntityLike> = {
  [Key in keyof TEntity]: Key extends string
    ? Component<Key, ZodType<TEntity[Key]>>
    : never;
};

export type ECSWith<TQuery extends Query<EntityLike, EntityLike>> =
  TQuery extends Query<infer TInput, any> ? ECS<Expand<TInput>> : never;

export function component<
  TName extends string,
  const TZodSchema extends ZodTypeAny,
>(name: TName, schema: TZodSchema): Component<TName, TZodSchema> {
  return { name, schema };
}

export class ECS<TEntity extends EntityLike> {
  #id = 1;
  components: Readonly<EntityComponents<TEntity>>;
  entities: Record<string, Partial<TEntity>>;

  constructor(components: EntityComponents<TEntity>) {
    this.components = components;
    this.entities = {};
  }

  #entitySchema() {
    return z.object(
      fromEntries(
        entries(this.components).map(([name, component]) => [
          name,
          component.schema.optional(),
        ]),
      ),
    );
  }

  #serializationSchema() {
    return z.object({
      zecs: z.literal(packageJson.version),
      entities: z.record(z.string(), this.#entitySchema()),
    });
  }

  add(entity: Empty & Partial<TEntity & { [key: string]: unknown }>) {
    const id = (this.#id++).toString();
    Object.defineProperty(entity, entitySymbol, { value: id });
    this.entities[id] = entity;
  }

  addAll(entities: Array<Partial<TEntity> & { [key: string]: unknown }>) {
    for (const entity of entities) {
      this.add(entity);
    }
  }

  get(id: string): Partial<TEntity> | undefined {
    return this.entities[id];
  }

  *getAll(): Generator<Partial<TEntity>> {
    for (const id in this.entities) {
      yield this.entities[id];
    }
  }

  toJSON() {
    return {
      zecs: packageJson.version,
      entities: serializeRefs(this.entities, 2),
    };
  }

  loadJSON(json: unknown) {
    const entities = this.#serializationSchema().parse(json).entities;
    this.entities = deserializeRefs(entities, entities) as Record<
      string,
      Partial<TEntity>
    >;
  }
}

export function ecs<const TComponents extends ComponentArrayLike>(
  components: TComponents,
): ECS<ComponentsEntity<TComponents>> {
  return new ECS(
    Object.fromEntries(
      components.map((component) => [component.name, component]),
    ) as EntityComponents<ComponentsEntity<TComponents>>,
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
    for (const id in ecs.entities) {
      const entity = ecs.entities[id];
      if (this.filter(entity)) {
        yield entity;
      }
    }
  }

  queryOnly<TEntity extends TInput>(ecs: ECS<TEntity>): TOutput {
    let result: TOutput | null = null;
    for (const id in ecs.entities) {
      const entity = ecs.entities[id];
      if (this.filter(entity)) {
        if (result !== null) {
          throw new Error('More than one entity matches');
        }
        result = entity;
      }
    }
    if (result === null) {
      throw new Error('No entity matches');
    }
    return result;
  }

  match<TEntity extends Partial<TInput> & Empty>(
    entity: TEntity,
  ): entity is TEntity & TOutput {
    return this.filter(entity);
  }
}

export function query(): Query<Empty, Empty> {
  return new Query((_entity): _entity is Empty => true);
}

const zecs = { component, ecs, query };
export default zecs;
