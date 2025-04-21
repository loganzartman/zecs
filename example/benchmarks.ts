import { bench, run } from 'mitata';
import { makeExample } from './exampleSystem';

bench('update', function* (state: any) {
  const { plan, ecs } = makeExample({ n: state.get('n') });

  yield () => plan.update(ecs, { g: 9.8, dt: 0.016 });
}).range('n', 10, 10000);

await run();
