import z, { type ZodType } from 'zod';
import type { ECS, EntityLike } from './ecs';
import {
  type EventListenerType,
  type EventType,
  type Listener,
  event,
} from './event';
import type { Query } from './query';

export type ObserverEvents<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams,
> = {
  /** Called when an entity now matches the query that was not on the previous update() */
  matched: EventType<'matched', [TOutput]>;
  /** Called once before the set of matching entities is updated */
  preUpdate: EventType<'preUpdate', []>;
  /** Called for each matching entity each update() */
  updated: EventType<'updated', [TOutput, TParams]>;
  /** Called once after the set of matching entities is updated */
  postUpdate: EventType<'postUpdate', []>;
  /** Called when an entity no longer matches the query that did on the previous update() */
  unmatched: EventType<'unmatched', [TOutput]>;
};

export type Observer<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams,
> = ObserverEvents<TInput, TOutput, TParams> & {
  /** Update the set of matching entities and emit events */
  update(ecs: ECS<TInput>, params: TParams): void;
};

export type ObserverInitialListeners<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams,
> = {
  [K in keyof ObserverEvents<TInput, TOutput, TParams>]?: EventListenerType<
    ObserverEvents<TInput, TOutput, TParams>[K]
  >;
};

/**
 * Watch the results of a query.
 *
 * @param query
 * @returns events for responding to changes in the query results
 */
export function observe<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams,
>({
  query,
  params,
  on,
}: {
  query: Query<TInput, TOutput>;
  params: ZodType<TParams>;
  on?: ObserverInitialListeners<TInput, TOutput, TParams>;
}): Observer<TInput, TOutput, TParams> {
  const registry = new Set<TOutput>();
  const matched = event('matched', z.tuple([z.custom<TOutput>()]));
  const preUpdate = event('preUpdate', z.tuple([]));
  const updated = event('updated', z.tuple([z.custom<TOutput>(), params]));
  const postUpdate = event('postUpdate', z.tuple([]));
  const unmatched = event('unmatched', z.tuple([z.custom<TOutput>()]));

  if (on?.matched) matched.on(on.matched);
  if (on?.preUpdate) preUpdate.on(on.preUpdate);
  if (on?.updated) updated.on(on.updated as Listener<'updated', [TOutput]>);
  if (on?.postUpdate) postUpdate.on(on.postUpdate);
  if (on?.unmatched) unmatched.on(on.unmatched);

  function update(ecs: ECS<TInput>, args: TParams): void {
    preUpdate.emit();
    const missing = new Set<TOutput>(registry);
    for (const entity of query.query(ecs)) {
      if (!registry.has(entity)) {
        registry.add(entity);
        matched.emit(entity);
      }
      updated.emit(entity, args);
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
