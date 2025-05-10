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
      params: z.object({ dt: z.number() }),
      onUpdated: ({ entity, params }) => {
        const { position, velocity } = entity;
        position.x += velocity.x * params.dt;
        position.y += velocity.y * params.dt;
      },
    });

    const e = ecs([position, velocity]);
    const entity = e.entity({
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 2 },
    });
    e.add(entity);

    const handle = await attachSystem(movementSystem, e, {});

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

    const updateFn = jest.fn(({ entity, params }) => {
      const { position, velocity } = entity;
      position.x += velocity.x * params.dt;
      position.y += velocity.y * params.dt;
    });

    const movementSystem = system({
      name: 'movement',
      query: query()
        .has(position, velocity)
        .where((entity) => !('staticFlag' in entity)),
      params: z.object({ dt: z.number() }),
      onUpdated: updateFn,
    });

    const e = ecs([position, velocity, staticFlag]);

    const movingEntity = e.entity({
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 2 },
    });

    const staticEntity = e.entity({
      position: { x: 5, y: 5 },
      velocity: { x: 1, y: 1 },
      staticFlag: true,
    });

    e.add(movingEntity);
    e.add(staticEntity);

    const handle = await attachSystem(movementSystem, e, {});

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
      params: z.object({ value: z.number() }),
      onPreUpdate: ({ params }) => {
        callOrder.push(`preUpdate: ${params.value}`);
      },
      onUpdated: ({ entity, params }) => {
        callOrder.push(
          `updated: ${params.value} at ${entity.position.x},${entity.position.y}`,
        );
      },
      onPostUpdate: ({ params }) => {
        callOrder.push(`postUpdate: ${params.value}`);
      },
    });

    const e = ecs([position]);
    e.add(e.entity({ position: { x: 1, y: 2 } }));
    e.add(e.entity({ position: { x: 3, y: 4 } }));

    const handle = await attachSystem(testSystem, e, {});

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
      params: z.object({ increment: z.number() }),
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
      onUpdated: ({ entity, params, shared }) => {
        entity.counter += params.increment;
        shared.total += params.increment;
      },
    });

    const e = ecs([counter]);
    const entity1 = e.entity({ counter: 0 });
    const entity2 = e.entity({ counter: 0 });
    e.add(entity1);
    e.add(entity2);

    const handle = await attachSystem(counterSystem, e, { initialTotal: 100 });

    handle.update({ increment: 5 });
    handle.update({ increment: 10 });

    expect(entity1.counter).toBe(15); // 5 + 10
    expect(entity2.counter).toBe(15); // 5 + 10

    await handle.stop();
    expect(destroy).toHaveBeenCalled();
  });

  it('creates and manages derived resources for entities', async () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const velocity = component(
      'velocity',
      z.object({ x: z.number(), y: z.number() }),
    );

    const createDerived = jest.fn(({ entity }) => ({
      originalPosition: { ...entity.position },
      lastPosition: { ...entity.position },
      distanceTraveled: 0,
    }));

    const destroyDerived = jest.fn();

    const trackingSystem = system({
      name: 'tracking',
      query: query().has(position, velocity),
      params: z.object({ dt: z.number() }),
      shared: {
        create: () => ({ updates: 0 }),
        destroy: () => {},
      },
      derived: {
        create: createDerived,
        destroy: destroyDerived,
      },
      onUpdated: ({ entity, params, derived }) => {
        entity.position.x += entity.velocity.x * params.dt;
        entity.position.y += entity.velocity.y * params.dt;

        const dx = entity.position.x - derived.lastPosition.x;
        const dy = entity.position.y - derived.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        derived.distanceTraveled += distance;
        derived.lastPosition = { ...entity.position };
      },
    });

    const e = ecs([position, velocity]);
    const entity = e.entity({
      position: { x: 0, y: 0 },
      velocity: { x: 3, y: 4 }, // 3-4-5 triangle for easy calculation
    });
    const id = e.add(entity);

    const handle = await attachSystem(trackingSystem, e, {});

    handle.update({ dt: 1 });
    handle.update({ dt: 1 });

    expect(createDerived).toHaveBeenCalledTimes(1);
    expect(entity.position).toEqual({ x: 6, y: 8 });

    e.remove(id);
    handle.update({ dt: 1 });

    expect(destroyDerived).toHaveBeenCalledTimes(1);

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
      params: z.object({}),
      derived: {
        create,
        destroy,
      },
      onUpdated,
    });

    const e = ecs([position, active]);
    const handle = await attachSystem(activeSystem, e, {});

    const entity = e.entity({
      position: { x: 0, y: 0 },
      active: true,
    });
    const id = e.add(entity);

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

    e.remove(id);
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
      params: z.object({
        required: z.string(),
        optional: z.number().optional(),
      }),
      onUpdated: updateFn,
    });

    const e = ecs([test]);
    e.add(e.entity({ test: true }));

    const handle = await attachSystem(testSystem, e, {});

    handle.update({ required: 'value' });
    handle.update({ required: 'value', optional: 42 });

    expect(updateFn).toHaveBeenCalledTimes(2);

    await handle.stop();
  });
});
