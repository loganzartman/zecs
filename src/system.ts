import type { ZodType } from 'zod';
import type { ECS, EntityLike } from './ecs';
import { type Observer, observe } from './observe';
import type { Query } from './query';

export type AnySystem = System<any, any, any, any, any, any>;

export type SystemInitParams<TSystem extends AnySystem> =
  TSystem extends System<any, any, infer TInitParams, any, any, any>
    ? TInitParams
    : never;

export type SystemUpdateParams<TSystem extends AnySystem> =
  TSystem extends System<any, any, any, infer TUpdateParams, any, any>
    ? TUpdateParams
    : never;

export type SystemConfig<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TDerived = void,
> = {
  /** Human-readable name for debugging */
  name?: string;
  /** Query that matches entities to be processed by this system */
  query: Query<TInput, TOutput>;
  /** Parameters schema which must be passed to update() */
  params: ZodType<TUpdateParams>;
  /** Systems that must be updated before this one */
  deps?: System<any, any, any, any, any, any>[];
  /** Resources shared across all entities in the system */
  shared?: {
    /** Parameters schema for initializing the shared resources */
    initParams: ZodType<TInitParams>;
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

export type SystemHandle<
  TInput extends EntityLike,
  TOutput extends TInput,
  TUpdateParams extends Record<string, unknown>,
> = {
  ecs: ECS<TInput>;
  observer: Observer<TInput, TOutput, TUpdateParams>;
  /** Update the system with the given parameters */
  update: (params: TUpdateParams) => void;
  /** Stop observing the system and destroy all resources */
  stop: () => Promise<void>;
};

export class System<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TDerived,
> {
  readonly config: SystemConfig<
    TInput,
    TOutput,
    TInitParams,
    TUpdateParams,
    TShared,
    TDerived
  >;

  readonly name: string;
  readonly deps: System<any, any, any, any, any, any>[];

  constructor(
    config: SystemConfig<
      TInput,
      TOutput,
      TInitParams,
      TUpdateParams,
      TShared,
      TDerived
    >,
  ) {
    this.config = config;
    this.name = config.name || 'unnamed';
    this.deps = config.deps || [];
  }

  async observe(
    ecs: ECS<TInput>,
    initParams: TInitParams,
  ): Promise<SystemHandle<TInput, TOutput, TUpdateParams>> {
    const {
      shared: configShared,
      derived: configDerived,
      onPreUpdate,
      onUpdated,
      onPostUpdate,
    } = this.config;

    const [shared, destroyShared] = await (async () => {
      if (!configShared) return [null as TShared, null];

      const shared = await configShared.create({ initParams });
      const destroyShared = () =>
        configShared.destroy?.({ initParams, shared });
      return [shared as TShared, destroyShared];
    })();

    const derived = new Map<TOutput, TDerived>();

    const observer = observe({
      query: this.config.query,
      params: this.config.params,
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

          const derivedResource = derived.get(entity);
          if (!derivedResource) {
            throw new Error('Derived resource not found for unmatched entity');
          }

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

    return { ecs, observer, update, stop };
  }
}

export function system<
  TInput extends EntityLike,
  TOutput extends TInput,
  TInitParams extends Record<string, unknown>,
  TUpdateParams extends Record<string, unknown>,
  TShared,
  TDerived,
>(
  config: SystemConfig<
    TInput,
    TOutput,
    TInitParams,
    TUpdateParams,
    TShared,
    TDerived
  >,
): System<TInput, TOutput, TInitParams, TUpdateParams, TShared, TDerived> {
  return new System(config);
}
