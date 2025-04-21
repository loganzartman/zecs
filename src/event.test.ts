import { z } from 'zod';
import { event } from './event';

describe('events', () => {
  it('can subscribe to events', () => {
    const scoreEvent = event(
      'score',
      z.tuple([z.object({ points: z.number() })]),
    );
    scoreEvent.on((params) => {
      expect(params.points).toBe(10);
    });
    scoreEvent.emit({ points: 10 });
  });

  it('can unsubscribe from events', () => {
    const scoreEvent = event(
      'score',
      z.tuple([z.object({ points: z.number() })]),
    );
    const off = scoreEvent.on((params) => {
      expect(params.points).toBe(10);
    });
    off();
    scoreEvent.emit({ points: 10 });
  });

  it('can subscribe to events once', () => {
    const scoreEvent = event(
      'score',
      z.tuple([z.object({ points: z.number() })]),
    );
    scoreEvent.once((params) => {
      expect(params.points).toBe(10);
      expect(params.points).not.toBe(20);
    });
    scoreEvent.emit({ points: 10 });
    scoreEvent.emit({ points: 20 });
  });

  it('can have multiple listeners', () => {
    const scoreEvent = event(
      'score',
      z.tuple([z.object({ points: z.number() })]),
    );
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    scoreEvent.on(listener1);
    scoreEvent.on(listener2);
    scoreEvent.emit({ points: 10 });
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});
