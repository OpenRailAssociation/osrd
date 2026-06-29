import type { ChangeEvent } from 'react';

import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import useDefaultComboBox, {
  defaultFilterSuggestions,
  normalizeString,
} from '../useDefaultComboBox';

describe('normalizeString', () => {
  describe('lowercases the input if necessary', () => {
    it('should transform FOO into foo', () => {
      expect(normalizeString('FOO')).toEqual('foo');
    });

    it('should transform bar into bar', () => {
      expect(normalizeString('bar')).toEqual('bar');
    });
  });

  describe('removes accents if any', () => {
    it('should transform éclair into eclair', () => {
      expect(normalizeString('éclair')).toEqual('eclair');
    });

    it('should transform AOÛT into aout', () => {
      expect(normalizeString('AOÛT')).toEqual('aout');
    });
  });
});

describe('defaultFilterSuggestions', () => {
  const labels = [
    { label: 'red', suggestion: '#ff0000' },
    { label: 'blue', suggestion: '#0000ff' },
    { label: 'limegreen', suggestion: '#aacdaa' },
    { label: 'green', suggestion: '#00ff00' },
    { label: 'lightblue', suggestion: '#00aaff' },
    { label: 'orange', suggestion: '#ffaa00' },
  ];

  describe('returns everything on emptyness', () => {
    const ALL_COLORS = ['#ff0000', '#0000ff', '#aacdaa', '#00ff00', '#00aaff', '#ffaa00'];

    it('should return all the suggestions if query is empty', () => {
      expect(defaultFilterSuggestions(labels, '')).toEqual(ALL_COLORS);
    });

    it('should return all the suggestions if query is full of spaces', () => {
      expect(defaultFilterSuggestions(labels, '  ')).toEqual(ALL_COLORS);
    });
  });

  describe('returns suggestions containing the query', () => {
    it("should return all greens on 'ee', 'EE' and 'ee ' (with a trailing space)", () => {
      expect(defaultFilterSuggestions(labels, 'ee')).toEqual(['#aacdaa', '#00ff00']);
      expect(defaultFilterSuggestions(labels, 'EE')).toEqual(['#aacdaa', '#00ff00']);
      expect(defaultFilterSuggestions(labels, 'ee ')).toEqual(['#aacdaa', '#00ff00']);
    });
  });

  describe('starts the suggestions by what starts with the query', () => {
    it("should return the blue color first on 'blue', 'BLUE', 'blue ' (with a trailing space)", () => {
      expect(defaultFilterSuggestions(labels, 'blue')).toEqual(['#0000ff', '#00aaff']);
      expect(defaultFilterSuggestions(labels, 'BLUE')).toEqual(['#0000ff', '#00aaff']);
      expect(defaultFilterSuggestions(labels, 'blue ')).toEqual(['#0000ff', '#00aaff']);
    });
  });

  describe('filter out all suggestions if nothing matches', () => {
    it("should return nothing on 'magenta'", () => {
      expect(defaultFilterSuggestions(labels, 'magenta')).toEqual([]);
    });
  });
});

function mockChangeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return vi.mockObject({ target: { value } }) as ChangeEvent<HTMLInputElement>;
}

describe('useDefaultComboBox', () => {
  const GREEN = { id: '1-green', label: 'Green' };
  const RED = { id: '2-red', label: 'Red' };
  const ORANGE = { id: '3-orange', label: 'Orange' };

  const SUGGESTIONS = [GREEN, RED, ORANGE];

  it('should offer suggestions props for basic combo box', () => {
    const { result } = renderHook(() => useDefaultComboBox(SUGGESTIONS, (color) => color.label));

    expect(result.current.suggestions).toEqual([GREEN, RED, ORANGE]);

    act(() => {
      result.current.onChange(mockChangeEvent('re'));
    });

    expect(result.current.suggestions).toEqual([RED, GREEN]);

    act(() => {
      result.current.onChange(mockChangeEvent('red'));
    });

    expect(result.current.suggestions).toEqual([RED]);

    act(() => {
      result.current.onChange(mockChangeEvent(' ang '));
    });

    expect(result.current.suggestions).toEqual([ORANGE]);

    act(() => {
      result.current.onChange(mockChangeEvent('blu'));
    });

    expect(result.current.suggestions).toEqual([]);

    act(() => {
      result.current.onChange(mockChangeEvent(' '));
    });

    expect(result.current.suggestions).toEqual([GREEN, RED, ORANGE]);
  });

  it('should reset suggestions using the relevant method', () => {
    const { result } = renderHook(() => useDefaultComboBox(SUGGESTIONS, (color) => color.label));

    act(() => {
      result.current.onChange(mockChangeEvent('red'));
    });

    expect(result.current.suggestions).toEqual([RED]);

    act(() => {
      result.current.resetSuggestions();
    });

    expect(result.current.suggestions).toEqual([GREEN, RED, ORANGE]);
  });
});
