import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { usePrevious } from '../state';

function renderUsePrevious<T>(initialValue: T) {
  return renderHook(({ value }) => usePrevious(value), {
    initialProps: { value: initialValue },
  });
}

describe('usePrevious', () => {
  describe('initial value', () => {
    it('returns null on the first render', () => {
      const { result } = renderUsePrevious('initial');

      expect(result.current).toBeNull();
    });
  });

  describe('core behavior after updates', () => {
    it('returns the previous value after the first update', () => {
      const { result, rerender } = renderUsePrevious('first');

      expect(result.current).toBeNull();

      rerender({ value: 'second' });
      expect(result.current).toBe('first');
    });

    it('tracks the previous value across multiple successive updates', () => {
      const { result, rerender } = renderUsePrevious('a');

      rerender({ value: 'b' });
      expect(result.current).toBe('a');

      rerender({ value: 'c' });
      expect(result.current).toBe('b');

      rerender({ value: 'd' });
      expect(result.current).toBe('c');
    });

    it('returns the value from the previous render even when the current value is unchanged', () => {
      const { result, rerender } = renderUsePrevious('stable');

      rerender({ value: 'changed' });
      expect(result.current).toBe('stable');

      rerender({ value: 'changed' });
      expect(result.current).toBe('changed');
    });
  });

  describe('falsy values', () => {
    it('correctly returns false as the previous value', () => {
      const { result, rerender } = renderUsePrevious<boolean>(true);

      rerender({ value: false });
      expect(result.current).toBe(true);

      rerender({ value: true });
      expect(result.current).toBe(false);
    });

    it('correctly returns 0 as the previous value', () => {
      const { result, rerender } = renderUsePrevious<number>(1);

      rerender({ value: 0 });
      expect(result.current).toBe(1);

      rerender({ value: 2 });
      expect(result.current).toBe(0);
    });

    it('correctly returns an empty string as the previous value', () => {
      const { result, rerender } = renderUsePrevious<string>('hello');

      rerender({ value: '' });
      expect(result.current).toBe('hello');

      rerender({ value: 'world' });
      expect(result.current).toBe('');
    });
  });

  describe('real codebase use cases', () => {
    it("returns the previous derived boolean for activeBoards.has('macro')", () => {
      const createBoards = (...boards: string[]) => new Set(boards);

      const { result, rerender } = renderHook(
        ({ activeBoards }) => usePrevious(activeBoards.has('macro')),
        {
          initialProps: { activeBoards: createBoards('micro') },
        }
      );

      expect(result.current).toBeNull();

      rerender({ activeBoards: createBoards('micro', 'macro') });
      expect(result.current).toBe(false);

      rerender({ activeBoards: createBoards('micro') });
      expect(result.current).toBe(true);
    });

    it('preserves the exact reference of the previous object for effortCurves', () => {
      const curveV1 = {
        mode1: {
          curves: [],
          default_curve: {},
          is_electric: false,
        },
      };

      const curveV2 = {
        mode2: {
          curves: [],
          default_curve: {},
          is_electric: true,
        },
      };

      const { result, rerender } = renderUsePrevious<object>(curveV1);

      rerender({ value: curveV2 });
      expect(result.current).toBe(curveV1);
    });

    it('preserves the exact reference of the previous array for trainScheduleProjections', () => {
      const projV1 = [{ id: '1', name: 'Train A' }];
      const projV2 = [
        { id: '1', name: 'Train A' },
        { id: '2', name: 'Train B' },
      ];

      const { result, rerender } = renderUsePrevious<object[]>(projV1);

      rerender({ value: projV2 });
      expect(result.current).toBe(projV1);
    });

    it('supports nullable values', () => {
      const curveV1 = {
        mode1: {
          curves: [],
          default_curve: {},
          is_electric: false,
        },
      };

      const { result, rerender } = renderUsePrevious<typeof curveV1 | null>(curveV1);

      rerender({ value: null });
      expect(result.current).toBe(curveV1);
    });
  });
});
