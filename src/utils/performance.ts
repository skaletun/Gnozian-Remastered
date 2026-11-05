// Performance optimization utilities

import { useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Debounce a function call
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

/**
 * Throttle a function call
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= delay) {
        callback(...args);
        lastRunRef.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRunRef.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Memoize expensive calculations
 */
export function useMemoCompare<T>(value: T, compare: (a: T, b: T) => boolean): T {
  const prevValueRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  return useMemo(() => {
    if (prevValueRef.current !== undefined && compare(value, prevValueRef.current)) {
      return prevValueRef.current;
    }
    return value;
  }, [value, compare]);
}

/**
 * Request idle callback polyfill
 */
export const requestIdleCallback = (callback: IdleRequestCallback, _options?: IdleRequestOptions) => {
  const start = Date.now();
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    } as IdleDeadline);
  }, 1);
};

/**
 * Batch multiple state updates
 */
export function batchUpdates<T>(updates: Array<() => T>): T[] {
  if ('unstable_batchedUpdates' in (window as any)) {
    const results: T[] = [];
    (window as any).unstable_batchedUpdates(() => {
      for (const update of updates) {
        results.push(update());
      }
    });
    return results;
  }
  return updates.map(update => update());
}

/**
 * Memoize object comparison
 */
export function shallowEqual<T extends Record<string, any>>(
  obj1: T,
  obj2: T
): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Deep clone with circular reference handling
 */
export function deepClone<T>(obj: T, seen = new WeakMap()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj)) {
    return seen.get(obj);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    const cloned: any[] = [];
    seen.set(obj, cloned);
    for (let i = 0; i < obj.length; i++) {
      cloned[i] = deepClone(obj[i], seen);
    }
    return cloned as T;
  }

  if (obj instanceof Object) {
    const cloned = Object.create(Object.getPrototypeOf(obj));
    seen.set(obj, cloned);
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone((obj as any)[key], seen);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Calculate distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Check if point is in rectangle
 */
export function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ease out quadratic
 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Ease in out quad
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
