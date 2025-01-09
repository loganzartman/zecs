export type Expand<T> = T extends any ? { [K in keyof T]: T[K] } : never;

export type Empty = Record<never, never>;

export type Entries<TObject extends Record<PropertyKey, unknown>> = {
  [K in keyof TObject]: [K, TObject[K]];
}[keyof TObject][];

export type FromEntries<TEntries extends Array<[PropertyKey, unknown]>> = {
  [E in TEntries[number] as E[0]]: E[1];
};

export function entries<const TObject extends Record<PropertyKey, unknown>>(
  object: TObject,
): Entries<TObject> {
  return Object.entries(object) as Entries<TObject>;
}

export function fromEntries<
  const TEntries extends Array<[PropertyKey, unknown]>,
>(entries: TEntries): FromEntries<TEntries> {
  return Object.fromEntries(entries) as FromEntries<TEntries>;
}

export function every<T>(a: Iterable<T>, f: (e: T) => boolean): boolean {
  for (const e of a) {
    if (!f(e)) {
      return false;
    }
  }
  return true;
}
