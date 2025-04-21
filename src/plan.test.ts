import { z } from 'zod';
import { behavior } from './behavior';
import { ecs } from './ecs';
import { formatPlan, plan } from './plan';
import { query } from './query';

describe('behavior', () => {
  it('groups and orders steps by dependencies for a tree', () => {
    const D = behavior({ query: query(), deps: [], params: z.object({}) });
    const E = behavior({ query: query(), deps: [], params: z.object({}) });
    const C = behavior({ query: query(), deps: [D, E], params: z.object({}) });
    const A = behavior({ query: query(), deps: [C], params: z.object({}) });
    const B = behavior({ query: query(), deps: [C], params: z.object({}) });

    const myPlan = plan([A, B, C, D, E]);
    expect(myPlan.steps).toMatchObject([
      new Set([D, E]),
      new Set([C]),
      new Set([A, B]),
    ]);
  });

  it('groups and orders steps with redundant dependencies', () => {
    const A = behavior({
      name: 'A',
      query: query(),
      deps: [],
      params: z.object({}),
    });
    const B = behavior({
      name: 'B',
      query: query(),
      deps: [A],
      params: z.object({}),
    });
    const C = behavior({
      name: 'C',
      query: query(),
      deps: [A, B],
      params: z.object({}),
    });

    const myPlan = plan([A, B, C]);
    console.log(formatPlan(myPlan));
    expect(myPlan.steps).toMatchObject([
      new Set([A]),
      new Set([B]),
      new Set([C]),
    ]);
  });

  it('collects parameters from all behaviors', () => {
    const aUpdated = jest.fn();
    const bUpdated = jest.fn();
    const cUpdated = jest.fn();

    const A = behavior({
      query: query(),
      deps: [],
      params: z.object({ a: z.string() }),
      on: {
        updated: aUpdated,
      },
    });

    const B = behavior({
      query: query(),
      deps: [A],
      params: z.object({ b: z.number() }),
      on: {
        updated: bUpdated,
      },
    });

    const C = behavior({
      query: query(),
      deps: [B],
      params: z.object({ c: z.boolean() }),
      on: {
        updated: cUpdated,
      },
    });

    const myEcs = ecs([]);
    myEcs.add({});

    const myPlan = plan([A, B, C]);
    myPlan.update(myEcs, { a: 'test', b: 42, c: true });

    expect(aUpdated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ a: 'test' }),
    );
    expect(bUpdated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        b: 42,
      }),
    );
    expect(cUpdated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        c: true,
      }),
    );
  });
});
