import { type ZodType, type ZodTypeAny, z } from 'zod';
import packageJson from '../package.json';
import type { Component } from './component';
import type { Query } from './query';
import { deserializeRefs, serializeRefs } from './serialization';
import { type Expand, entries, fromEntries } from './util';
import { uuid } from './uuid';

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

export type ECSEntity<TECS extends ECS<EntityLike>> = TECS extends ECS<
  infer TEntity
>
  ? TEntity
  : never;

export class ECS<TEntity extends EntityLike> {
  #entityAliases: Map<string, Set<string>> = new Map();
  #entityIDs = new Map<object, string>();
  components: Readonly<EntityComponents<TEntity>>;
  entities: Record<string, Partial<TEntity>> = {};
  aliases: Record<string, string> = {};

  constructor(components: EntityComponents<TEntity>) {
    this.components = components;
  }

  #entitySchema(): ZodType<Partial<TEntity>> {
    return z.object(
      fromEntries(
        entries(this.components).map(([name, component]) => [
          name,
          component.schema.optional(),
        ]),
      ),
    ) as ZodType<Partial<TEntity>>;
  }

  #trackEntity<T extends object>(entity: T, id: string): T {
    this.#entityIDs.set(entity, id);
    this.entities[id] = entity;
    return entity;
  }

  #serializationSchema() {
    return z.object({
      zecs: z.literal(packageJson.version),
      entities: z.record(z.string(), this.#entitySchema()),
      aliases: z.record(z.string(), z.string()),
    });
  }

  add(entity: Partial<TEntity> & Record<string, unknown>): Partial<TEntity> {
    let id = uuid();

    let i = 0;
    while (id in this.entities) {
      if (++i > 4) throw new Error('Failed to add entity: unlucky.');
      id = uuid();
    }

    return this.#trackEntity(entity, id);
  }

  addAll(entities: Array<Partial<TEntity> & { [key: string]: unknown }>): void {
    for (const entity of entities) {
      this.add(entity);
    }
  }

  remove(entity: Partial<TEntity>): void {
    const id = this.getEntityID(entity);
    if (id === undefined) {
      throw new Error(`Can't remove entity: entity is not added to this ECS`);
    }

    delete this.entities[id];
    this.#entityIDs.delete(entity);

    const aliases = this.#entityAliases.get(id);
    if (aliases) {
      for (const alias of aliases) {
        delete this.aliases[alias];
      }
    }
    this.#entityAliases.delete(id);
  }

  removeAll(): void {
    this.entities = {};
    this.aliases = {};
    this.#entityAliases.clear();
    this.#entityIDs.clear();
  }

  get(idOrAlias: string): Partial<TEntity> | undefined {
    if (idOrAlias in this.aliases) {
      return this.entities[this.aliases[idOrAlias]];
    }
    return this.entities[idOrAlias];
  }

  *getAll(): Generator<Partial<TEntity>> {
    for (const id in this.entities) {
      yield this.entities[id];
    }
  }

  getEntityID(entity: Partial<TEntity>): string | undefined {
    return this.#entityIDs.get(entity);
  }

  getEntityByID(id: string): Partial<TEntity> | undefined {
    return this.entities[id];
  }

  alias(alias: string, entity: Partial<TEntity>): void {
    const id = this.getEntityID(entity);
    if (id === undefined) {
      throw new Error(
        `Can't create alias "${alias}": entity is not added to this ECS`,
      );
    }
    const aliases = this.#entityAliases.get(id) ?? new Set();
    aliases.add(alias);
    this.#entityAliases.set(id, aliases);
    this.aliases[alias] = id;
  }

  singleton<T extends Partial<TEntity>>(
    alias: string,
    query: Query<Partial<TEntity>, T>,
    entityFactory: () => T,
  ): () => T {
    return () => {
      const existing = this.get(alias);
      if (existing && query.match(existing)) {
        return existing;
      }
      const entity = entityFactory();
      this.add(entity);
      this.alias(alias, entity);
      return entity;
    };
  }

  toJSON() {
    return {
      zecs: packageJson.version,
      entities: serializeRefs(this.entities, 2, (e) => this.getEntityID(e)),
      aliases: this.aliases,
    };
  }

  loadJSON(json: unknown) {
    this.removeAll();

    const { entities, aliases } = this.#serializationSchema().parse(json);
    deserializeRefs(entities, entities);

    for (const [id, entity] of entries(entities)) {
      this.#trackEntity(entity, id);
    }

    for (const [alias, id] of entries(aliases)) {
      const entity = this.getEntityByID(id);
      if (entity === undefined) {
        throw new Error(
          `Can't load alias "${alias}": entity with ID "${id}" not found`,
        );
      }
      this.alias(alias, entity);
    }
  }
}

export function ecs<const TComponents extends ComponentArrayLike>(
  components: TComponents,
): ECS<ComponentsEntity<TComponents>> {
  return new ECS(
    fromEntries(
      components.map((component) => [component.name, component]),
    ) as EntityComponents<ComponentsEntity<TComponents>>,
  );
}
