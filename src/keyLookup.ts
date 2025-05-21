import type { ECS, EntityLike } from './ecs';
import type { Query } from './query';
import type { DeepPartial } from './util';

export type KeyLookup<
  TOutput extends EntityLike,
  TKey extends DeepPartial<TOutput> = TOutput,
> = {
  /** Update the set of matching entities. */
  update(): void;
  /** Count the number of entities that match the key. */
  count(e: TKey): number;
  /** Get the entities that match the key. */
  get(e: TKey): Readonly<Set<TOutput>>;
};

/**
 * Create a key lookup for a query.
 *
 * @param ecs The ECS instance.
 * @param query The query to look up entities for.
 * @param keyFn A function that takes an entity and returns an iterable of keys.
 * @returns A key lookup object
 */
export function keyLookup<
  TEntity extends EntityLike,
  TOutput extends TEntity,
  TKey extends DeepPartial<TOutput> = TOutput,
>(
  ecs: ECS<TEntity>,
  query: Query<TEntity, TOutput>,
  keyFn: (e: TKey) => Iterable<string>,
): KeyLookup<TOutput, TKey> {
  const empty = new Set();
  const kv = new Map<string, Set<TOutput>>();

  const result: KeyLookup<TOutput, TKey> = {
    get(e) {
      const result = new Set<TOutput>();
      const keys = keyFn(e as TKey);
      for (const key of keys) {
        for (const item of kv.get(key) ?? empty) {
          result.add(item as TOutput);
        }
      }
      return result;
    },

    count(e) {
      let result = 0;
      const keys = keyFn(e as TKey);
      for (const key of keys) {
        for (const _ of kv.get(key) ?? empty) {
          ++result;
        }
      }
      return result;
    },

    update() {
      for (const set of kv.values()) {
        set.clear();
      }

      for (const e of query.query(ecs)) {
        const keys = keyFn(e as unknown as TKey);
        for (const key of keys) {
          const items = kv.get(key) ?? new Set();
          kv.set(key, items);
          items.add(e);
        }
      }
    },
  };

  result.update();

  return result;
}
