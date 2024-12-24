import { type ZodType, type ZodTypeAny, z } from 'zod';
import packageJson from '../package.json';
import type { Component } from './component';
import type { Query } from './query';
import { deserializeRefs, entitySymbol, serializeRefs } from './serialization';
import { type Empty, type Expand, entries, fromEntries } from './util';

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

  entity(data: Partial<TEntity>): Partial<TEntity> {
    return data;
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

  remove(id: string) {
    delete this.entities[id];
  }

  removeAll() {
    this.entities = {};
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
