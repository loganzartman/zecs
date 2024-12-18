import type { ZodTypeAny, z } from 'zod';
import type { Component } from './component';
import type { ECS, EntityLike } from './ecs';
import type { Empty } from './util';

export type QueryInput<TQuery extends Query<EntityLike, EntityLike>> =
  TQuery extends Query<infer TInput, any> ? TInput : never;

export type QueryOutput<TQuery extends Query<EntityLike, EntityLike>> =
  TQuery extends Query<any, infer TOutput> ? TOutput : never;

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
