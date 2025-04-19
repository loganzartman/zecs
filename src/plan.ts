import type { EntityLike } from '../dist';
import type { Behavior } from './behavior';
import type { ECS } from './ecs';

type CombinedParams<TBehaviors extends Array<Behavior<any, any, any>>> =
  TBehaviors extends [
    Behavior<any, any, infer TParams>,
    ...infer TRest extends Array<Behavior<any, any, any>>,
  ]
    ? TRest extends []
      ? TParams
      : TParams & CombinedParams<TRest>
    : never;

export type Plan<
  TEntity extends EntityLike,
  TBehaviors extends Array<Behavior<any, any, any>>,
> = {
  steps: Array<Set<TBehaviors[number]>>;
  update: (ecs: ECS<TEntity>, params: CombinedParams<TBehaviors>) => void;
};

export function plan<
  TInput extends EntityLike,
  TOutput extends TInput,
  const TBehaviors extends Array<Behavior<TInput, TOutput, any>>,
>(behaviors: TBehaviors): Plan<TInput, TBehaviors> {
  const parentMap = makeParentMap(behaviors);
  const leaves = behaviors.filter((b) => b.deps.length === 0);

  const queue = leaves.map((behavior) => ({ behavior, step: 0 }));
  const steps: Array<Set<TBehaviors[number]>> = [];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) throw new Error('Unexpected empty queue');
    const { behavior, step } = next;

    const stepBehaviors = steps[step] ?? new Set();
    steps[step] = stepBehaviors;
    stepBehaviors.add(behavior);

    for (const parent of parentMap.get(behavior) ?? []) {
      queue.push({ behavior: parent, step: step + 1 });
    }
  }

  return {
    steps,
    update(ecs, params) {
      for (const step of steps) {
        for (const entity of Object.values(ecs.entities)) {
          for (const behavior of step) {
            if (behavior.query.match(entity)) {
            }
          }
        }
      }
    },
  };
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
