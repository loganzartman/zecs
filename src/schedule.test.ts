import { z } from 'zod';
import { component } from './component';
import { ecs } from './ecs';
import { query } from './query';
import { formatSchedule, schedule } from './schedule';
import { system } from './system';

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
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position, velocity),
      params: z.object({ dt: z.number() }),
      deps: [systemA],
      onUpdated: jest.fn(),
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      deps: [systemB],
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position, velocity]);
    const gameSchedule = await schedule(
      [systemA, systemB, systemC],
      ecsInstance,
      {},
    );

    expect(gameSchedule.steps.length).toBe(3);
    expect(Array.from(gameSchedule.steps[0])[0]).toBe(systemA);
    expect(Array.from(gameSchedule.steps[1])[0]).toBe(systemB);
    expect(Array.from(gameSchedule.steps[2])[0]).toBe(systemC);
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
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(velocity),
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position, velocity),
      params: z.object({ dt: z.number() }),
      deps: [systemA, systemB],
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position, velocity]);
    const gameSchedule = await schedule(
      [systemA, systemB, systemC],
      ecsInstance,
      {},
    );

    expect(gameSchedule.steps.length).toBe(2);
    expect(gameSchedule.steps[0].size).toBe(2); // systemA and systemB in same step
    expect(gameSchedule.steps[1].size).toBe(1); // only systemC in second step
    expect(gameSchedule.steps[0].has(systemA)).toBe(true);
    expect(gameSchedule.steps[0].has(systemB)).toBe(true);
    expect(gameSchedule.steps[1].has(systemC)).toBe(true);
  });

  it('executes systems in dependency order', async () => {
    const position = component('position', z.number());

    const executionOrder: string[] = [];

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      onUpdated: () => {
        executionOrder.push('systemA');
      },
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      deps: [systemA],
      onUpdated: () => {
        executionOrder.push('systemB');
      },
    });

    const systemC = system({
      name: 'systemC',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      deps: [systemB],
      onUpdated: () => {
        executionOrder.push('systemC');
      },
    });

    const ecsInstance = ecs([position]);
    ecsInstance.add({ position: 1 });

    const gameSchedule = await schedule(
      [systemC, systemA, systemB],
      ecsInstance,
      {},
    );
    gameSchedule.update({ dt: 0.1 });

    expect(executionOrder).toEqual(['systemA', 'systemB', 'systemC']);
  });

  it('initializes shared resources for each system', async () => {
    const position = component('position', z.number());

    const initSharedA = jest.fn();
    const initSharedB = jest.fn();

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      shared: {
        initParams: z.object({ scale: z.number() }),
        create: async ({ initParams }) => {
          initSharedA(initParams);
          return { scale: initParams.scale };
        },
      },
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      shared: {
        initParams: z.object({ length: z.number() }),
        create: async ({ initParams }) => {
          initSharedB(initParams);
          return { length: initParams.length };
        },
      },
    });

    const ecsInstance = ecs([position]);

    await schedule([systemA, systemB], ecsInstance, {
      scale: 2,
      length: 5,
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
      params: z.object({
        dt: z.number(),
        multiplier: z.number(),
      }),
      onUpdated: updateFnA,
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      params: z.object({
        dt: z.number(),
        multiplier: z.number(),
      }),
      onUpdated: updateFnB,
    });

    const ecsInstance = ecs([position]);
    ecsInstance.add({ position: 1 });

    const gameSchedule = await schedule([systemA, systemB], ecsInstance, {});

    const params = { dt: 0.1, multiplier: 2 };
    gameSchedule.update(params);

    expect(updateFnA).toHaveBeenCalledWith(
      expect.objectContaining({
        params,
      }),
    );

    expect(updateFnB).toHaveBeenCalledWith(
      expect.objectContaining({
        params,
      }),
    );
  });

  it('properly cleans up all system handles', async () => {
    const position = component('position', z.number());

    const stopA = jest.fn();
    const stopB = jest.fn();

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position]);

    // Mock implementation to test cleanup
    jest.spyOn(systemA, 'observe').mockImplementation(async () => ({
      ecs: ecsInstance,
      observer: {} as any,
      update: jest.fn(),
      stop: stopA,
    }));

    jest.spyOn(systemB, 'observe').mockImplementation(async () => ({
      ecs: ecsInstance,
      observer: {} as any,
      update: jest.fn(),
      stop: stopB,
    }));

    const gameSchedule = await schedule([systemA, systemB], ecsInstance, {});
    await gameSchedule.stop();

    expect(stopA).toHaveBeenCalled();
    expect(stopB).toHaveBeenCalled();
  });

  it('throws error for circular dependencies', async () => {
    const position = component('position', z.number());

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      deps: [systemA],
      onUpdated: jest.fn(),
    });

    // Create circular dependency: A → B → A
    (systemA as any).deps = [systemB];

    const ecsInstance = ecs([position]);

    await expect(schedule([systemA, systemB], ecsInstance, {})).rejects.toThrow(
      'Invalid dependency graph',
    );
  });

  it('formats a schedule into a readable string', async () => {
    const position = component('position', z.number());

    const systemA = system({
      name: 'systemA',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      onUpdated: jest.fn(),
    });

    const systemB = system({
      name: 'systemB',
      query: query().has(position),
      params: z.object({ dt: z.number() }),
      deps: [systemA],
      onUpdated: jest.fn(),
    });

    const ecsInstance = ecs([position]);
    const gameSchedule = await schedule([systemA, systemB], ecsInstance, {});

    const formatted = formatSchedule(gameSchedule);
    expect(formatted).toBe('Step 0: systemA\nStep 1: systemB');
  });
});
