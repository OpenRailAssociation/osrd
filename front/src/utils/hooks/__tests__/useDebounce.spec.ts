import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useDebounce, useDebouncedEffect, useDebouncedFunc } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce value', () => {
    const { result, rerender } = renderHook((value) => useDebounce<string>(value, 500), {
      initialProps: 'Hello',
    });

    expect(result.current).toBe('Hello');

    rerender('Hello, World!');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('Hello, World!');

    rerender('Hello, World! Again!');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('Hello, World! Again!');
  });

  it('should clear timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook((value) => useDebounce<string>(value, 500), {
      initialProps: 'Hello',
    });

    expect(result.current).toBe('Hello');

    rerender('Hello, World!');

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('Hello');
  });
});

describe('useDebouncedFunc', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce function', () => {
    const mockFunc = vi.fn();
    const { rerender } = renderHook((value) => useDebouncedFunc<string>(value, 500, mockFunc), {
      initialProps: 'Hello',
    });

    expect(mockFunc).not.toHaveBeenCalled();

    rerender('Hello, World!');

    expect(mockFunc).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockFunc).toHaveBeenLastCalledWith('Hello, World!');

    rerender('Hello, World! Again!');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockFunc).toHaveBeenLastCalledWith('Hello, World! Again!');
  });

  it('should clear timeout on unmount', () => {
    const mockFunc = vi.fn();
    const { rerender, unmount } = renderHook(
      (value) => useDebouncedFunc<string>(value, 500, mockFunc),
      {
        initialProps: 'Hello',
      }
    );

    expect(mockFunc).not.toHaveBeenCalled();

    rerender('Hello, World!');

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockFunc).not.toHaveBeenCalled();
  });
});

describe('useDebouncedEffect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce an effect', () => {
    const mockFunc = vi.fn<(dep1: number, dep2: string) => void>();
    const { rerender } = renderHook(
      ({ dep1, dep2 }) => useDebouncedEffect(() => mockFunc(dep1, dep2), [dep1, dep2], 500),
      { initialProps: { dep1: 0, dep2: '' } }
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });
    rerender({ dep1: 0, dep2: 'a' });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    rerender({ dep1: 2, dep2: 'a' });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockFunc).not.toHaveBeenCalled();

    rerender({ dep1: 2, dep2: 'a' });
    act(() => {
      vi.advanceTimersByTime(101);
    });
    expect(mockFunc).toHaveBeenCalledExactlyOnceWith(2, 'a');

    rerender({ dep1: 3, dep2: 'a' });
    rerender({ dep1: 4, dep2: 'c' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockFunc).toHaveBeenCalledTimes(2);
    expect(mockFunc).toHaveBeenLastCalledWith(4, 'c');
  });
});
