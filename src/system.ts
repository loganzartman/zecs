import { z, type ZodType } from 'zod';
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
  params?: ZodType<TUpdateParams>;
  /** Systems that must be updated before this one */
  deps?: System<any, any, any, any, any, any>[];
  /** Resources shared across all entities in the system */
  shared?: {
    /** Create shared resources for the system */
    create: (p: { initParams: TInitParams }) => TShared | Promise<TShared>;
    /** Destroy shared resources for the system */
    destroy?: (p: {
      initParams: TInitParams;
      shared: TShared;
    }) => void | Promise<void>;
  };
  /** Resources derived for each entity that matches the query */
  derived?: {
    /** Create derived resources for each matching entity */
    create: (p: {
      initParams: TInitParams;
      shared: TShared;
      entity: TOutput;
    }) => TDerived;
    /** Destroy derived resources for an entity */
    destroy?: (p: {
      initParams: TInitParams;
      shared: TShared;
      derived: TDerived;
    }) => void;
  };
  /** Called before processing any entities */
  onPreUpdate?: (p: {
    params: TUpdateParams;
    shared: TShared;
  }) => void;
  /** Called for each matching entity */
  onUpdated?: (p: {
    params: TUpdateParams;
    shared: TShared;
    derived: TDerived;
    entity: TOutput;
  }) => void;
  /** Called after processing all entities */
  onPostUpdate?: (p: {
    params: TUpdateParams;
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
  update: (params: TUpdateParams) => void;
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
    shared: configShared,
    derived: configDerived,
    onPreUpdate,
    onUpdated,
    onPostUpdate,
  } = system;

  const [shared, destroyShared] = await (async () => {
    if (!configShared) return [null as TShared, null];

    const shared = await configShared.create({ initParams });
    const destroyShared = () => configShared.destroy?.({ initParams, shared });
    return [shared as TShared, destroyShared];
  })();

  const derived = new Map<TOutput, TDerived>();

  const observer = observe({
    query: system.query,
    params:
      system.params ??
      (z.record(z.string(), z.unknown()) as ZodType<TUpdateParams>),
    on: {
      preUpdate(params: TUpdateParams) {
        onPreUpdate?.({ params, shared });
      },

      matched(entity) {
        if (!configDerived) {
          return;
        }

        derived.set(
          entity,
          configDerived.create({
            initParams,
            shared,
            entity,
          }),
        );
      },

      updated(entity, params) {
        if (!onUpdated) {
          return;
        }

        let derivedResources: TDerived;
        if (configDerived) {
          if (!derived.has(entity)) {
            throw new Error('Derived resource not found for updated entity');
          }
          derivedResources = derived.get(entity) as TDerived;
        } else {
          derivedResources = undefined as TDerived;
        }

        onUpdated({
          params,
          shared,
          derived: derivedResources,
          entity,
        });
      },

      unmatched(entity) {
        if (!configDerived) {
          return;
        }

        if (!derived.has(entity)) {
          throw new Error('Derived resource not found for unmatched entity');
        }
        const derivedResource = derived.get(entity) as TDerived;

        configDerived.destroy?.({
          initParams,
          shared,
          derived: derivedResource,
        });

        derived.delete(entity);
      },

      postUpdate(params: TUpdateParams) {
        onPostUpdate?.({ params, shared });
      },
    },
  });

  const update = (params: TUpdateParams) => {
    observer.update(ecs, params);
  };

  const stop = async () => {
    observer.stop();
    if (configDerived) {
      for (const resource of derived.values()) {
        configDerived.destroy?.({
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
