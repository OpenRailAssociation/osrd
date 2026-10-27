import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRefreshableAsyncMemo } from '../useAsyncMemo';

describe('useRefreshableAsyncMemo', () => {
  it('ignores results from refreshes made stale by dependency changes', async () => {
    const resolvers: ((value: string) => void)[] = [];
    const controllers: AbortController[] = [];
    const fn = vi.fn((controller: AbortController) => {
      controllers.push(controller);
      return new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });
    });
    const { result, rerender } = renderHook(
      ({ dependency }) => useRefreshableAsyncMemo(fn, [dependency]),
      { initialProps: { dependency: 1 } }
    );

    rerender({ dependency: 2 });
    expect(controllers[0].signal.aborted).toBe(true);
    expect(controllers[1].signal.aborted).toBe(false);

    await act(async () => {
      resolvers[1]('latest');
    });
    await act(async () => {
      resolvers[0]('stale');
    });

    expect(result.current.data).toEqual({ type: 'ready', data: 'latest' });
  });

  it('ignores results from earlier manual refreshes', async () => {
    const resolvers: ((value: string) => void)[] = [];
    const controllers: AbortController[] = [];
    const fn = vi.fn((controller: AbortController) => {
      controllers.push(controller);
      return new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });
    });
    const { result } = renderHook(() => useRefreshableAsyncMemo(fn, []));

    act(() => {
      result.current.refresh();
      result.current.refresh();
    });
    expect(controllers[1].signal.aborted).toBe(true);
    expect(controllers[2].signal.aborted).toBe(false);

    await act(async () => {
      resolvers[2]('latest');
    });
    await act(async () => {
      resolvers[1]('stale');
    });

    expect(result.current.data).toEqual({ type: 'ready', data: 'latest' });
  });
});
