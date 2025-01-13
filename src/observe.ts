import z, { type ZodType } from 'zod';
import type { ECS, EntityLike } from './ecs';
import { type EventType, event } from './event';
import type { Query } from './query';

type Observer<TInput extends EntityLike, TOutput extends TInput> = {
  enter: EventType<'enter', ZodType<TOutput>>;
  update: EventType<'update', ZodType<TOutput>>;
  exit: EventType<'exit', ZodType<TOutput>>;
  doUpdate(ecs: ECS<TInput>): void;
};

export function observe<TInput extends EntityLike, TOutput extends TInput>(
  query: Query<TInput, TOutput>,
): Observer<TInput, TOutput> {
  const registry = new Set<TOutput>();
  const enter = event('enter', z.custom<TOutput>());
  const update = event('update', z.custom<TOutput>());
  const exit = event('exit', z.custom<TOutput>());

  function doUpdate(ecs: ECS<TInput>) {
    const unmatched = new Set<TOutput>(registry);
    for (const entity of query.query(ecs)) {
      if (!registry.has(entity)) {
        registry.add(entity);
        enter.emit(entity);
      }
      update.emit(entity);
      unmatched.delete(entity);
    }
    for (const entity of unmatched) {
      registry.delete(entity);
      exit.emit(entity);
    }
  }

  return { enter, update, exit, doUpdate };
}
