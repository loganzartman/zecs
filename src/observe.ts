import z, { type ZodVoid, type ZodType } from 'zod';
import type { ECS, EntityLike } from './ecs';
import { type EventType, event } from './event';
import type { Query } from './query';

export type Observer<TInput extends EntityLike, TOutput extends TInput> = {
  /** Called when an entity now matches the query that was not on the previous update() */
  matched: EventType<'matched', ZodType<TOutput>>;
  /** Called once before the set of matching entities is updated */
  preUpdate: EventType<'preUpdate', ZodVoid>;
  /** Called for each matching entity each update() */
  updated: EventType<'updated', ZodType<TOutput>>;
  /** Called once after the set of matching entities is updated */
  postUpdate: EventType<'postUpdate', ZodVoid>;
  /** Called when an entity no longer matches the query that did on the previous update() */
  unmatched: EventType<'unmatched', ZodType<TOutput>>;
  /** Update the set of matching entities and emit events */
  update(ecs: ECS<TInput>): void;
};

/**
 * Watch the results of a query.
 *
 * @param query
 * @returns events for responding to changes in the query results
 */
export function observe<TInput extends EntityLike, TOutput extends TInput>(
  query: Query<TInput, TOutput>,
): Observer<TInput, TOutput> {
  const registry = new Set<TOutput>();
  const matched = event('matched', z.custom<TOutput>());
  const preUpdate = event('preUpdate', z.void());
  const updated = event('updated', z.custom<TOutput>());
  const postUpdate = event('postUpdate', z.void());
  const unmatched = event('unmatched', z.custom<TOutput>());

  function update(ecs: ECS<TInput>) {
    preUpdate.emit();
    const missing = new Set<TOutput>(registry);
    for (const entity of query.query(ecs)) {
      if (!registry.has(entity)) {
        registry.add(entity);
        matched.emit(entity);
      }
      updated.emit(entity);
      missing.delete(entity);
    }
    for (const entity of missing) {
      registry.delete(entity);
      unmatched.emit(entity);
    }
    postUpdate.emit();
  }

  return { matched, preUpdate, updated, postUpdate, unmatched, update };
}
