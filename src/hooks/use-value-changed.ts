"use client";

import * as React from "react";

/**
 * True for exactly the render where `value` differs from its previous render.
 *
 * For resetting derived state (a page number, a form's fields) when a filter
 * or a target record changes. React's own guidance for this is to adjust state
 * directly during render rather than in a `useEffect` — the effect version
 * costs an extra commit and is flagged by `react-hooks/set-state-in-effect`,
 * since a `setState` synchronously inside an effect is exactly the cascading
 * render the rule exists to catch.
 */
export function useValueChanged<T>(value: T): boolean {
  const [previous, setPrevious] = React.useState(value);

  if (!Object.is(previous, value)) {
    setPrevious(value);
    return true;
  }

  return false;
}
