import type { output } from 'zod/v4/core';
import type { Component } from './component';
import type { ECS, EntityLike } from './ecs';
import type { Empty } from './util';

type Expand<T> = T extends object ? { [K in keyof T]: T[K] } & {} : T;

export type QueryInput<TQuery extends Query<any, any>> = TQuery extends Query<
  infer TInput,
  any
>
  ? TInput
  : never;

export type QueryOutput<TQuery extends Query<any, any>> = TQuery extends Query<
  any,
  infer TOutput
>
  ? TOutput
  : never;

export class Query<TInput extends EntityLike, TOutput extends TInput> {
  filter: (entity: Partial<TInput>) => entity is TOutput;

  constructor(filter: (entity: Partial<TInput>) => entity is TOutput) {
    this.filter = filter;
  }

  /**
   * Create a refined query that only matches entities with the given components.
   */
  has<TComponents extends Component<any, any>[]>(
    ...components: TComponents
  ): Query<
    Expand<
      TInput & { [E in TComponents[number] as E['name']]: output<E['schema']> }
    >,
    Expand<
      TOutput & {
        [E in TComponents[number] as E['name']]: output<E['schema']>;
      }
    >
  > {
    return new Query(
      (
        entity: Partial<TInput>,
      ): entity is Expand<
        TOutput & {
          [E in TComponents[number] as E['name']]: output<E['schema']>;
        }
      > =>
        this.filter(entity) &&
        components.every((component) => component.name in entity),
    );
  }

  /**
   * Create a refined query that only matches entities that pass given the filter predicate.
   */
  where(filter: (entity: TOutput) => boolean): Query<TInput, TOutput>;
  where<TNewOutput extends TOutput>(
    filter: (entity: TOutput) => entity is TNewOutput,
  ): Query<TInput, TNewOutput> {
    return new Query(
      (entity: Partial<TInput>) => this.filter(entity) && filter(entity),
    );
  }

  /**
   * Count the number of matching entities in the given ECS.
   */
  count<TEntity extends TInput>(ecs: ECS<TEntity>): number {
    let count = 0;
    for (const _ of this.query(ecs)) {
      count++;
    }
    return count;
  }

  /**
   * Iterate over all matching entities in the given ECS.
   */
  *query<TEntity extends TInput>(ecs: ECS<TEntity>): Generator<TOutput> {
    for (const entity of ecs.entities.values()) {
      if (this.match(entity)) {
        yield entity;
      }
    }
  }

  /**
   * Intersect with another query, returning a query that matches entities against both queries.
   */
  and<TNewInput extends EntityLike, TNewOutput extends TNewInput>(
    query: Query<TNewInput, TNewOutput>,
  ): Query<Expand<TInput & TNewInput>, Expand<TOutput & TNewOutput>> {
    return new Query(
      (
        entity: Partial<TInput & TNewInput>,
      ): entity is Expand<TOutput & TNewOutput> =>
        this.filter(entity) && query.filter(entity),
    );
  }

  /**
   * Test whether the given entity matches this query.
   *
   * Refines the type of the entity, so it can be used to access components on an unknown entity.
   */
  match<TEntity extends Partial<TInput> & Empty>(
    entity: TEntity,
  ): entity is TEntity & TOutput {
    return this.filter(entity);
  }
}

/**
 * Create a query that matches all entities.
 */
export function query(): Query<Empty, Empty> {
  return new Query((_entity): _entity is Empty => true);
}
