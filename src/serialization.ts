export const entitySymbol: unique symbol = Symbol('zecs-entity');
export const refSigil = '$$ref';

export function isSerializedRef(
  value: unknown,
): value is { [refSigil]: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    refSigil in value &&
    typeof value[refSigil] === 'string'
  );
}

export function serializeRefs(
  value: unknown,
  startDepth: number,
  visited = new Set<unknown>(),
): unknown {
  // falsy
  if (!value) return value;

  // primitive
  if (typeof value !== 'object') return value;

  // entity reference
  if (entitySymbol in value && startDepth <= 0) {
    return { [refSigil]: value[entitySymbol] };
  }

  // circular reference check
  if (visited.has(value))
    throw new Error('Failed to serialize circular reference');
  visited.add(value);

  // array
  if (Array.isArray(value))
    return value.map((e) => serializeRefs(e, startDepth - 1, visited));

  // object
  return Object.fromEntries(
    Object.entries(value).map(([key, e]) => [
      key,
      serializeRefs(e, startDepth - 1, visited),
    ]),
  );
}

export function deserializeRefs(
  value: unknown,
  entities: Record<string, unknown>,
): unknown {
  if (!value) return value;

  if (typeof value !== 'object') return value;

  if (isSerializedRef(value)) {
    const id = value[refSigil];
    if (!(id in entities)) {
      throw new Error(`Failed to deserialize entity reference ${id}`);
    }
    return deserializeRefs(entities[id], entities);
  }

  if (Array.isArray(value)) {
    return value.map((e) => deserializeRefs(e, entities));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, e]) => [
      key,
      deserializeRefs(e, entities),
    ]),
  );
}
