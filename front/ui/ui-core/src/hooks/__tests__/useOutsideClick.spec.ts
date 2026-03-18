import { useRef } from 'react';

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useOutsideClick from '../useOutsideClick';

describe('useOutsideClick', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  it('should call handler when clicking outside of the element', () => {
    const handler = vi.fn();
    renderHook(() => {
      const ref = useRef(element);
      useOutsideClick(ref, handler);
    });

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should not call handler when clicking inside the element', () => {
    const handler = vi.fn();
    renderHook(() => {
      const ref = useRef(element);
      useOutsideClick(ref, handler);
    });

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not call handler when ref is null', () => {
    const handler = vi.fn();
    renderHook(() => {
      useOutsideClick(null, handler);
    });

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should remove event listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => {
      const ref = useRef(element);
      useOutsideClick(ref, handler);
    });

    unmount();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });
});
