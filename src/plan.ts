import type { Behavior } from './behavior';
import type { EntityLike } from './ecs';
import type { ECS } from './ecs';
import type { Observer } from './observe';

type CombinedParams<TBehaviors extends Array<Behavior<any, any, any>>> =
  TBehaviors extends [
    Behavior<any, any, infer TParams>,
    ...infer TRest extends Array<Behavior<any, any, any>>,
  ]
    ? TRest extends []
      ? TParams
      : TParams & CombinedParams<TRest>
    : never;

export class Plan<
  TInput extends EntityLike,
  TOutput extends TInput,
  const TBehaviors extends Array<Behavior<TInput, TOutput, any>>,
> {
  readonly steps: Array<Set<TBehaviors[number]>> = [];
  #observers: Map<TBehaviors[number], Observer<TInput, TOutput, any>> =
    new Map();

  constructor(behaviors: TBehaviors) {
    for (const behavior of behaviors) {
      this.#observers.set(behavior, behavior.observe());
    }

    const dependers = makeDependersMap(behaviors);
    const remainingDeps = new Map<Behavior<any, any, any>, number>();
    const removed = new Set<Behavior<any, any, any>>();

    for (const behavior of behaviors) {
      remainingDeps.set(behavior, behavior.deps.length);
    }

    while (remainingDeps.size > 0) {
      removed.clear();
      const step = new Set<TBehaviors[number]>();
      this.steps.push(step);

      for (const [behavior, count] of remainingDeps) {
        if (count > 0) {
          continue;
        }

        step.add(behavior);
        remainingDeps.delete(behavior);
        removed.add(behavior);
      }

      for (const dep of removed) {
        for (const depender of dependers.get(dep) ?? []) {
          const remaining = remainingDeps.get(depender);
          if (remaining === undefined) throw new Error('Depender not found');
          remainingDeps.set(depender, remaining - 1);
        }
      }

      if (step.size === 0) throw new Error('Invalid dependency graph');
    }
  }

  update(ecs: ECS<TInput>, params: CombinedParams<TBehaviors>) {
    for (const step of this.steps) {
      for (const behavior of step) {
        const observer = this.#observers.get(behavior);
        if (!observer) {
          throw new Error('Observer not found for behavior');
        }
        observer.update(ecs, params);
      }
    }
  }
}

export function plan<
  TInput extends EntityLike,
  TOutput extends TInput,
  const TBehaviors extends Array<Behavior<any, any, any>>,
>(behaviors: TBehaviors): Plan<TInput, TOutput, TBehaviors> {
  return new Plan(behaviors);
}

export function formatPlan(plan: Plan<any, any, any>): string {
  return plan.steps
    .map((step, index) => {
      const behaviors = Array.from(step)
        .map((b) => b.name)
        .join(', ');
      return `Step ${index}: ${behaviors}`;
    })
    .join('\n');
}

function makeDependersMap<TBehaviors extends Array<Behavior<any, any, any>>>(
  behaviors: TBehaviors,
): WeakMap<TBehaviors[number], TBehaviors[number][]> {
  const dependersMap = new WeakMap<
    Behavior<EntityLike, EntityLike, Record<string, unknown>>,
    Behavior<EntityLike, EntityLike, Record<string, unknown>>[]
  >();

  for (const behavior of behaviors) {
    for (const dep of behavior.deps) {
      let dependers = dependersMap.get(dep);
      if (!dependers) {
        dependers = [];
        dependersMap.set(dep, dependers);
      }
      dependers.push(behavior);
    }
  }
  return dependersMap;
}
