import { z } from 'zod';
import { component } from './component';
import { ecs } from './ecs';
import { observe } from './observe';
import { query } from './query';

describe('observe', () => {
  it('emits events when entities match query', () => {
    const health = component('health', z.number());
    const q = query().has(health);
    const observer = observe(q);
    const e = ecs([health]);

    const enter = jest.fn();
    const update = jest.fn();
    const exit = jest.fn();

    observer.enter.on(enter);
    observer.update.on(update);
    observer.exit.on(exit);

    const entity = e.entity({ health: 10 });
    const id = e.add(entity);

    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledWith(entity);
    expect(update).toHaveBeenCalledWith(entity);
    expect(exit).not.toHaveBeenCalled();

    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(exit).not.toHaveBeenCalled();

    e.remove(id);
    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(exit).toHaveBeenCalledWith(entity);
  });

  it('handles multiple entities', () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const q = query().has(position);
    const observer = observe(q);
    const e = ecs([position]);

    const enter = jest.fn();
    const update = jest.fn();
    const exit = jest.fn();

    observer.enter.on(enter);
    observer.update.on(update);
    observer.exit.on(exit);

    const entity1 = e.entity({ position: { x: 0, y: 0 } });
    const entity2 = e.entity({ position: { x: 1, y: 1 } });
    e.add(entity1);
    e.add(entity2);

    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('tracks when entities stop matching query', () => {
    const health = component('health', z.number());
    const alive = query()
      .has(health)
      .where(({ health }) => health > 0);
    const observer = observe(alive);
    const e = ecs([health]);

    const enter = jest.fn();
    const update = jest.fn();
    const exit = jest.fn();

    observer.enter.on(enter);
    observer.update.on(update);
    observer.exit.on(exit);

    const entity = e.entity({ health: 1 });
    const id = e.add(entity);

    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledWith(entity);
    expect(update).toHaveBeenCalledWith(entity);
    expect(exit).not.toHaveBeenCalled();

    // Entity stops matching query
    e.entities[id].health = 0;
    observer.doUpdate(e);
    expect(exit).toHaveBeenCalledWith(entity);
    expect(update).toHaveBeenCalledTimes(1);

    // Entity matches again
    e.entities[id].health = 1;
    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('can unsubscribe from events', () => {
    const health = component('health', z.number());
    const q = query().has(health);
    const observer = observe(q);
    const e = ecs([health]);

    const enter = jest.fn();
    const update = jest.fn();
    const exit = jest.fn();

    const offEnter = observer.enter.on(enter);
    const offUpdate = observer.update.on(update);
    const offExit = observer.exit.on(exit);

    const entity = e.entity({ health: 10 });
    e.add(entity);

    observer.doUpdate(e);
    expect(enter).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();

    offEnter();
    offUpdate();
    offExit();

    observer.doUpdate(e);
    expect(enter).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
  });
});
