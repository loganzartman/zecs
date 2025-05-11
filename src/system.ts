import { type ZodType, z } from 'zod';
import type { ECS, EntityLike } from './ecs';
import { observe } from './observe';
import type { Query } from './query';

export type System<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TDerived,
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
  /** Resources derived for each entity that matches the query */
  derived?: {
    /** Create derived resources for each matching entity */
    create: (p: {
      ecs: ECS<TInput>;
      initParams: TInitParams;
      shared: TShared;
      entity: TOutput;
    }) => TDerived;
    /** Destroy derived resources for an entity */
    destroy?: (p: {
      ecs: ECS<TInput>;
      initParams: TInitParams;
      shared: TShared;
      derived: TDerived;
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
    derived: TDerived;
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
  TDerived,
>(
  system: System<
    TInput,
    TOutput,
    TInitParams,
    TUpdateParams,
    TShared,
    TDerived
  >,
  ecs: ECS<TInput>,
  initParams: TInitParams,
): Promise<SystemHandle<TUpdateParams>> {
  const {
    shared: sharedConfig,
    derived: derivedConfig,
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

  const derived = new Map<TOutput, TDerived>();

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
        if (!derivedConfig) {
          return;
        }

        derived.set(
          entity,
          derivedConfig.create({
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

        let derivedResources: TDerived;
        if (derivedConfig) {
          if (!derived.has(entity)) {
            throw new Error('Derived resource not found for updated entity');
          }
          derivedResources = derived.get(entity) as TDerived;
        } else {
          derivedResources = undefined as TDerived;
        }

        onUpdated({
          ecs,
          initParams,
          updateParams,
          shared,
          derived: derivedResources,
          entity,
        });
      },

      unmatched(entity) {
        if (!derivedConfig) {
          return;
        }

        if (!derived.has(entity)) {
          throw new Error('Derived resource not found for unmatched entity');
        }
        const derivedResource = derived.get(entity) as TDerived;

        derivedConfig.destroy?.({
          ecs,
          initParams,
          shared,
          derived: derivedResource,
        });

        derived.delete(entity);
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
    if (derivedConfig) {
      for (const resource of derived.values()) {
        derivedConfig.destroy?.({
          ecs,
          initParams,
          shared,
          derived: resource,
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
  TDerived,
>(
  config: System<
    TInput,
    TOutput,
    TInitParams,
    TUpdateParams,
    TShared,
    TDerived
  >,
): System<TInput, TOutput, TInitParams, TUpdateParams, TShared, TDerived> {
  return config;
}
