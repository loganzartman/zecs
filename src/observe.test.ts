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

    const matched = jest.fn();
    const updated = jest.fn();
    const unmatched = jest.fn();

    observer.matched.on(matched);
    observer.updated.on(updated);
    observer.unmatched.on(unmatched);

    const entity = e.entity({ health: 10 });
    const id = e.add(entity);

    observer.update(e);
    expect(matched).toHaveBeenCalledWith(entity);
    expect(updated).toHaveBeenCalledWith(entity);
    expect(unmatched).not.toHaveBeenCalled();

    observer.update(e);
    expect(matched).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(2);
    expect(unmatched).not.toHaveBeenCalled();

    e.remove(id);
    observer.update(e);
    expect(matched).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(2);
    expect(unmatched).toHaveBeenCalledWith(entity);
  });

  it('handles multiple entities', () => {
    const position = component(
      'position',
      z.object({ x: z.number(), y: z.number() }),
    );
    const q = query().has(position);
    const observer = observe(q);
    const e = ecs([position]);

    const matched = jest.fn();
    const updated = jest.fn();
    const unmatched = jest.fn();

    observer.matched.on(matched);
    observer.updated.on(updated);
    observer.unmatched.on(unmatched);

    const entity1 = e.entity({ position: { x: 0, y: 0 } });
    const entity2 = e.entity({ position: { x: 1, y: 1 } });
    e.add(entity1);
    e.add(entity2);

    observer.update(e);
    expect(matched).toHaveBeenCalledTimes(2);
    expect(updated).toHaveBeenCalledTimes(2);
  });

  it('tracks when entities stop matching query', () => {
    const health = component('health', z.number());
    const alive = query()
      .has(health)
      .where(({ health }) => health > 0);
    const observer = observe(alive);
    const e = ecs([health]);

    const matched = jest.fn();
    const updated = jest.fn();
    const unmatched = jest.fn();

    observer.matched.on(matched);
    observer.updated.on(updated);
    observer.unmatched.on(unmatched);

    const entity = e.entity({ health: 1 });
    const id = e.add(entity);

    observer.update(e);
    expect(matched).toHaveBeenCalledWith(entity);
    expect(updated).toHaveBeenCalledWith(entity);
    expect(unmatched).not.toHaveBeenCalled();

    // Entity stops matching query
    e.entities[id].health = 0;
    observer.update(e);
    expect(unmatched).toHaveBeenCalledWith(entity);
    expect(updated).toHaveBeenCalledTimes(1);

    // Entity matches again
    e.entities[id].health = 1;
    observer.update(e);
    expect(matched).toHaveBeenCalledTimes(2);
    expect(updated).toHaveBeenCalledTimes(2);
  });

  it('can unsubscribe from events', () => {
    const health = component('health', z.number());
    const q = query().has(health);
    const observer = observe(q);
    const e = ecs([health]);

    const matched = jest.fn();
    const updated = jest.fn();
    const unmatched = jest.fn();

    const offMatched = observer.matched.on(matched);
    const offUpdated = observer.updated.on(updated);
    const offUnmatched = observer.unmatched.on(unmatched);

    const entity = e.entity({ health: 10 });
    e.add(entity);

    observer.update(e);
    expect(matched).toHaveBeenCalled();
    expect(updated).toHaveBeenCalled();

    offMatched();
    offUpdated();
    offUnmatched();

    observer.update(e);
    expect(matched).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(1);
    expect(unmatched).not.toHaveBeenCalled();
  });

  it('emits preUpdate, updated, and postUpdate events', () => {
    const health = component('health', z.number());
    const q = query().has(health);
    const observer = observe(q);
    const e = ecs([health]);

    const event = jest.fn();

    observer.preUpdate.on(() => event('preUpdate'));
    observer.updated.on(() => event('updated'));
    observer.postUpdate.on(() => event('postUpdate'));

    e.add(e.entity({ health: 10 }));
    e.add(e.entity({ health: 20 }));

    observer.update(e);
    expect(event.mock.calls).toEqual([
      ['preUpdate'],
      ['updated'],
      ['updated'],
      ['postUpdate'],
    ]);
  });
});
