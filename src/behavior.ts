import type { EntityLike } from './ecs';
import type { Query } from './query';
import type { Empty } from './util';
import {
  observe,
  type Observer,
  type ObserverInitialListeners,
} from './observe';
import type { ZodType } from 'zod';

export type Behavior<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams extends Record<string, unknown>,
> = {
  /** Apply to matching entities */
  query: Query<TInput, TOutput>;
  /** Other behaviors that are dependencies of this behavior */
  deps: Behavior<EntityLike, EntityLike, Record<string, unknown>>[];
  /** Parameters required to update the system */
  params: ZodType<TParams>;
  observer: Observer<TInput, TOutput, TParams>;
};

export function behavior<
  TInput extends EntityLike,
  TOutput extends TInput,
  TParams extends Record<string, unknown>,
>({
  query,
  params,
  deps,
  on,
}: {
  query: Query<TInput, TOutput>;
  params: ZodType<TParams>;
  deps: Behavior<EntityLike, EntityLike, Empty>[];
  on?: ObserverInitialListeners<TInput, TOutput, TParams>;
}): Behavior<TInput, TOutput, TParams> {
  return {
    query,
    params,
    deps,
    observer: observe({
      query,
      params,
      on,
    }),
  };
}
