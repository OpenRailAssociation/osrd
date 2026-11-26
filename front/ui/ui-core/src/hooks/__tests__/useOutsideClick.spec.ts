import { useRef } from 'react';

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useOutsideClick from '../useOutsideClick';

describe('useOutsideClick', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    cleanup();
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
  describe('with blockOutsideClick', () => {
    let outsideElement: HTMLButtonElement;

    beforeEach(() => {
      outsideElement = document.createElement('button');
      document.body.appendChild(outsideElement);
    });

    afterEach(() => {
      outsideElement.remove();
    });

    it('should prevent the outside mousedown and click from reaching their target', () => {
      const handler = vi.fn();
      const onOutsideMouseDown = vi.fn();
      const onOutsideClick = vi.fn();
      outsideElement.addEventListener('mousedown', onOutsideMouseDown);
      outsideElement.addEventListener('click', onOutsideClick);
      renderHook(() => {
        const ref = useRef(element);
        useOutsideClick(ref, handler, { blockOutsideClick: true });
      });

      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(handler).toHaveBeenCalledOnce();
      expect(onOutsideMouseDown).not.toHaveBeenCalled();
      expect(onOutsideClick).not.toHaveBeenCalled();

      // Only the click following the outside mousedown is blocked
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onOutsideClick).toHaveBeenCalledOnce();
    });

    it('should not block events inside the element', () => {
      const onInsideClick = vi.fn();
      element.addEventListener('click', onInsideClick);
      renderHook(() => {
        const ref = useRef(element);
        useOutsideClick(ref, vi.fn(), { blockOutsideClick: true });
      });

      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onInsideClick).toHaveBeenCalledOnce();
    });

    it('should still block the click when the option is disabled after the mousedown', () => {
      const onOutsideClick = vi.fn();
      outsideElement.addEventListener('click', onOutsideClick);
      const { rerender } = renderHook(
        ({ blockOutsideClick }) => {
          const ref = useRef(element);
          useOutsideClick(ref, vi.fn(), { blockOutsideClick });
        },
        { initialProps: { blockOutsideClick: true } }
      );

      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      rerender({ blockOutsideClick: false });
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onOutsideClick).not.toHaveBeenCalled();
    });

    it('should not block a later click when the outside mousedown was not followed by a click', () => {
      const onOutsideClick = vi.fn();
      outsideElement.addEventListener('click', onOutsideClick);
      const { rerender } = renderHook(
        ({ active }) => {
          const ref = useRef(element);
          useOutsideClick(active ? ref : null, vi.fn(), { blockOutsideClick: true });
        },
        { initialProps: { active: true } }
      );

      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      rerender({ active: false });

      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onOutsideClick).toHaveBeenCalledOnce();
    });
  });
});
