import { renderHook, type RenderHookOptions, type RenderHookResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createTransientStore } from 'store/utils';

import type { RootState } from 'reducers';

/**
 * Renders a hook for test purposes with the Redux store in the context.
 *
 * This is similar to testing-library/react's renderHook(), but also adds the
 * store in the context. Among other things, this is required for using
 * rtk-query API mocks from mockOsrdEditoastEndpoints.
 *
 * A fresh store is created each time the function is called. This way tests
 * have a clean state to interact with.
 * For that reason, this function is incompatible with vitest's .concurrent().
 */
export function renderHookWithStore<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>,
  rootState?: Partial<RootState>
): RenderHookResult<Result, Props> & { store: ReturnType<typeof createTransientStore> } {
  const activeStore = createTransientStore(rootState);

  return {
    ...renderHook(render, {
      ...options,
      wrapper: ({ children }) => {
        const inner = <Provider store={activeStore}>{children}</Provider>;
        // If the user has provided their own wrapper, wrap the wrapper! 🕺
        const Wrapper = options?.wrapper;
        return Wrapper ? <Wrapper>{inner}</Wrapper> : inner;
      },
    }),
    store: activeStore,
  };
}
