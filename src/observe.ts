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
  /** Called when an entity now matches the query that did not on the previous update() */
  matched: EventType<'matched', [TOutput, TParams]>;
  /** Called each time entities are updated, before the update occurs */
  preUpdate: EventType<'preUpdate', [TParams]>;
  /** Called for each matching entity each update */
  updated: EventType<'updated', [TOutput, TParams]>;
  /** Called each time entities are updated, after the update is finished */
  postUpdate: EventType<'postUpdate', [TParams]>;
  /** Called when an entity no longer matches the query that did on the previous update() */
  unmatched: EventType<'unmatched', [TOutput, TParams]>;
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

export class Observer<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams,
> implements ObserverEvents<TInput, TOutput, TParams>
{
  readonly query: Query<TInput, TOutput>;
  readonly params: ZodType<TParams>;

  readonly matched: ObserverEvents<TInput, TOutput, TParams>['matched'];
  readonly preUpdate: ObserverEvents<TInput, TOutput, TParams>['preUpdate'];
  readonly updated: ObserverEvents<TInput, TOutput, TParams>['updated'];
  readonly postUpdate: ObserverEvents<TInput, TOutput, TParams>['postUpdate'];
  readonly unmatched: ObserverEvents<TInput, TOutput, TParams>['unmatched'];

  #updating: { status: true; params: TParams } | { status: false } = {
    status: false,
  };
  #registry = new Set<TOutput>();
  #matched = new Set<TOutput>();

  constructor({
    query,
    params,
    on,
  }: {
    query: Query<TInput, TOutput>;
    params: ZodType<TParams>;
    on?: ObserverInitialListeners<TInput, TOutput, TParams>;
  }) {
    this.query = query;
    this.params = params;

    this.matched = event('matched', z.tuple([z.custom<TOutput>(), params]));
    this.preUpdate = event('preUpdate', z.tuple([params]));
    this.updated = event('updated', z.tuple([z.custom<TOutput>(), params]));
    this.postUpdate = event('postUpdate', z.tuple([params]));
    this.unmatched = event('unmatched', z.tuple([z.custom<TOutput>(), params]));

    if (on?.matched) this.matched.on(on.matched);
    if (on?.preUpdate) this.preUpdate.on(on.preUpdate);
    if (on?.updated)
      this.updated.on(on.updated as Listener<'updated', [TOutput]>);
    if (on?.postUpdate) this.postUpdate.on(on.postUpdate);
    if (on?.unmatched) this.unmatched.on(on.unmatched);
  }

  startUpdate(params: TParams): void {
    if (this.#updating.status) {
      throw new Error('Observer is already updating');
    }

    this.#updating = { status: true, params };
    this.#matched.clear();
    this.preUpdate.emit(params);
  }

  updateEntity(entity: TOutput): void {
    if (!this.#updating.status) {
      throw new Error('Observer is not updating');
    }

    if (!this.#registry.has(entity)) {
      this.#registry.add(entity);
      this.matched.emit(entity, this.#updating.params);
    }
    this.updated.emit(entity, this.#updating.params);
    this.#matched.add(entity);
  }

  finishUpdate(): void {
    if (!this.#updating.status) {
      throw new Error('Observer is not updating');
    }

    const { params } = this.#updating;
    this.#updating = { status: false };

    for (const entity of this.#registry) {
      if (!this.#matched.has(entity)) {
        this.#registry.delete(entity);
        this.unmatched.emit(entity, params);
      }
    }

    this.postUpdate.emit(params);
  }

  /** Update the set of matching entities and emit events */
  update(ecs: ECS<TInput>, params: TParams): void {
    this.startUpdate(params);
    for (const entity of this.query.query(ecs)) {
      this.updateEntity(entity);
    }
    this.finishUpdate();
  }
}

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
>(options: {
  query: Query<TInput, TOutput>;
  params: ZodType<TParams>;
  on?: ObserverInitialListeners<TInput, TOutput, TParams>;
}): Observer<TInput, TOutput, TParams> {
  return new Observer(options);
}
