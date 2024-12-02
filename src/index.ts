export type Empty = Record<never, never>;

export type AddComponent<
  TEntity extends object,
  TComponentKey extends string,
  TComponentData extends object,
> = TEntity & { [key in TComponentKey]: TComponentData };

export type EcsWith<TQuery extends EcsQuery<any, any>> =
  TQuery extends EcsQuery<infer TEntity, any> ? Ecs<TEntity> : never;

export class EcsQuery<TEntity extends object, TSelected extends TEntity> {
  filter: (entity: Partial<TEntity>) => entity is TSelected;

  private constructor(
    filter: (entity: Partial<TEntity>) => entity is TSelected,
  ) {
    this.filter = filter;
  }

  static create(): EcsQuery<Empty, Empty> {
    return new EcsQuery((entity): entity is Empty => true);
  }

  *query<TEcsEntity extends TEntity>(
    ecs: Ecs<TEcsEntity>,
  ): Generator<TSelected> {
    for (const entity of ecs.entities) {
      if (this.filter(entity)) {
        yield entity;
      }
    }
  }

  hasComponent<TComponentKey extends string, TComponentData extends object>(
    key: TComponentKey,
    defaults: TComponentData,
  ): EcsQuery<
    AddComponent<TEntity, TComponentKey, TComponentData>,
    AddComponent<TSelected, TComponentKey, TComponentData>
  > {
    const newFilter = (
      entity: Partial<AddComponent<TEntity, TComponentKey, TComponentData>>,
    ): entity is AddComponent<TSelected, TComponentKey, TComponentData> =>
      this.filter(entity) && key in entity;

    return new EcsQuery(newFilter);
  }
}

export class EcsSchema<TEntity extends object> {
  defaults: TEntity;

  private constructor(args: { defaults: TEntity }) {
    this.defaults = args.defaults;
  }

  static create() {
    return new EcsSchema<Empty>({ defaults: {} });
  }

  component<const TComponentKey extends string, TComponentData extends object>(
    key: TComponentKey,
    defaults: TComponentData,
  ): EcsSchema<AddComponent<TEntity, TComponentKey, TComponentData>> {
    // TODO: any way to avoid the cast?
    const newDefaults = { ...this.defaults, [key]: defaults } as AddComponent<
      TEntity,
      TComponentKey,
      TComponentData
    >;
    return new EcsSchema({ defaults: newDefaults });
  }
}

export class Ecs<TEntity extends object> {
  schema: EcsSchema<TEntity>;
  entities: Partial<TEntity>[];

  private constructor(args: {
    schema: EcsSchema<TEntity>;
    entities: Partial<TEntity>[];
  }) {
    this.schema = args.schema;
    this.entities = args.entities;
  }

  static fromEmpty<TEntity extends object>(
    schema: EcsSchema<TEntity>,
  ): Ecs<TEntity> {
    return new Ecs({ schema, entities: [] });
  }

  static fromEntities<TEntity extends object>(
    schema: EcsSchema<TEntity>,
    entities: Partial<NoInfer<TEntity & { [key: string]: unknown }>>[],
  ): Ecs<TEntity> {
    return new Ecs({ schema, entities });
  }
}
