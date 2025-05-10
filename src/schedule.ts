import type { ECS, EntityLike } from './ecs';
import type {
  SystemUpdateParams,
  AnySystem,
  System,
  SystemHandle,
  SystemInitParams,
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

export class Schedule<
  TEntity extends EntityLike,
  TSystems extends System<Partial<TEntity>, any, any, any, any, any>[],
> {
  readonly steps: Array<Set<TSystems[number]>> = [];
  #systemHandles: Map<TSystems[number], SystemHandle<any, any, any>> =
    new Map();

  static async from<
    TEntity extends EntityLike,
    TSystems extends System<Partial<TEntity>, any, any, any, any, any>[],
  >(
    systems: TSystems,
    ecs: ECS<TEntity>,
    initParams: CombinedInitParams<TSystems>,
  ): Promise<Schedule<TEntity, TSystems>> {
    const systemHandles = new Map<
      TSystems[number],
      SystemHandle<any, any, any>
    >(
      await Promise.all(
        systems.map(
          async (system) =>
            [system, await system.observe(ecs, initParams)] as const,
        ),
      ),
    );
    return new Schedule(systems, systemHandles);
  }

  private constructor(
    systems: TSystems,
    systemHandles: Map<TSystems[number], SystemHandle<any, any, any>>,
  ) {
    this.#systemHandles = systemHandles;

    const dependersMap = makeDependersMap(systems);
    const remainingDeps = new Map<
      System<any, any, any, any, any, any>,
      number
    >();
    const removed = new Set<System<any, any, any, any, any, any>>();

    for (const system of systems) {
      remainingDeps.set(system, system.deps.length);
    }

    while (remainingDeps.size > 0) {
      removed.clear();
      const step = new Set<TSystems[number]>();
      this.steps.push(step);

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
  }

  update(params: CombinedUpdateParams<TSystems>): void {
    for (const step of this.steps) {
      for (const system of step) {
        const handle = this.#systemHandles.get(system);
        if (!handle) {
          throw new Error(`System handle not found for: ${system.name}`);
        }
        handle.update(params);
      }
    }
  }

  async stop(): Promise<void> {
    await Promise.all(
      Array.from(this.#systemHandles.values()).map((handle) => handle.stop()),
    );
  }
}

export async function schedule<
  TEntity extends EntityLike,
  const TSystems extends AnySystem[],
>(
  systems: TSystems,
  ecs: ECS<TEntity>,
  initParams: CombinedInitParams<TSystems>,
): Promise<Schedule<TEntity, TSystems>> {
  return Schedule.from(systems, ecs, initParams);
}

export function formatSchedule(schedule: Schedule<any, any>): string {
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
    for (const dep of system.deps) {
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
