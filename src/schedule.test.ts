import { z } from 'zod';
import { component } from './component';
import { ecs } from './ecs';
import { query } from './query';
import { formatSchedule, scheduleSystems } from './schedule';
import { type UnknownSystem, system } from './system';

describe('schedule', () => {
  it('creates a schedule based on system dependencies', async () => {
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
      deps: [systemA],
      onUpdated: jest.fn(),
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      deps: [systemB],
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position, velocity]);
    const schedule = await scheduleSystems(
      [systemA, systemB, systemC],
      ecsInstance,
      {},
    );

    expect(schedule.steps.length).toBe(3);
    expect(Array.from(schedule.steps[0])[0]).toBe(systemA);
    expect(Array.from(schedule.steps[1])[0]).toBe(systemB);
    expect(Array.from(schedule.steps[2])[0]).toBe(systemC);
  });

  it('creates a schedule with multiple systems per step when possible', async () => {
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
      deps: [systemA, systemB],
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position, velocity]);
    const schedule = await scheduleSystems(
      [systemA, systemB, systemC],
      ecsInstance,
      {},
    );

    expect(schedule.steps.length).toBe(2);
    expect(schedule.steps[0].size).toBe(2); // systemA and systemB in same step
    expect(schedule.steps[1].size).toBe(1); // only systemC in second step
    expect(schedule.steps[0].has(systemA as UnknownSystem)).toBe(true);
    expect(schedule.steps[0].has(systemB as UnknownSystem)).toBe(true);
    expect(schedule.steps[1].has(systemC as UnknownSystem)).toBe(true);
  });

  it('executes systems in dependency order', async () => {
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
      deps: [systemA],
      onUpdated: () => {
        executionOrder.push('systemB');
      },
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position),
      updateParams: z.object({ dt: z.number() }),
      deps: [systemB],
      onUpdated: () => {
        executionOrder.push('systemC');
      },
    });

    const ecsInstance = ecs([position]);
    ecsInstance.add({ position: 1 });

    const schedule = await scheduleSystems(
      [systemC, systemA, systemB],
      ecsInstance,
      {},
    );
    schedule.update({ dt: 0.1 });

    expect(executionOrder).toEqual(['systemA', 'systemB', 'systemC']);
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

    await scheduleSystems([systemA, systemB], ecsInstance, {
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

    const schedule = await scheduleSystems([systemA, systemB], ecsInstance, {});

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

    const schedule = await scheduleSystems([systemA, systemB], ecsInstance, {});
    await schedule.stop();

    expect(destroyA).toHaveBeenCalled();
    expect(destroyB).toHaveBeenCalled();
  });

  it('throws error for circular dependencies', async () => {
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
      deps: [systemA],
      onUpdated: jest.fn(),
    });

    // Create circular dependency: A → B → A
    systemA.deps = [systemB];

    const ecsInstance = ecs([position]);

    await expect(
      scheduleSystems([systemA, systemB], ecsInstance, {}),
    ).rejects.toThrow('Invalid dependency graph');
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
      deps: [systemA],
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position]);
    const schedule = await scheduleSystems([systemA, systemB], ecsInstance, {});

    const formatted = formatSchedule(schedule);
    expect(formatted).toBe('Step 0: systemA\nStep 1: systemB');
  });
});
