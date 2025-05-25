import { z } from 'zod';
import { component } from './component';
import { ecs } from './ecs';
import { query } from './query';
import { attachSystem, system } from './system';

describe('system', () => {
  it('creates a basic system that processes entities', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const velocity = component(
      'velocity',
      z.object({ x: z.number(), y: z.number() }),
    );

    const movementSystem = system({
      name: 'movement',
      query: query().has(position, velocity),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: ({ entity, updateParams: { dt } }) => {
        const { position, velocity } = entity;
        position.x += velocity.x * dt;
        position.y += velocity.y * dt;
      },
    });

    const e = ecs([position, velocity]);
    const entity = e.add({
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 2 },
    });

    const handle = await attachSystem(e, movementSystem, {});

    handle.update({ dt: 0.1 });

    expect(entity.position).toEqual({ x: 0.1, y: 0.2 });

    await handle.stop();
  });

  it('only processes entities matching the query', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const velocity = component(
      'velocity',
      z.object({ x: z.number(), y: z.number() }),
    );
    const staticFlag = component('staticFlag', z.boolean());

    const updateFn = jest.fn(({ entity, updateParams: { dt } }) => {
      const { position, velocity } = entity;
      position.x += velocity.x * dt;
      position.y += velocity.y * dt;
    });

    const movementSystem = system({
      name: 'movement',
      query: query()
        .has(position, velocity)
        .where((entity) => !('staticFlag' in entity)),
      updateParams: z.object({ dt: z.number() }),
      onUpdated: updateFn,
    });

    const e = ecs([position, velocity, staticFlag]);

    const movingEntity = e.add({
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 2 },
    });

    const staticEntity = e.add({
      position: { x: 5, y: 5 },
      velocity: { x: 1, y: 1 },
      staticFlag: true,
    });

    const handle = await attachSystem(e, movementSystem, {});

    handle.update({ dt: 0.1 });

    expect(movingEntity.position).toEqual({ x: 0.1, y: 0.2 });
    expect(staticEntity.position).toEqual({ x: 5, y: 5 });
    expect(updateFn).toHaveBeenCalledTimes(1);

    await handle.stop();
  });

  it('calls lifecycle hooks in the correct order', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );

    const callOrder: string[] = [];

    const testSystem = system({
      name: 'test',
      query: query().has(position),
      updateParams: z.object({ value: z.number() }),
      onPreUpdate: ({ updateParams }) => {
        callOrder.push(`preUpdate: ${updateParams.value}`);
      },
      onUpdated: ({ entity, updateParams }) => {
        callOrder.push(
          `updated: ${updateParams.value} at ${entity.position.x},${entity.position.y}`,
        );
      },
      onPostUpdate: ({ updateParams }) => {
        callOrder.push(`postUpdate: ${updateParams.value}`);
      },
    });

    const e = ecs([position]);
    e.add({ position: { x: 1, y: 2 } });
    e.add({ position: { x: 3, y: 4 } });

    const handle = await attachSystem(e, testSystem, {});

    handle.update({ value: 42 });

    expect(callOrder).toEqual([
      'preUpdate: 42',
      // The order of entity updates is not guaranteed
      expect.stringContaining('updated: 42 at'),
      expect.stringContaining('updated: 42 at'),
      'postUpdate: 42',
    ]);

    await handle.stop();
  });

  it('handles shared resources', async () => {
    const counter = component('counter', z.number());

    const destroy = jest.fn();

    const counterSystem = system({
      name: 'counter',
      query: query().has(counter),
      initParams: z.object({ initialTotal: z.number() }),
      updateParams: z.object({ increment: z.number() }),
      shared: {
        create: ({ initParams }) => ({
          total: initParams.initialTotal,
          updates: 0,
        }),
        destroy,
      },
      onPreUpdate: ({ shared }) => {
        shared.updates++;
      },
      onUpdated: ({ entity, updateParams, shared }) => {
        entity.counter += updateParams.increment;
        shared.total += updateParams.increment;
      },
    });

    const e = ecs([counter]);
    const entity1 = e.add({ counter: 0 });
    const entity2 = e.add({ counter: 0 });

    const handle = await attachSystem(e, counterSystem, { initialTotal: 100 });

    handle.update({ increment: 5 });
    handle.update({ increment: 10 });

    expect(entity1.counter).toBe(15); // 5 + 10
    expect(entity2.counter).toBe(15); // 5 + 10

    await handle.stop();
    expect(destroy).toHaveBeenCalled();
  });

  it('creates and manages each resources for entities', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const velocity = component(
      'velocity',
      z.object({ x: z.number(), y: z.number() }),
    );

    const createEach = jest.fn(({ entity }) => ({
      originalPosition: { ...entity.position },
      lastPosition: { ...entity.position },
      distanceTraveled: 0,
    }));

    const destroyEach = jest.fn();

    const trackingSystem = system({
      name: 'tracking',
      query: query().has(position, velocity),
      updateParams: z.object({ dt: z.number() }),
      shared: {
        create: () => ({ updates: 0 }),
        destroy: () => {},
      },
      each: {
        create: createEach,
        destroy: destroyEach,
      },
      onUpdated: ({ entity, updateParams: { dt }, each }) => {
        entity.position.x += entity.velocity.x * dt;
        entity.position.y += entity.velocity.y * dt;

        const dx = entity.position.x - each.lastPosition.x;
        const dy = entity.position.y - each.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        each.distanceTraveled += distance;
        each.lastPosition = { ...entity.position };
      },
    });

    const e = ecs([position, velocity]);
    const entity = e.add({
      position: { x: 0, y: 0 },
      velocity: { x: 3, y: 4 }, // 3-4-5 triangle for easy calculation
    });

    const handle = await attachSystem(e, trackingSystem, {});

    handle.update({ dt: 1 });
    handle.update({ dt: 1 });

    expect(createEach).toHaveBeenCalledTimes(1);
    expect(entity.position).toEqual({ x: 6, y: 8 });

    e.remove(entity);
    handle.update({ dt: 1 });

    expect(destroyEach).toHaveBeenCalledTimes(1);

    await handle.stop();
  });

  it('handles dynamic entity matching/unmatching', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const active = component('active', z.boolean());

    const create = jest.fn();
    const destroy = jest.fn();
    const onUpdated = jest.fn();

    const activeSystem = system({
      name: 'active',
      query: query()
        .has(position, active)
        .where(({ active }) => active === true),
      each: {
        create,
        destroy,
      },
      onUpdated,
    });

    const e = ecs([position, active]);
    const handle = await attachSystem(e, activeSystem, {});

    const entity = e.add({
      position: { x: 0, y: 0 },
      active: true,
    });

    handle.update({});
    expect(create).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledTimes(1);

    entity.active = false;
    handle.update({});
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledTimes(1);

    entity.active = true;
    handle.update({});
    expect(create).toHaveBeenCalledTimes(2);
    expect(onUpdated).toHaveBeenCalledTimes(2);

    e.remove(entity);
    handle.update({});
    expect(destroy).toHaveBeenCalledTimes(2);

    await handle.stop();
  });

  it('accepts valid parameters', async () => {
    const test = component('test', z.boolean());

    const updateFn = jest.fn();

    const testSystem = system({
      name: 'test',
      query: query().has(test),
      updateParams: z.object({
        required: z.string(),
        optional: z.number().optional(),
      }),
      onUpdated: updateFn,
    });

    const e = ecs([test]);
    e.add({ test: true });

    const handle = await attachSystem(e, testSystem, {});

    handle.update({ required: 'value' });
    handle.update({ required: 'value', optional: 42 });

    expect(updateFn).toHaveBeenCalledTimes(2);

    await handle.stop();
  });
});
