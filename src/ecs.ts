import { type ZodType, type ZodTypeAny, z } from 'zod';
import packageJson from '../package.json';
import type { Component } from './component';
import type { Query, QueryOutput } from './query';
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

export type ECSEntity<TECS extends ECS<EntityLike>> = TECS extends ECS<
  infer TEntity
>
  ? TEntity
  : never;

export class ECS<TEntity extends EntityLike> {
  #id = 1;
  #entityAliases: Map<string, Set<string>> = new Map();
  components: Readonly<EntityComponents<TEntity>>;
  entities: Record<string, Partial<TEntity>> = {};
  aliases: Record<string, string> = {};

  constructor(components: EntityComponents<TEntity>) {
    this.components = components;
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
      aliases: z.record(z.string(), z.string()),
    });
  }

  entity(data: Partial<TEntity>): Partial<TEntity> {
    return data;
  }

  add(entity: Empty & Partial<TEntity & { [key: string]: unknown }>): string {
    const id = (this.#id++).toString();
    Object.defineProperty(entity, entitySymbol, { value: id });
    this.entities[id] = entity;
    return id;
  }

  addAll(entities: Array<Partial<TEntity> & { [key: string]: unknown }>): void {
    for (const entity of entities) {
      this.add(entity);
    }
  }

  remove(id: string): void {
    delete this.entities[id];
    for (const alias of this.#entityAliases.get(id) ?? []) {
      delete this.aliases[alias];
    }
    this.#entityAliases.delete(id);
  }

  removeAll(): void {
    this.entities = {};
    this.aliases = {};
    this.#entityAliases.clear();
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

  alias(alias: string, id: string): void {
    if (!(id in this.entities)) {
      throw new Error(`Entity with id ${id} does not exist`);
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
      const id = this.add(entity);
      this.alias(alias, id);
      return entity;
    };
  }

  toJSON() {
    return {
      zecs: packageJson.version,
      entities: serializeRefs(this.entities, 2),
      aliases: this.aliases,
    };
  }

  loadJSON(json: unknown) {
    const { entities, aliases } = this.#serializationSchema().parse(json);
    this.entities = deserializeRefs(entities, entities) as Record<
      string,
      Partial<TEntity>
    >;
    for (const [alias, id] of entries(aliases)) {
      this.alias(alias, id);
    }
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
