import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useDebounce, useDebouncedFunc } from '../useDebounce';

vi.useFakeTimers();

describe('useDebounce', () => {
  it('should debounce value', () => {
    const { result, rerender } = renderHook((value) => useDebounce<string>(value, 500), {
      initialProps: 'Hello',
    });

    expect(result.current).toBe('Hello');

    act(() => {
      rerender('Hello, World!');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('Hello, World!');

    act(() => {
      rerender('Hello, World! Again!');
    });

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

    act(() => {
      rerender('Hello, World!');
    });

    act(() => {
      unmount();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('Hello');
  });
});

describe('useDebouncedFunc', () => {
  it('should debounce function', () => {
    const mockFunc = vi.fn();
    const { rerender } = renderHook((value) => useDebouncedFunc<string>(value, 500, mockFunc), {
      initialProps: 'Hello',
    });

    expect(mockFunc).not.toHaveBeenCalled();

    act(() => {
      rerender('Hello, World!');
    });

    expect(mockFunc).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockFunc).toHaveBeenLastCalledWith('Hello, World!');

    act(() => {
      rerender('Hello, World! Again!');
    });

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

    act(() => {
      rerender('Hello, World!');
    });

    act(() => {
      unmount();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockFunc).not.toHaveBeenCalled();
  });
});
