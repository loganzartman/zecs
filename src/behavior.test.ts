import { z } from 'zod';
import { behavior } from './behavior';
import { ecs } from './ecs';
import { query } from './query';

describe('behavior', () => {
  it('attaches initial listeners', () => {
    const updated = jest.fn();
    const b = behavior({
      query: query(),
      deps: [],
      params: z.object({}),
      on: {
        updated,
      },
    });

    const ecsInstance = ecs([]);
    ecsInstance.add({});

    const observer = b.observe();
    observer.update(ecsInstance, {});

    expect(updated).toHaveBeenCalled();
  });

  it('supports initial listener thunk', () => {
    const updated = jest.fn();
    const b = behavior({
      query: query(),
      deps: [],
      params: z.object({}),
      on: () => ({
        updated,
      }),
    });

    const ecsInstance = ecs([]);
    ecsInstance.add({});

    const observer = b.observe();
    observer.update(ecsInstance, {});

    expect(updated).toHaveBeenCalled();
  });
});
