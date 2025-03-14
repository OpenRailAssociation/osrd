import { type DependencyList, useEffect, useState } from 'react';

export type AsyncMemoState<T> =
  | { type: 'loading'; previousData?: T }
  | { type: 'error'; error?: Error }
  | { type: 'ready'; data: T };

/**
 * This function helps to retrieve the data in an AsyncMemoState. It's truly just sugar.
 */
export function getAsyncMemoData<T>(state: AsyncMemoState<T>): T | undefined {
  if (state.type === 'ready') return state.data;
  if (state.type === 'loading') return state.previousData;
  return undefined;
}

/**
 * This hook helps to manipulate asynchronous memoized values, without having to rewrite every time the same boilerplate
 * code to handle loading state and errors.
 */
export function useAsyncMemo<T>(fn: () => Promise<T>, deps: DependencyList): AsyncMemoState<T> {
  const [state, setState] = useState<AsyncMemoState<T>>({ type: 'loading' });

  useEffect(() => {
    let aborted = false;
    setState({ type: 'loading', previousData: getAsyncMemoData(state) });
    fn()
      .then((data) => {
        if (!aborted) setState({ type: 'ready', data });
      })
      .catch((error) => {
        if (!aborted) setState({ type: 'error', error });
      });

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
