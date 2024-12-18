import type { ECS, EntityLike } from './ecs';
import type { Query } from './query';

export type KeyLookup<TEntity extends EntityLike, TOutput extends TEntity> = {
  update(): void;
  get(key: string): Readonly<Set<TOutput>>;
  getBy(e: TOutput): Readonly<Set<TOutput>>;
};

export function keyLookup<TEntity extends EntityLike, TOutput extends TEntity>(
  ecs: ECS<TEntity>,
  query: Query<TEntity, TOutput>,
  keyFn: (e: TOutput) => string,
): KeyLookup<TEntity, TOutput> {
  const empty = new Set();
  const lut = new Map<string, Set<TOutput>>();

  function update() {
    for (const set of lut.values()) {
      set.clear();
    }
    for (const e of query.query(ecs)) {
      const key = keyFn(e);
      const items = lut.get(key) ?? new Set();
      items.add(e);
      lut.set(key, items);
    }
  }
  update();

  return {
    update,
    get(key: string): Readonly<Set<TOutput>> {
      return (lut.get(key) as Set<TOutput>) ?? empty;
    },
    getBy(e: TOutput): Readonly<Set<TOutput>> {
      const key = keyFn(e);
      return (lut.get(key) as Set<TOutput>) ?? empty;
    },
  };
}
