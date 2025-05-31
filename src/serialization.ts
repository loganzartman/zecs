import * as zm from 'zod/v4-mini';
import { hasOwn } from './util';

const refKey = '__zecs_ref__';

export const encodedEntityRefSchema = zm.object({
  [refKey]: zm.string(),
});

export type EncodedEntityRef = zm.infer<typeof encodedEntityRefSchema>;

export function isEncodedEntityRef(value: unknown): value is EncodedEntityRef {
  return encodedEntityRefSchema.safeParse(value).success;
}

export function serializeRefs(
  value: unknown,
  startDepth: number,
  getEntityID: (entity: object) => string | undefined,
  visited = new Set<unknown>(),
): unknown {
  if (!value) return value;

  if (typeof value !== 'object') return value;

  const entityID = getEntityID(value);
  if (entityID && startDepth <= 0) {
    // tracked entity; convert to reference
    return { [refKey]: entityID } satisfies EncodedEntityRef;
  }

  // circular reference check
  if (visited.has(value)) {
    throw new Error('Failed to serialize circular reference');
  }
  visited.add(value);

  if (Array.isArray(value)) {
    return value.map((e) =>
      serializeRefs(e, startDepth - 1, getEntityID, visited),
    );
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, e]) => [
      key,
      serializeRefs(e, startDepth - 1, getEntityID, visited),
    ]),
  );
}

export function deserializeRefs(
  value: unknown,
  entities: Record<string, unknown>,
  visited = new Set<unknown>(),
): void {
  if (visited.has(value)) return;
  visited.add(value);

  if (!value) return;

  if (typeof value !== 'object') return;

  for (const k in value) {
    if (!hasOwn(value, k)) continue;

    if (isEncodedEntityRef(value[k])) {
      const id = value[k][refKey];
      if (!(id in entities)) {
        throw new Error(`Referenced entity is missing: ${id}`);
      }
      value[k] = entities[id];
    } else {
      deserializeRefs(value[k], entities);
    }
  }
}
