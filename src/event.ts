import type { ZodTypeAny, z } from 'zod';

declare const eventNameSymbol: unique symbol;

type Off = () => void;

export type Listener<TName extends string, TParams extends ZodTypeAny> = {
  [eventNameSymbol]?: TName;
} & ((params: z.infer<TParams>) => void);

export type ListenerEventType<TListener extends Listener<string, ZodTypeAny>> =
  TListener extends Listener<infer TName, infer TParams>
    ? EventType<TName, TParams>
    : never;

export class EventType<TName extends string, TParams extends ZodTypeAny> {
  name: TName;
  params: TParams;
  #listeners = new Set<Listener<TName, TParams>>();

  constructor(name: TName, params: TParams) {
    this.name = name;
    this.params = params;
  }

  on(listener: Listener<TName, TParams>): Off {
    this.#listeners.add(listener);
    return () => this.off(listener);
  }

  off(listener: Listener<TName, TParams>): void {
    this.#listeners.delete(listener);
  }

  once(listener: Listener<TName, TParams>): Off {
    const off = this.on((params) => {
      off();
      listener(params);
    });
    return off;
  }

  emit(params: z.infer<TParams>) {
    for (const listener of this.#listeners) {
      listener(params);
    }
  }
}

export function event<TName extends string, TParams extends ZodTypeAny>(
  name: TName,
  params: TParams,
): EventType<TName, TParams> {
  return new EventType(name, params);
}
