import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { HoveredItem, PickingElement } from '../../types';
import useHoveredPickingElement from '../useHoveredPickingElement';

type FooElement = PickingElement & { id: string };

const isFoo = (element: PickingElement): element is FooElement => element.type === 'foo';

const hoveredItem = (element: PickingElement): HoveredItem => ({ layer: 'paths', element });

describe('useHoveredPickingElement', () => {
  it('should keep the element when it passes the guard', () => {
    const { result } = renderHook(() => useHoveredPickingElement(isFoo));
    const foo: FooElement = { type: 'foo', id: 'a' };

    act(() => result.current.handleHoveredChildUpdate({ item: hoveredItem(foo) }));

    expect(result.current.hoveredElement).toEqual(foo);
  });

  it('should ignore an element that does not pass the guard', () => {
    const { result } = renderHook(() => useHoveredPickingElement(isFoo));

    act(() => result.current.handleHoveredChildUpdate({ item: hoveredItem({ type: 'bar' }) }));

    expect(result.current.hoveredElement).toBeUndefined();
  });

  it('should reset the element when there is no hovered item', () => {
    const { result } = renderHook(() => useHoveredPickingElement(isFoo));
    const foo: FooElement = { type: 'foo', id: 'a' };

    act(() => result.current.handleHoveredChildUpdate({ item: hoveredItem(foo) }));
    expect(result.current.hoveredElement).toBeDefined();

    act(() => result.current.handleHoveredChildUpdate({ item: null }));

    expect(result.current.hoveredElement).toBeUndefined();
  });
});
