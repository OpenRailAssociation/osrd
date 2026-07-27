import { fireEvent, renderHook, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { MouseContextType } from '../../types.ts';
import { useMouseInteractions } from '../useMouseInteractions';

const contextMock = {
  fingerprint: 'test',
  getData: () => ({ time: 0, position: 0 }),
};

const mockOnClick = vi.fn();
const mockOnZoom = vi.fn();
const mockOnMouseMove = vi.fn();
const mockOnPan = vi.fn();

const mockMouseContext: MouseContextType = {
  data: { time: 0, position: 0 },
  hoveredItem: null,
  position: { x: 0, y: 0 },
  down: undefined,
  isHover: true,
};

const dom: HTMLElement = document.body;

describe('useMouseInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should call the onClick handler when the mouse is clicked', () => {
    renderHook(() =>
      useMouseInteractions(dom, mockMouseContext, { onClick: mockOnClick }, contextMock)
    );

    fireEvent.click(dom);

    expect(mockOnClick).toHaveBeenCalledOnce();
  });

  it('should call the onZoom handler when the mouse wheel is used', () => {
    renderHook(() =>
      useMouseInteractions(dom, mockMouseContext, { onZoom: mockOnZoom }, contextMock)
    );

    fireEvent.wheel(dom, { deltaY: 10 });

    expect(mockOnZoom).toHaveBeenCalledWith(expect.objectContaining({ delta: (10 * -3) / 360 }));
  });

  it('should call the onMouseMove handler when the mouse is moved', () => {
    const { rerender } = renderHook(
      ({ mouseContext }) =>
        useMouseInteractions(dom, mouseContext, { onMouseMove: mockOnMouseMove }, contextMock),
      { initialProps: { mouseContext: mockMouseContext } }
    );

    rerender({
      mouseContext: {
        ...mockMouseContext,
        position: { x: 10, y: 20 },
      },
    });

    expect(mockOnMouseMove).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 10, y: 20 },
      })
    );
  });

  it('should call the onPan handler when down and position change', () => {
    const { rerender } = renderHook(
      ({ mouseContext }) =>
        useMouseInteractions(dom, mouseContext, { onPan: mockOnPan }, contextMock),
      {
        initialProps: { mouseContext: mockMouseContext },
      }
    );

    rerender({
      mouseContext: {
        ...mockMouseContext,
        down: {},
        position: { x: 10, y: 20 },
      },
    });

    rerender({
      mouseContext: {
        ...mockMouseContext,
        position: { x: 15, y: 25 },
      },
    });

    expect(mockOnPan).toHaveBeenCalledWith({
      initialPosition: { x: 10, y: 20 },
      position: { x: 15, y: 25 },
      isPanning: true,
      initialData: { time: 0, position: 0 },
      data: { time: 0, position: 0 },
      context: contextMock,
    });
  });

  it('should trigger onClick if the position has changed less than 3 px', () => {
    const { rerender } = renderHook(
      ({ mouseContext }) =>
        useMouseInteractions(
          dom,
          mouseContext,
          { onClick: mockOnClick, onPan: mockOnPan },
          contextMock
        ),
      { initialProps: { mouseContext: mockMouseContext } }
    );

    rerender({
      mouseContext: {
        ...mockMouseContext,
        down: {},
        position: { x: 10, y: 20 },
      },
    });

    rerender({
      mouseContext: {
        ...mockMouseContext,
        down: {},
        position: { x: 12, y: 22 },
      },
    });

    fireEvent.click(dom);

    expect(mockOnClick).toHaveBeenCalledOnce();
  });

  it('should not trigger onClick if the position has changed more than 3 px', () => {
    const { rerender } = renderHook(
      ({ mouseContext }) =>
        useMouseInteractions(
          dom,
          mouseContext,
          { onClick: mockOnClick, onPan: mockOnPan },
          contextMock
        ),
      { initialProps: { mouseContext: mockMouseContext } }
    );

    rerender({
      mouseContext: {
        ...mockMouseContext,
        down: {},
        position: { x: 10, y: 20 },
      },
    });

    rerender({
      mouseContext: {
        ...mockMouseContext,
        down: {},
        position: { x: 20, y: 30 },
      },
    });

    fireEvent.click(dom);

    expect(mockOnClick).not.toHaveBeenCalled();
  });
});
