'use client';

import { useEffect, useState } from 'react';

/**
 * Trails `value` by `delay`, resetting the timer on every change.
 *
 * The two callers use different delays on purpose. Search is 250ms — the user is
 * scanning results and wants them to keep up. Duplicate detection is 400ms —
 * the admin is composing a title, and a warning that appears mid-word is noise.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
