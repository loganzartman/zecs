import type { ECS, EntityLike } from './ecs';
import {
  type AnySystem,
  type System,
  type SystemHandle,
  type SystemInitParams,
  type SystemUpdateParams,
  type UnknownSystem,
  attachSystem,
} from './system';

type OnlyOrArray<T> = T | T[];

type StepInitParams<TStep extends OnlyOrArray<AnySystem>> =
  TStep extends Array<AnySystem>
    ? SystemInitParams<TStep[number]>
    : TStep extends AnySystem
      ? SystemInitParams<TStep>
      : never;

type CombinedInitParams<TSteps extends Array<OnlyOrArray<AnySystem>>> =
  TSteps extends [
    infer TStep extends OnlyOrArray<AnySystem>,
    ...infer TRest extends Array<OnlyOrArray<AnySystem>>,
  ]
    ? TRest extends []
      ? StepInitParams<TStep>
      : StepInitParams<TStep> & CombinedInitParams<TRest>
    : never;

type StepUpdateParams<TStep extends OnlyOrArray<AnySystem>> =
  TStep extends Array<AnySystem>
    ? SystemUpdateParams<TStep[number]>
    : TStep extends AnySystem
      ? SystemUpdateParams<TStep>
      : never;

type CombinedUpdateParams<TSteps extends Array<OnlyOrArray<AnySystem>>> =
  TSteps extends [
    infer TStep extends OnlyOrArray<AnySystem>,
    ...infer TRest extends Array<OnlyOrArray<AnySystem>>,
  ]
    ? TRest extends []
      ? StepUpdateParams<TStep>
      : StepUpdateParams<TStep> & CombinedUpdateParams<TRest>
    : never;

export type Schedule<TUpdateParams extends Record<string, unknown>> = {
  steps: Array<Array<UnknownSystem>>;
  update(params: TUpdateParams): void;
  stop(): Promise<void>;
};

export async function scheduleSystems<
  TEntity extends EntityLike,
  const TSystems extends Array<
    OnlyOrArray<System<TEntity, any, any, any, any, any>>
  >,
>(
  ecs: ECS<TEntity>,
  steps: TSystems,
  initParams: CombinedInitParams<TSystems>,
): Promise<Schedule<CombinedUpdateParams<TSystems>>> {
  const normalizedSteps = steps.map((step) =>
    Array.isArray(step) ? step : [step],
  );

  const systemHandles: Map<
    TSystems[number],
    SystemHandle<CombinedUpdateParams<TSystems>>
  > = new Map(
    await Promise.all(
      normalizedSteps.flatMap((step) =>
        step.map(
          async (system) =>
            [system, await attachSystem(ecs, system, initParams)] as const,
        ),
      ),
    ),
  );

  const update = (params: CombinedUpdateParams<TSystems>) => {
    for (const step of normalizedSteps) {
      for (const system of step) {
        const handle = systemHandles.get(system);
        if (!handle) {
          throw new Error(`System handle not found for ${system.name}`);
        }
        handle.update(params);
      }
    }
  };

  const stop = async () => {
    await Promise.all(
      [...systemHandles.values()].map((handle) => handle.stop()),
    );
  };

  return {
    steps: normalizedSteps as Array<Array<UnknownSystem>>,
    update,
    stop,
  };
}

export function formatSchedule(
  schedule: Schedule<Record<string, unknown>>,
): string {
  return schedule.steps
    .map((step, index) => {
      const systems = Array.from(step)
        .map((s) => s.name)
        .join(', ');
      return `Step ${index}: ${systems}`;
    })
    .join('\n');
}
