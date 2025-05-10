import type { ECS, EntityLike } from './ecs';
import {
  type SystemUpdateParams,
  type AnySystem,
  type System,
  type SystemInitParams,
  attachSystem,
  type UnknownSystem,
  type SystemHandle,
} from './system';

type CombinedInitParams<TSystems extends AnySystem[]> = TSystems extends [
  infer TSystem extends AnySystem,
  ...infer TRest extends AnySystem[],
]
  ? TRest extends []
    ? SystemInitParams<TSystem>
    : SystemInitParams<TSystem> & CombinedInitParams<TRest>
  : never;

type CombinedUpdateParams<TSystems extends AnySystem[]> = TSystems extends [
  infer TSystem extends AnySystem,
  ...infer TRest extends AnySystem[],
]
  ? TRest extends []
    ? SystemUpdateParams<TSystem>
    : SystemUpdateParams<TSystem> & CombinedUpdateParams<TRest>
  : never;

export type Schedule<TUpdateParams extends Record<string, unknown>> = {
  steps: Array<Set<UnknownSystem>>;
  update(params: TUpdateParams): void;
  stop(): Promise<void>;
};

export async function scheduleSystems<
  TEntity extends EntityLike,
  const TSystems extends System<Partial<TEntity>, any, any, any, any, any>[],
>(
  systems: TSystems,
  ecs: ECS<TEntity>,
  initParams: CombinedInitParams<TSystems>,
): Promise<Schedule<CombinedUpdateParams<TSystems>>> {
  const systemHandles: Map<
    TSystems[number],
    SystemHandle<CombinedUpdateParams<TSystems>>
  > = new Map(
    await Promise.all(
      systems.map(
        async (system: TSystems[number]) =>
          [system, await attachSystem(system, ecs, initParams)] as const,
      ),
    ),
  );

  const dependersMap = makeDependersMap(systems);
  const remainingDeps = new Map<AnySystem, number>();
  const removed = new Set<AnySystem>();

  for (const system of systems) {
    remainingDeps.set(system, system.deps?.length ?? 0);
  }

  const steps: Array<Set<TSystems[number]>> = [];
  while (remainingDeps.size > 0) {
    removed.clear();
    const step = new Set<TSystems[number]>();
    steps.push(step);

    for (const [system, count] of remainingDeps) {
      if (count > 0) {
        continue;
      }

      step.add(system);
      remainingDeps.delete(system);
      removed.add(system);
    }

    for (const dep of removed) {
      for (const depender of dependersMap.get(dep) ?? []) {
        const remaining = remainingDeps.get(depender);
        if (remaining === undefined) throw new Error('Depender not found');
        remainingDeps.set(depender, remaining - 1);
      }
    }

    if (step.size === 0) throw new Error('Invalid dependency graph');
  }

  const update = (params: CombinedUpdateParams<TSystems>) => {
    for (const step of steps) {
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

  return { steps: steps as Array<Set<UnknownSystem>>, update, stop };
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

function makeDependersMap<TSystems extends AnySystem[]>(
  systems: TSystems,
): WeakMap<TSystems[number], TSystems[number][]> {
  const dependersMap = new WeakMap<AnySystem, AnySystem[]>();

  for (const system of systems) {
    for (const dep of system.deps ?? []) {
      let dependers = dependersMap.get(dep);
      if (!dependers) {
        dependers = [];
        dependersMap.set(dep, dependers);
      }
      dependers.push(system);
    }
  }
  return dependersMap;
}
