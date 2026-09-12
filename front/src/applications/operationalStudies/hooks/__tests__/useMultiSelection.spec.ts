import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import useMultiSelection from '../useMultiSelection';

type TestItem = { id: number; name: string };

const initialItems: TestItem[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
];

describe('useMultiSelection', () => {
  let deleteItemCallback: (itemId: number) => void;

  beforeEach(() => {
    deleteItemCallback = vi.fn();
  });

  it('should initialize with an empty selection and no items', () => {
    const { result } = renderHook(() => useMultiSelection<TestItem>(deleteItemCallback));

    expect(result.current.selectedItemIds).toEqual([]);
    expect(result.current.items).toEqual([]);
  });

  it('should set items and return them', () => {
    const { result } = renderHook(() => useMultiSelection<TestItem>(deleteItemCallback));

    act(() => {
      result.current.setItems(initialItems);
    });

    expect(result.current.items).toEqual(initialItems);
  });

  it('should toggle selection (add and remove items)', () => {
    const { result } = renderHook(() => useMultiSelection<TestItem>(deleteItemCallback));

    act(() => {
      result.current.toggleSelection(1);
    });

    expect(result.current.selectedItemIds).toEqual([1]);

    act(() => {
      result.current.toggleSelection(2);
    });

    expect(result.current.selectedItemIds).toEqual([1, 2]);

    act(() => {
      result.current.toggleSelection(1);
    });

    expect(result.current.selectedItemIds).toEqual([2]);
  });

  it('should replace the selection when setSelectedItemIds is called', () => {
    const { result } = renderHook(() => useMultiSelection<TestItem>(deleteItemCallback));

    act(() => {
      result.current.toggleSelection(1);
    });
    expect(result.current.selectedItemIds).toEqual([1]);

    // setSelectedItemIds replaces the array, it does not merge it
    act(() => {
      result.current.setSelectedItemIds([2, 3]);
    });

    expect(result.current.selectedItemIds).toEqual([2, 3]);
  });

  it('should call deleteItemCallback for each selected id', () => {
    const { result } = renderHook(() => useMultiSelection<TestItem>(deleteItemCallback));

    act(() => {
      result.current.setItems(initialItems);
    });

    act(() => {
      result.current.setSelectedItemIds([1, 3]);
    });

    act(() => {
      result.current.deleteItems();
    });

    expect(deleteItemCallback).toHaveBeenCalledTimes(2);
    expect(deleteItemCallback).toHaveBeenCalledWith(1);
    expect(deleteItemCallback).toHaveBeenCalledWith(3);
    expect(result.current.items).toEqual([{ id: 2, name: 'Item 2' }]);
    expect(result.current.selectedItemIds).toEqual([]);
  });

  it('should not call deleteItemCallback with an empty selection', () => {
    const { result } = renderHook(() => useMultiSelection<TestItem>(deleteItemCallback));

    act(() => {
      result.current.setItems(initialItems);
    });

    act(() => {
      result.current.deleteItems();
    });

    expect(deleteItemCallback).not.toHaveBeenCalled();
    expect(result.current.items).toEqual(initialItems);
  });
});
