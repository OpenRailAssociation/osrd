import React, { useRef } from 'react';

import { act, render, renderHook } from '@testing-library/react';
import { it, describe, expect, vi, beforeEach } from 'vitest';

import { toFormattedValues, type UnitProps, useDurationInput } from '../DurationInput';
import {
  DEFAULT_MAX,
  DEFAULT_PADCHAR,
  DEFAULT_UNIT_KEYS,
  DEFAULT_UNITS,
  DEFAULT_VALUE,
} from './consts';

const mockOnChange = vi.fn();
const mockBlur = vi.fn();
const mockFocus = vi.fn();
const mockPreventDefault = vi.fn();

const useBuildDurationInputArgs = (
  units: UnitProps[] = DEFAULT_UNIT_KEYS,
  value = DEFAULT_VALUE,
  padChar = DEFAULT_PADCHAR,
  max = DEFAULT_MAX
) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  return {
    units,
    value,
    onChange: mockOnChange,
    containerRef,
    padChar,
    max,
  };
};

describe('useDurationInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize fields normalized', () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));
    expect(result.current.fields).toStrictEqual(DEFAULT_UNITS);
  });

  it('should initialize formatted values', () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));
    expect(result.current.formattedValues).toStrictEqual(
      toFormattedValues(DEFAULT_UNITS, Infinity)
    );
  });

  it.each(DEFAULT_UNITS)('should change formatted values according to changes', (unit) => {
    const { result, rerender } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    result.current.handleChange(unit, '3');
    rerender();
    expect(result.current.formattedValues[unit.key]).toBe('3');
    DEFAULT_UNITS.filter((u) => u.key !== unit.key).forEach((u) => {
      expect(result.current.formattedValues[u.key]).toBe(
        DEFAULT_PADCHAR.padStart(u.digits ?? 0, DEFAULT_PADCHAR)
      );
    });
  });

  it('should focus next field when active field is made full', async () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    render(
      result.current.fields.map((setting, idx) => (
        <input
          key={`${idx}`}
          ref={(el) => {
            if (el) result.current.inputRefs.current[setting.key] = el;
          }}
          onFocus={() => {
            mockFocus(idx);
          }}
        />
      ))
    );

    await act(() => {
      result.current.handleChange(
        result.current.fields[1],
        '3'.padStart(result.current.fields[1].digits!, '3')
      );
    });
    expect(mockFocus).toHaveBeenCalledWith(2);
  });

  it('should not focus next field when last field is made full', async () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    render(
      result.current.fields.map((setting, idx) => (
        <input
          key={`${idx}`}
          ref={(el) => {
            if (el) result.current.inputRefs.current[setting.key] = el;
          }}
          onFocus={() => {
            mockFocus(idx);
          }}
        />
      ))
    );

    const lastField = result.current.fields.at(-1)!;
    await act(() => {
      result.current.handleChange(lastField, '3'.padStart(lastField.digits!, '3'));
    });
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it.each(['ArrowRight', ':', DEFAULT_UNIT_KEYS[0]])(
    'should focus next field when pressing %s at last character of input',
    async (key) => {
      const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

      render(
        result.current.fields.map((setting, idx) => (
          <input
            key={`${idx}`}
            ref={(el) => {
              if (el) result.current.inputRefs.current[setting.key] = el;
            }}
            onFocus={() => {
              mockFocus(idx);
            }}
          />
        ))
      );

      await act(() => {
        result.current.handleKeyDown(result.current.fields[0], {
          key,
          preventDefault: () => {
            mockPreventDefault();
          },
          currentTarget: {
            selectionStart: 1,
            value: 'a',
          },
        } as React.KeyboardEvent<HTMLInputElement>);
      });

      expect(mockFocus).toHaveBeenCalledWith(1);
      expect(mockPreventDefault).toHaveBeenCalled();
    }
  );

  it('should focus previous field when pressing ArrowLeft at first character of input', async () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    render(
      result.current.fields.map((setting, idx) => (
        <input
          key={`${idx}`}
          ref={(el) => {
            if (el) result.current.inputRefs.current[setting.key] = el;
          }}
          onFocus={() => {
            mockFocus(idx);
          }}
        />
      ))
    );

    await act(() => {
      result.current.handleKeyDown(result.current.fields[1], {
        key: 'ArrowLeft',
        preventDefault: () => {
          mockPreventDefault();
        },
        currentTarget: {
          selectionStart: 0,
          value: 'a',
        },
      } as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(mockFocus).toHaveBeenCalledWith(0);
    expect(mockPreventDefault).toHaveBeenCalled();
  });

  it('should submit change when pressing enter', () => {
    const { result, rerender } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    result.current.handleChange(result.current.fields[0], '1');

    rerender();

    result.current.handleKeyDown(result.current.fields[1], {
      key: 'Enter',
      currentTarget: {
        selectionStart: 0,
        value: '1',
      },
    } as React.KeyboardEvent<HTMLInputElement>);

    expect(mockOnChange).toHaveBeenCalledWith(3_600_000);
  });

  it('should handle focus', async () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    const firstField = result.current.fields[0];

    await act(() => {
      render(
        <input
          key="firstInput"
          ref={(el) => {
            if (el) result.current.inputRefs.current[firstField.key] = el;
          }}
          onFocus={() => {
            mockFocus();
          }}
        />
      );
      result.current.handleFocus(firstField);
    });

    expect(mockFocus).toHaveBeenCalled();
  });

  it('should handle blur', async () => {
    const { result } = renderHook(() => useDurationInput(useBuildDurationInputArgs()));

    const firstField = result.current.fields[0];

    await act(() => {
      render(
        <input
          key={`firstInput`}
          ref={(el) => {
            if (el) result.current.inputRefs.current[firstField.key] = el;
          }}
          onBlur={() => {
            mockBlur();
          }}
        />
      );
    });

    result.current.handleBlur({} as React.FocusEvent<HTMLInputElement>);
    expect(mockOnChange).toHaveBeenCalled();
  });
});
