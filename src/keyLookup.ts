import type { ECS, EntityLike } from './ecs';
import type { Query } from './query';

export type KeyLookup<TEntity extends EntityLike, TOutput extends TEntity> = {
  update(): void;
  get(e: TOutput): Readonly<Set<TOutput>>;
};

export function keyLookup<TEntity extends EntityLike, TOutput extends TEntity>(
  ecs: ECS<TEntity>,
  query: Query<TEntity, TOutput>,
  keyFn: (e: TOutput) => string | string[],
): KeyLookup<TEntity, TOutput> {
  const empty = new Set();
  const lut = new Map<string, Set<TOutput>>();

  function update() {
    for (const set of lut.values()) {
      set.clear();
    }

    for (const e of query.query(ecs)) {
      const keys = keyFn(e);
      if (Array.isArray(keys)) {
        for (const key of keys) {
          const items = lut.get(key) ?? new Set();
          items.add(e);
          lut.set(key, items);
        }
      } else {
        const key = keys;
        const items = lut.get(key) ?? new Set();
        items.add(e);
        lut.set(key, items);
      }
    }
  }
  update();

  return {
    update,
    get(e: TOutput): Readonly<Set<TOutput>> {
      const keys = keyFn(e);

      if (Array.isArray(keys)) {
        const result = new Set<TOutput>();
        for (const key of keys) {
          for (const item of lut.get(key) ?? empty) {
            result.add(item as TOutput);
          }
        }
        return result;
      }

      const key = keys;
      return (lut.get(key) as Set<TOutput>) ?? empty;
    },
  };
}
