import z from 'zod';
import type { ZodSchema, ZodType } from 'zod';
import packageJson from '../package.json';

export type Empty = Record<never, never>;

type EntityType = Record<string, unknown>;
type ComponentSchema = ZodSchema<unknown>;
type ComponentSchemas = Record<string, ComponentSchema>;
export type InferEntityType<TComponentSchemas extends ComponentSchemas> = {
  [TKey in keyof TComponentSchemas]: z.infer<TComponentSchemas[TKey]>;
};
export type EntityComponentSchemas<TEntity extends EntityType> = {
  [TKey in keyof TEntity]: ZodType<TEntity[TKey]>;
};

export type AddComponent<
  TShape extends Record<string, unknown>,
  TComponentKey extends string,
  TComponentData,
> = TShape & { [key in TComponentKey]: TComponentData };

export type EcsWith<TQuery extends EcsQuery<any, any>> =
  TQuery extends EcsQuery<infer TEntity, any>
    ? Ecs<EntityComponentSchemas<TEntity>, TEntity>
    : never;

export class EcsQuery<TEntity extends EntityType, TSelected extends TEntity> {
  filterFn: (entity: Partial<TEntity>) => entity is TSelected;

  private constructor(
    filter: (entity: Partial<TEntity>) => entity is TSelected,
  ) {
    this.filterFn = filter;
  }

  static create(): EcsQuery<Empty, Empty> {
    return new EcsQuery((_): _ is Empty => true);
  }

  *query<TEcsEntity extends TEntity>(
    ecs: Ecs<EntityComponentSchemas<TEcsEntity>, TEcsEntity>,
  ): Generator<TSelected> {
    for (const entity of ecs.entities) {
      if (this.filterFn(entity)) {
        yield entity;
      }
    }
  }

  where(
    predicate: (entity: TSelected) => boolean,
  ): EcsQuery<TEntity, TSelected> {
    return new EcsQuery(
      (entity): entity is TSelected =>
        this.filterFn(entity) && predicate(entity),
    );
  }

  hasComponent<
    TComponentKey extends string,
    TComponentSchema extends ComponentSchema,
  >(
    key: TComponentKey,
    _schema: TComponentSchema,
  ): EcsQuery<
    AddComponent<TEntity, TComponentKey, z.infer<TComponentSchema>>,
    AddComponent<TSelected, TComponentKey, z.infer<TComponentSchema>>
  > {
    return new EcsQuery(
      (
        entity,
      ): entity is AddComponent<TSelected, TComponentKey, TComponentSchema> =>
        this.filterFn(entity) && key in entity,
    );
  }
}

export class EcsSchema<TComponentSchemas extends ComponentSchemas> {
  schemas: TComponentSchemas;

  private constructor(args: { schemas: TComponentSchemas }) {
    this.schemas = args.schemas;
  }

  static create() {
    return new EcsSchema<Empty>({ schemas: {} });
  }

  component<
    const TComponentKey extends string,
    TComponentSchema extends ComponentSchema,
  >(
    key: TComponentKey,
    componentSchema: TComponentSchema,
  ): EcsSchema<
    AddComponent<TComponentSchemas, TComponentKey, TComponentSchema>
  > {
    // TODO: any way to avoid the cast?
    const newSchemas = {
      ...this.schemas,
      [key]: componentSchema,
    } as AddComponent<TComponentSchemas, TComponentKey, TComponentSchema>;
    return new EcsSchema({ schemas: newSchemas });
  }
}

export class Ecs<
  TComponentSchemas extends ComponentSchemas,
  TEntity = InferEntityType<TComponentSchemas>,
> {
  schema: EcsSchema<TComponentSchemas>;
  entities: Partial<TEntity>[];

  private constructor(args: {
    schema: EcsSchema<TComponentSchemas>;
    entities: Partial<TEntity>[];
  }) {
    this.schema = args.schema;
    this.entities = args.entities;
  }

  static fromEmpty<TComponentSchemas extends ComponentSchemas>(
    schema: EcsSchema<TComponentSchemas>,
  ): Ecs<TComponentSchemas> {
    return new Ecs({ schema, entities: [] });
  }

  static from<
    TComponentSchemas extends ComponentSchemas,
    TEntity = InferEntityType<TComponentSchemas>,
  >(args: {
    schema: EcsSchema<TComponentSchemas>;
    entities: Partial<NoInfer<TEntity> & { [key: string]: unknown }>[];
  }): Ecs<TComponentSchemas, TEntity> {
    return new Ecs(args);
  }

  static deserialize<TComponentSchemas extends ComponentSchemas>({
    schema,
    data,
  }: {
    schema: EcsSchema<TComponentSchemas>;
    data: unknown;
  }): Ecs<TComponentSchemas> {
    const dataSchema = z.object({
      zecs: z.literal(packageJson.version),
      entities: z.array(z.object(schema.schemas).partial()),
    });
    return new Ecs<TComponentSchemas>({
      schema,
      entities: dataSchema.parse(data).entities,
    });
  }

  serialize(): Readonly<unknown> {
    return { zecs: packageJson.version, entities: this.entities };
  }
}
