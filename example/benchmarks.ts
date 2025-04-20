import { makeExample } from './exampleSystem';
import { bench, run } from 'mitata';

bench('update', function* () {
  const { plan, ecs } = makeExample();

  yield () => plan.update(ecs, { g: 9.8, dt: 0.016 });
});

bench('update2', function* () {
  const { plan, ecs } = makeExample();

  yield () => plan.update2(ecs, { g: 9.8, dt: 0.016 });
});

await run();
