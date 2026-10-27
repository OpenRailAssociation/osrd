import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react';

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

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
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
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, deps);

  return state;
}

/**
 * This hook helps to manipulate asynchronous memoized values, without having to rewrite every time the same boilerplate
 * code to handle loading state and errors.
 * Unlike to `useAsyncMemo`, this hook also provides a refresh function to manually re-execute the asynchronous function.
 */
export function useRefreshableAsyncMemo<T>(
  fn: (controller: AbortController) => Promise<T>,
  deps: DependencyList
): { refresh: () => void; data: AsyncMemoState<T> } {
  const [state, setState] = useState<AsyncMemoState<T>>({ type: 'loading' });
  const activeController = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async () => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      setState((currentState) => ({
        type: 'loading',
        previousData: getAsyncMemoData(currentState),
      }));
      try {
        const data = await fn(controller);
        if (!controller.signal.aborted) setState({ type: 'ready', data });
      } catch (e) {
        if (!controller.signal.aborted) setState({ type: 'error', error: e as Error });
      }
    },
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    deps
  );

  useEffect(() => {
    refresh();
    return () => {
      activeController.current?.abort();
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, deps);

  return { data: state, refresh };
}
