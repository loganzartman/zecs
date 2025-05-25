import { z } from 'zod/v4';
import { component } from './component';
import { ecs } from './ecs';
import { query } from './query';
import { formatSchedule, scheduleSystems } from './schedule';
import { system } from './system';

describe('schedule', () => {
  it('creates a schedule based on the given ordering', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const velocity = component(
      'velocity',
      z.object({ x: z.number(), y: z.number() }),
    );

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position, velocity),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position, velocity]);
    const schedule = await scheduleSystems(
      ecsInstance,
      [systemA, systemB, systemC],
      {},
    );

    expect(schedule.steps.length).toBe(3);
    expect(schedule.steps[0][0]).toBe(systemA);
    expect(schedule.steps[1][0]).toBe(systemB);
    expect(schedule.steps[2][0]).toBe(systemC);
  });

  it('creates a schedule with multiple systems per step', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const velocity = component(
      'velocity',
      z.object({ x: z.number(), y: z.number() }),
    );

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(velocity),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position, velocity),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position, velocity]);
    const schedule = await scheduleSystems(
      ecsInstance,
      [[systemA, systemB], systemC],
      {},
    );

    expect(schedule.steps.length).toBe(2);
    expect(schedule.steps[0].length).toBe(2); // systemA and systemB in same step
    expect(schedule.steps[1].length).toBe(1); // only systemC in second step
    expect(schedule.steps[0]).toContain(systemA);
    expect(schedule.steps[0]).toContain(systemB);
    expect(schedule.steps[1]).toContain(systemC);
  });

  it('executes systems in order', async () => {
    const position = component('position', z.number());

    const executionOrder: string[] = [];

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: () => {
        executionOrder.push('systemA');
      },
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: () => {
        executionOrder.push('systemB');
      },
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: () => {
        executionOrder.push('systemC');
      },
    });

    const ecsInstance = ecs([position]);
    ecsInstance.add({ position: 1 });

    const schedule = await scheduleSystems(
      ecsInstance,
      [systemA, [systemB, systemC]],
      {},
    );
    schedule.update({ dt: 0.1 });

    // ordering of B and C is undefined
    try {
      expect(executionOrder).toEqual(['systemA', 'systemB', 'systemC']);
    } catch {
      expect(executionOrder).toEqual(['systemA', 'systemC', 'systemB']);
    }
  });

  it('initializes shared resources for each system', async () => {
    const position = component('position', z.number());

    const initSharedA = jest.fn();
    const initSharedB = jest.fn();

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      initParams: z.object({ scale: z.number() }),
      updateParams: z.object({ dt: z.number() }),
      shared: {
        create: async ({ initParams }) => {
          initSharedA(initParams);
          return { scale: initParams.scale };
        },
      },
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      initParams: z.object({ length: z.number() }),
      updateParams: z.object({ dt: z.number() }),
      shared: {
        create: async ({ initParams }) => {
          initSharedB(initParams);
          return { length: initParams.length };
        },
      },
    });

    const ecsInstance = ecs([position]);

    await scheduleSystems(ecsInstance, [systemA, systemB], {
      length: 5,
      scale: 2,
    });

    expect(initSharedA).toHaveBeenCalledWith(
      expect.objectContaining({ scale: 2 }),
    );
    expect(initSharedB).toHaveBeenCalledWith(
      expect.objectContaining({ length: 5 }),
    );
  });

  it('uses shared parameters for all systems', async () => {
    const position = component('position', z.number());

    const updateFnA = jest.fn();
    const updateFnB = jest.fn();

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      updateParams: z.object({
        dt: z.number(),
        multiplier: z.number(),
      }),
      onUpdated: updateFnA,
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      updateParams: z.object({
        dt: z.number(),
        multiplier: z.number(),
      }),
      onUpdated: updateFnB,
    });

    const ecsInstance = ecs([position]);
    ecsInstance.add({ position: 1 });

    const schedule = await scheduleSystems(ecsInstance, [systemA, systemB], {});

    const updateParams = { dt: 0.1, multiplier: 2 };
    schedule.update(updateParams);

    expect(updateFnA).toHaveBeenCalledWith(
      expect.objectContaining({
        updateParams,
      }),
    );

    expect(updateFnB).toHaveBeenCalledWith(
      expect.objectContaining({
        updateParams,
      }),
    );
  });

  it('cleans up shared resources', async () => {
    const position = component('position', z.number());

    const destroyA = jest.fn();
    const destroyB = jest.fn();

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
      shared: {
        create: async () => ({ hello: 'world' }),
        destroy: destroyA,
      },
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
      shared: {
        create: async () => ({ hello: 'world' }),
        destroy: destroyB,
      },
    });

    const ecsInstance = ecs([position]);

    const schedule = await scheduleSystems(ecsInstance, [systemA, systemB], {});
    await schedule.stop();

    expect(destroyA).toHaveBeenCalled();
    expect(destroyB).toHaveBeenCalled();
  });

  it('formats a schedule into a readable string', async () => {
    const position = component('position', z.number());

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position]);
    const schedule = await scheduleSystems(ecsInstance, [systemA, systemB], {});

    const formatted = formatSchedule(schedule);
    expect(formatted).toBe('Step 0: systemA\nStep 1: systemB');
  });
});
