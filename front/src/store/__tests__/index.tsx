import { renderHook, type RenderHookOptions, type RenderHookResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach } from 'vitest';

import type { RootState } from 'reducers';
import { createStore, createStoreWithoutMiddleware, type Store } from 'store';

// Create a fresh store before each test, so that tests don't inherit any state
// from previous tests (e.g. rtk-query's cache isn't polluted with a previous
// test's mock data). We still want to keep using the same store within a test,
// for instance to test re-renders after a store change or to retain
// rtk-query's cache.
let store: Store;
beforeEach(() => {
  store = createStore();
});

/**
 * Renders a hook for test purposes with the Redux store in the context.
 *
 * This is similar to testing-library/react's renderHook(), but also adds the
 * store in the context. Among other things, this is required for using
 * rtk-query API mocks from mockOsrdEditoastEndpoints.
 *
 * A fresh store is create before each test for proper isolation. As a result,
 * this function is incompatible with vitest's .concurrent().
 */
export function renderHookWithStore<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>,
  rootState?: Partial<RootState>
): RenderHookResult<Result, Props> {
  const activeStore = rootState ? createStoreWithoutMiddleware(rootState) : store;
  return renderHook(render, {
    ...options,
    wrapper: ({ children }) => {
      const inner = <Provider store={activeStore}>{children}</Provider>;
      // If the user has provided their own wrapper, wrap the wrapper! 🕺
      const Wrapper = options?.wrapper;
      return Wrapper ? <Wrapper>{inner}</Wrapper> : inner;
    },
  });
}
