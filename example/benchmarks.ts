import { bench, run } from 'mitata';
import { makeExample } from './exampleSystem';

bench('update', async function* (state: any) {
  const { update } = await makeExample({ n: state.get('n') });

  yield () => update({ dt: 0.016 });
}).range('n', 10, 10000);

await run();
