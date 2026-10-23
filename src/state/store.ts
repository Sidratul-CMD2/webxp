import { useCallback, useRef, useSyncExternalStore } from 'react';

export interface Store<S> {
  get(): S;
  set(updater: (state: S) => S): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(updater) {
      const next = updater(state);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Subscribes to a derived slice. Selectors may build new arrays/objects; the
 * previous value is reused while it stays shallowly equal, so components only
 * re-render when their slice really changes.
 */
export function useStoreSelector<S, T>(store: Store<S>, selector: (state: S) => T): T {
  const cache = useRef<{ state: S; selector: (state: S) => T; value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const state = store.get();
    const prev = cache.current;
    if (prev && prev.state === state && prev.selector === selector) return prev.value;
    const value = selector(state);
    if (prev && shallowEqual(prev.value, value)) {
      cache.current = { state, selector, value: prev.value };
      return prev.value;
    }
    cache.current = { state, selector, value };
    return value;
  }, [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
