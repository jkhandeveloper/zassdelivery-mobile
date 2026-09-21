"use client";

import { useSyncExternalStore } from "react";

/** Never changes, so React never re-subscribes. */
const noopSubscribe = () => () => {};

/**
 * True once the client has hydrated, false during SSR and the first render.
 *
 * The usual `useState(false)` + `useEffect(() => setMounted(true))` does the
 * same job with an extra render pass; a store whose server snapshot differs
 * from its client snapshot is exactly what `useSyncExternalStore` is for.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
