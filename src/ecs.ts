import { type ZodType, z } from 'zod/v4';
import packageJson from '../package.json';
import type { Component } from './component';
import type { Query } from './query';
import { deserializeRefs, serializeRefs } from './serialization';
import { type Expand, entries, fromEntries } from './util';
import { uuid } from './uuid';

export type EntityLike = Record<string, unknown>;

export type ComponentArrayLike = Array<Component<string, ZodType>>;

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

/**
 * An ECS instance
 */
export class ECS<TEntity extends EntityLike> {
  #entityAliases = new Map<unknown, Set<string>>();
  #entityID = new Map<unknown, string>();
  components: Readonly<EntityComponents<TEntity>>;
  entities: Map<string, Partial<TEntity>> = new Map();
  aliases: Map<string, string> = new Map();

  /**
   * You probably want the {@link ecs} function instead.
   */
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
    this.#entityID.set(entity, id);
    this.entities.set(id, entity);
    return entity;
  }

  #serializationSchema() {
    return z.object({
      zecs: z.literal(packageJson.version),
      entities: z.record(z.string(), this.#entitySchema()),
      aliases: z.record(z.string(), z.string()),
    });
  }

  /**
   * Store an entity in the ECS and return the entity.
   *
   * @param entity a plain object with any of the components supported by this ECS
   * @returns the added entity
   */
  add(entity: Partial<TEntity> & Record<string, unknown>): Partial<TEntity> {
    let id = uuid();

    let i = 0;
    while (this.entities.has(id)) {
      if (++i > 4) throw new Error('Failed to add entity: unlucky.');
      id = uuid();
    }

    return this.#trackEntity(entity, id);
  }

  /**
   * Store multiple entities in the ECS.
   */
  addAll(entities: Array<Partial<TEntity> & { [key: string]: unknown }>): void {
    for (const entity of entities) {
      this.add(entity);
    }
  }

  /**
   * Remove an entity from the ECS.
   *
   * @param entity the entity to remove
   * @throws Error if the entity is not added to this ECS
   */
  remove(entity: Partial<TEntity>): void {
    const id = this.getEntityID(entity);
    if (id === undefined) {
      throw new Error(`Can't remove entity: entity is not added to this ECS`);
    }

    const aliases = this.#entityAliases.get(entity);
    if (aliases) {
      for (const alias of aliases) {
        this.aliases.delete(alias);
      }
    }
    this.#entityAliases.delete(entity);

    this.entities.delete(id);
    this.#entityID.delete(entity);
  }

  /**
   * Remove all entities from the ECS.
   */
  removeAll(): void {
    this.entities.clear();
    this.aliases.clear();
    this.#entityAliases.clear();
    this.#entityID.clear();
  }

  /**
   * Get an entity by its ID or alias.
   *
   * @param idOrAlias an internal ID or user-defined alias of the entity
   * @returns the entity, or undefined if not found
   *
   * @see {@link ECS.getEntityID}
   */
  get(idOrAlias: string): Partial<TEntity> | undefined {
    const aliased = this.aliases.get(idOrAlias);
    if (aliased) {
      return this.entities.get(aliased);
    }
    return this.entities.get(idOrAlias);
  }

  /**
   * Get all entities in the ECS.
   *
   * @returns a generator that yields all entities
   */
  *getAll(): Generator<Partial<TEntity>> {
    yield* this.entities.values();
  }

  /**
   * Get the internal ID of an entity.
   *
   * @returns the internal ID of the entity, or undefined if not found
   *
   * @see {@link ECS.get}
   */
  getEntityID(entity: Partial<TEntity>): string | undefined {
    return this.#entityID.get(entity);
  }

  /**
   * Define an alias for the entity.
   *
   * An alias can be used to retrieve the entity using {@link ECS.get}.
   *
   * @param alias an arbitrary string to use as an alias
   * @param entity the entity to alias
   * @throws Error if the entity is not added to this ECS
   */
  alias(alias: string, entity: Partial<TEntity>): void {
    const id = this.getEntityID(entity);
    if (id === undefined) {
      throw new Error(
        `Can't create alias "${alias}": entity is not added to this ECS`,
      );
    }
    const aliases = this.#entityAliases.get(entity) ?? new Set();
    aliases.add(alias);
    this.#entityAliases.set(entity, aliases);
    this.aliases.set(alias, id);
  }

  /**
   * Create a named singleton entity, and return a function that retrieves it.
   *
   * If the named entity does not exist, it is created.
   *
   * If the named entity exists and matches the query, it is returned.
   *
   * If the named entity exists and does NOT match the query, it is replaced.
   *
   * @param alias an arbitrary string to use as an alias
   * @param query a query to match the entity against
   * @param entityFactory a function that creates the entity
   * @returns the singleton entity
   */
  singleton<T extends Partial<TEntity>>(
    alias: string,
    query: Query<Partial<TEntity>, T>,
    entityFactory: () => T,
  ): () => T {
    return () => {
      const existing = this.get(alias);
      if (existing) {
        if (query.match(existing)) {
          return existing;
        }
        this.remove(existing);
      }
      const entity = entityFactory();
      this.add(entity);
      this.alias(alias, entity);
      return entity;
    };
  }

  /**
   * Convert the ECS to a plain object that can be serialized to JSON (assuming all your components are serializable).
   *
   * Entity references are are serialized such that they can be restored later.
   *
   * @returns a plain object representation of the ECS
   */
  toJSON() {
    return {
      zecs: packageJson.version,
      entities: serializeRefs(
        Object.fromEntries(this.entities.entries()),
        2,
        (e) => this.getEntityID(e),
      ),
      aliases: Object.fromEntries(this.aliases.entries()),
    };
  }

  /**
   * Restore the state of this ECS from the given object created by {@link ECS.toJSON}.
   *
   * Entity references are restored such that they point to the correct entities.
   */
  loadJSON(json: unknown) {
    this.removeAll();

    const { entities, aliases } = this.#serializationSchema().parse(json);
    deserializeRefs(entities, entities);

    for (const [id, entity] of entries(entities)) {
      this.#trackEntity(entity, id);
    }

    for (const [alias, id] of entries(aliases)) {
      const entity = this.get(id);
      if (entity === undefined) {
        throw new Error(
          `Can't load alias "${alias}": entity with ID "${id}" not found`,
        );
      }
      this.alias(alias, entity);
    }
  }
}

/**
 * Create an ECS instance whose entities can have any of the given components.
 *
 * @param components - The components that can be used in the ECS.
 * @returns an ECS instance
 */
export function ecs<const TComponents extends ComponentArrayLike>(
  components: TComponents,
): ECS<ComponentsEntity<TComponents>> {
  return new ECS(
    fromEntries(
      components.map((component) => [component.name, component]),
    ) as EntityComponents<ComponentsEntity<TComponents>>,
  );
}
