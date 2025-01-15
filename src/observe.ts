import z, { type ZodType } from 'zod';
import type { ECS, EntityLike } from './ecs';
import { type EventType, event } from './event';
import type { Query } from './query';

export type Observer<TInput extends EntityLike, TOutput extends TInput> = {
  matched: EventType<'matched', ZodType<TOutput>>;
  updated: EventType<'updated', ZodType<TOutput>>;
  unmatched: EventType<'unmatched', ZodType<TOutput>>;
  update(ecs: ECS<TInput>): void;
};

export function observe<TInput extends EntityLike, TOutput extends TInput>(
  query: Query<TInput, TOutput>,
): Observer<TInput, TOutput> {
  const registry = new Set<TOutput>();
  const matched = event('matched', z.custom<TOutput>());
  const updated = event('updated', z.custom<TOutput>());
  const unmatched = event('unmatched', z.custom<TOutput>());

  function update(ecs: ECS<TInput>) {
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
  }

  return { matched, updated, unmatched, update };
}
