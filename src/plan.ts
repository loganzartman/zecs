import type { EntityLike } from '../dist';
import type { Behavior } from './behavior';
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

    const parentMap = makeParentMap(behaviors);
    const leaves = behaviors.filter((b) => b.deps.length === 0);

    const queue = leaves.map((behavior) => ({ behavior, step: 0 }));

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) throw new Error('Unexpected empty queue');
      const { behavior, step } = next;

      const stepBehaviors = this.steps[step] ?? new Set();
      this.steps[step] = stepBehaviors;
      stepBehaviors.add(behavior);

      for (const parent of parentMap.get(behavior) ?? []) {
        queue.push({ behavior: parent, step: step + 1 });
      }
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

  update2(ecs: ECS<TInput>, params: CombinedParams<TBehaviors>): void {
    for (const step of this.steps) {
      for (const behavior of step) {
        const observer = this.#observers.get(behavior);
        if (!observer) throw new Error('Observer not found for behavior');
        observer.startUpdate(params);
      }
      for (const entity of Object.values(ecs.entities)) {
        for (const behavior of step) {
          if (behavior.query.match(entity)) {
            const observer = this.#observers.get(behavior);
            if (!observer) throw new Error('Observer not found for behavior');
            observer.updateEntity(entity);
          }
        }
      }
      for (const behavior of step) {
        const observer = this.#observers.get(behavior);
        if (!observer) throw new Error('Observer not found for behavior');
        observer.finishUpdate();
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

function makeParentMap<TBehaviors extends Array<Behavior<any, any, any>>>(
  behaviors: TBehaviors,
): WeakMap<TBehaviors[number], TBehaviors[number][]> {
  const parentMap = new WeakMap<
    Behavior<EntityLike, EntityLike, Record<string, unknown>>,
    Behavior<EntityLike, EntityLike, Record<string, unknown>>[]
  >();

  for (const behavior of behaviors) {
    for (const dep of behavior.deps) {
      let parents = parentMap.get(dep);
      if (!parents) {
        parents = [];
        parentMap.set(dep, parents);
      }
      parents.push(behavior);
    }
  }
  return parentMap;
}
