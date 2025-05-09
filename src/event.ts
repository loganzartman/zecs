import type { ZodType } from 'zod';

declare const eventNameSymbol: unique symbol;

type Off = () => void;

export type Listener<TName extends string, TParams extends any[]> = {
  [eventNameSymbol]?: TName;
} & ((...params: TParams) => void);

export type ListenerEventType<TListener extends Listener<string, any[]>> =
  TListener extends Listener<infer TName, infer TParams>
    ? EventType<TName, TParams>
    : never;

export type EventListenerType<TEventType extends EventType<string, any[]>> =
  TEventType extends EventType<infer TName, infer TParams>
    ? Listener<TName, TParams>
    : never;

export class EventType<TName extends string, TParams extends any[]> {
  name: TName;
  params: ZodType<TParams>;
  #listeners = new Set<Listener<TName, TParams>>();

  constructor(name: TName, params: ZodType<TParams>) {
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

  offAll(): void {
    this.#listeners.clear();
  }

  once(listener: Listener<TName, TParams>): Off {
    const off = this.on((...params) => {
      off();
      listener(...params);
    });
    return off;
  }

  emit(...params: TParams): void {
    for (const listener of this.#listeners) {
      listener(...params);
    }
  }
}

export function event<TName extends string, TParams extends any[]>(
  name: TName,
  params: ZodType<TParams>,
): EventType<TName, TParams> {
  return new EventType(name, params);
}
