import { bench, run } from 'mitata';
import { makeExample } from './exampleSystem';

bench('update', async function* (state: any) {
  const { schedule } = await makeExample({ n: state.get('n') });

  yield () => schedule.update({ g: 9.8, dt: 0.016 });
}).range('n', 10, 10000);

await run();
