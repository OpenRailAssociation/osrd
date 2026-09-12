import { fireEvent, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { useMouseTracking } from '../useMouseTracking';

const DOM_OFFSET = { left: 10, top: 20 };
const WIDTH = 100;
const HEIGHT = 50;

/** Builds a DOM element with a fixed position and size */
const createDom = () => {
  const dom = document.createElement('div');
  dom.getBoundingClientRect = () => DOM_OFFSET as DOMRect;
  Object.defineProperties(dom, {
    offsetWidth: { value: WIDTH },
    offsetHeight: { value: HEIGHT },
  });
  document.body.appendChild(dom);
  return dom;
};

/** Moves the mouse to a position relative to the element */
const moveMouseTo = (x: number, y: number) =>
  fireEvent.mouseMove(document, { clientX: DOM_OFFSET.left + x, clientY: DOM_OFFSET.top + y });

describe('useMouseTracking', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should not hover anywhere before the mouse moves', () => {
    const { result } = renderHook(() => useMouseTracking(createDom()));

    expect(result.current).toEqual({ isHover: false, position: { x: NaN, y: NaN } });
  });

  it('should report the position relative to the element', () => {
    const { result } = renderHook(() => useMouseTracking(createDom()));

    moveMouseTo(30, 40);

    expect(result.current.position).toEqual({ x: 30, y: 40 });
  });

  it.each([
    { name: 'inside the element', x: 30, y: 40, isHover: true },
    { name: 'on the element edges', x: WIDTH, y: HEIGHT, isHover: true },
    { name: 'past the right edge', x: WIDTH + 1, y: 40, isHover: false },
    { name: 'past the bottom edge', x: 30, y: HEIGHT + 1, isHover: false },
    { name: 'before the left edge', x: -1, y: 40, isHover: false },
    { name: 'above the top edge', x: 30, y: -1, isHover: false },
  ])('should hover when the mouse is $name', ({ x, y, isHover }) => {
    const { result } = renderHook(() => useMouseTracking(createDom()));

    moveMouseTo(x, y);

    expect(result.current.isHover).toBe(isHover);
  });

  it('should record the modifier keys held while pressing the mouse down', () => {
    const dom = createDom();
    const { result } = renderHook(() => useMouseTracking(dom));

    fireEvent.mouseDown(dom, { ctrlKey: true, shiftKey: false });

    expect(result.current.down).toEqual({ ctrl: true, shift: false });
  });

  it('should release the mouse even when it is up outside of the element', () => {
    const dom = createDom();
    const { result } = renderHook(() => useMouseTracking(dom));

    fireEvent.mouseDown(dom, {});
    fireEvent.mouseUp(document);

    expect(result.current.down).toBeUndefined();
  });

  it('should not track anything without an element', () => {
    const { result } = renderHook(() => useMouseTracking(null));

    moveMouseTo(30, 40);

    expect(result.current).toEqual({ isHover: false, position: { x: NaN, y: NaN } });
  });

  it('should unbind its listeners once unmounted', () => {
    const dom = createDom();
    const domRemove = vi.spyOn(dom, 'removeEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useMouseTracking(dom));

    unmount();

    expect(domRemove).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });
});
