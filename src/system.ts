import { type ZodType, z } from 'zod/v4';
import type { ECS, EntityLike } from './ecs';
import { observe } from './observe';
import type { Query } from './query';

export type System<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TEach,
> = {
  /** Human-readable name for debugging */
  name?: string;
  /** Query that matches entities to be processed by this system */
  query: Query<TInput, TOutput>;
  /** Parameters schema for initializing the system */
  initParams?: ZodType<TInitParams>;
  /** Parameters schema which must be passed to update() */
  updateParams?: ZodType<TUpdateParams>;
  /** Systems that must be updated before this one */
  deps?: System<any, any, any, any, any, any>[];
  /** Resources shared across all entities in the system */
  shared?: {
    /** Create shared resources for the system */
    create: (p: { ecs: ECS<TInput>; initParams: TInitParams }) =>
      | TShared
      | Promise<TShared>;
    /** Destroy shared resources for the system */
    destroy?: (p: {
      ecs: ECS<TInput>;
      initParams: TInitParams;
      shared: TShared;
    }) => void | Promise<void>;
  };
  /** Resources each for each entity that matches the query */
  each?: {
    /** Create each resources for each matching entity */
    create: (p: {
      ecs: ECS<TInput>;
      initParams: TInitParams;
      shared: TShared;
      entity: TOutput;
    }) => TEach;
    /** Destroy each resources for an entity */
    destroy?: (p: {
      ecs: ECS<TInput>;
      initParams: TInitParams;
      shared: TShared;
      each: TEach;
    }) => void;
  };
  /** Called before processing any entities */
  onPreUpdate?: (p: {
    ecs: ECS<TInput>;
    initParams: TInitParams;
    updateParams: TUpdateParams;
    shared: TShared;
  }) => void;
  /** Called for each matching entity */
  onUpdated?: (p: {
    ecs: ECS<TInput>;
    initParams: TInitParams;
    updateParams: TUpdateParams;
    shared: TShared;
    each: TEach;
    entity: TOutput;
  }) => void;
  /** Called after processing all entities */
  onPostUpdate?: (p: {
    ecs: ECS<TInput>;
    initParams: TInitParams;
    updateParams: TUpdateParams;
    shared: TShared;
  }) => void;
};

export type AnySystem = System<any, any, any, any, any, any>;

export type UnknownSystem = System<
  EntityLike,
  EntityLike,
  Record<string, unknown>,
  Record<string, unknown>,
  unknown,
  unknown
>;

export type SystemInitParams<TSystem extends AnySystem> =
  TSystem extends System<any, any, infer TInitParams, any, any, any>
    ? TInitParams
    : never;

export type SystemUpdateParams<TSystem extends AnySystem> =
  TSystem extends System<any, any, any, infer TUpdateParams, any, any>
    ? TUpdateParams
    : never;

export type SystemHandle<TUpdateParams extends Record<string, unknown>> = {
  /** Update the system with the given parameters */
  update: (updateParams: TUpdateParams) => void;
  /** Stop observing the system and destroy all resources */
  stop: () => Promise<void>;
};

export async function attachSystem<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TEach,
>(
  ecs: ECS<TInput>,
  system: System<TInput, TOutput, TInitParams, TUpdateParams, TShared, TEach>,
  initParams: TInitParams,
): Promise<SystemHandle<TUpdateParams>> {
  const {
    shared: sharedConfig,
    each: eachConfig,
    onPreUpdate,
    onUpdated,
    onPostUpdate,
  } = system;

  const [shared, destroyShared] = await (async () => {
    if (!sharedConfig) return [null as TShared, null];

    const shared = await sharedConfig.create({ ecs, initParams });
    const destroyShared = () =>
      sharedConfig.destroy?.({ ecs, initParams, shared });
    return [shared as TShared, destroyShared];
  })();

  const each = new Map<TOutput, TEach>();

  const observer = observe({
    query: system.query,
    params:
      system.updateParams ??
      (z.record(z.string(), z.unknown()) as ZodType<TUpdateParams>),
    on: {
      preUpdate(updateParams: TUpdateParams) {
        onPreUpdate?.({ ecs, initParams, updateParams, shared });
      },

      matched(entity) {
        if (!eachConfig) {
          return;
        }

        each.set(
          entity,
          eachConfig.create({
            ecs,
            initParams,
            shared,
            entity,
          }),
        );
      },

      updated(entity, updateParams) {
        if (!onUpdated) {
          return;
        }

        let eachResources: TEach;
        if (eachConfig) {
          if (!each.has(entity)) {
            throw new Error('Each resource not found for updated entity');
          }
          eachResources = each.get(entity) as TEach;
        } else {
          eachResources = undefined as TEach;
        }

        onUpdated({
          ecs,
          initParams,
          updateParams,
          shared,
          each: eachResources,
          entity,
        });
      },

      unmatched(entity) {
        if (!eachConfig) {
          return;
        }

        if (!each.has(entity)) {
          throw new Error('Each resource not found for unmatched entity');
        }
        const eachResource = each.get(entity) as TEach;

        eachConfig.destroy?.({
          ecs,
          initParams,
          shared,
          each: eachResource,
        });

        each.delete(entity);
      },

      postUpdate(updateParams: TUpdateParams) {
        onPostUpdate?.({ ecs, initParams, updateParams, shared });
      },
    },
  });

  const update = (updateParams: TUpdateParams) => {
    observer.update(ecs, updateParams);
  };

  const stop = async () => {
    observer.stop();
    if (eachConfig) {
      for (const resource of each.values()) {
        eachConfig.destroy?.({
          ecs,
          initParams,
          shared,
          each: resource,
        });
      }
    }
    await destroyShared?.();
  };

  return { update, stop };
}

export function system<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TEach,
>(
  config: System<TInput, TOutput, TInitParams, TUpdateParams, TShared, TEach>,
): System<TInput, TOutput, TInitParams, TUpdateParams, TShared, TEach> {
  return config;
}
