import type { ZodType } from 'zod';
import type { EntityLike } from './ecs';
import {
  type Observer,
  type ObserverInitialListeners,
  observe,
} from './observe';
import type { Query } from './query';

export type BehaviorOptions<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams extends Record<string, unknown>,
> = {
  /** Human-readable name for debugging */
  name?: string;
  /** Matches entities to be updated by this behavior */
  query: Query<TInput, TOutput>;
  /** Parameters which must be passed to update() and are forwarded to preUpdate, updated, and postUpdate events */
  params: ZodType<TParams>;
  /** Behaviors that must be updated before this one */
  deps: Behavior<any, any, any>[];
  /** Listeners to attach to the observer */
  on?:
    | ObserverInitialListeners<TInput, TOutput, TParams>
    | (() => ObserverInitialListeners<TInput, TOutput, TParams>);
};

export class Behavior<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams extends Record<string, unknown>,
> {
  name: string;
  query: Query<TInput, TOutput>;
  deps: Behavior<EntityLike, EntityLike, Record<string, unknown>>[];
  params: ZodType<TParams>;

  #on:
    | ObserverInitialListeners<TInput, TOutput, TParams>
    | (() => ObserverInitialListeners<TInput, TOutput, TParams>);

  constructor({
    name,
    query,
    params,
    deps,
    on,
  }: BehaviorOptions<TInput, TOutput, TParams>) {
    this.name = name ?? '<unnamed>';
    this.query = query;
    this.params = params;
    this.deps = deps;
    this.#on = on ?? {};
  }

  /** Produce a clone of this behavior with additional dependencies */
  withDeps(
    additionalDeps: Behavior<any, any, any>[],
  ): Behavior<TInput, TOutput, TParams> {
    return behavior({
      query: this.query,
      params: this.params,
      deps: [...this.deps, ...additionalDeps],
      on: this.#on,
    });
  }

  observe(): Observer<TInput, TOutput, TParams> {
    return observe({
      query: this.query,
      params: this.params,
      on: typeof this.#on === 'function' ? this.#on() : this.#on,
    });
  }
}

export function behavior<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams extends Record<string, unknown>,
>(
  options: BehaviorOptions<TInput, TOutput, TParams>,
): Behavior<TInput, TOutput, TParams> {
  return new Behavior(options);
}
