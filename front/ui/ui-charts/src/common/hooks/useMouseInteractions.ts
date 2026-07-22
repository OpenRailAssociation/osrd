import { useCallback, useEffect, useRef, useState } from 'react';

import type { HoveredItem, Point } from '../../common';
import { type DataPoint, type Handler, type PointToData } from '../../spaceTimeChart/lib/types';
import { getEventPosition, getEventWheelDelta } from '../../spaceTimeChart/utils/events';
import type { MouseContextType } from '../types';

type Handlers<T> = {
  onPan?: Handler<{
    isPanning: boolean;
    initialPosition: Point;
    position: Point;
    initialData: DataPoint;
    data: DataPoint;
    context: T;
  }>;
  onZoom?: Handler<{
    delta: number;
    position: Point;
    event: WheelEvent;
    context: T;
  }>;
  onClick?: Handler<{
    position: Point;
    data: DataPoint;
    event: MouseEvent;
    hoveredItem: HoveredItem | null;
    context: T;
  }>;
  onMouseMove?: Handler<{
    position: Point;
    data: DataPoint;
    isHover: boolean;
    hoveredItem: HoveredItem | null;
    context: T;
  }>;
};

/**
 * This hook handles SpaceTimeChart mouse interactions.
 * It is an internal hook, and should only be used inside SpaceTimeChart.
 */
export function useMouseInteractions<T extends { fingerprint: string; getData: PointToData }>(
  dom: HTMLElement | null,
  { position, hoveredItem, down, isHover }: MouseContextType,
  handlers: Handlers<T>,
  context: T
) {
  const contextRef = useRef(context);
  const handlersRef = useRef<Handlers<T>>(handlers);
  const [panningState, setPanningState] = useState<
    { type: 'idle' } | { type: 'panning'; initialPosition: Point; initialData: DataPoint }
  >({ type: 'idle' });
  const didPanRef = useRef(false);

  // Cache latest context in ref:
  useEffect(() => {
    contextRef.current = context;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.fingerprint]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Generate event handlers:
  const clickHandler = useCallback(
    (event: MouseEvent) => {
      if (!dom) return;
      if (didPanRef.current) return;

      const { onClick } = handlersRef.current;
      if (onClick) {
        onClick({
          event,
          position,
          data: contextRef.current.getData(position),
          hoveredItem,
          context: contextRef.current,
        });
      }
    },
    [dom, hoveredItem, position]
  );
  const wheelHandler: (event: WheelEvent) => void = useCallback(
    (event: WheelEvent) => {
      const { onZoom } = handlersRef.current;
      if (onZoom && dom)
        onZoom({
          delta: getEventWheelDelta(event),
          position: getEventPosition(event, dom),
          event,
          context: contextRef.current,
        });
    },
    [dom]
  );

  // Bind event handlers:
  useEffect(() => {
    if (!dom) return;
    dom.addEventListener('click', clickHandler);
    return () => {
      dom.removeEventListener('click', clickHandler);
    };
  }, [dom, clickHandler]);
  useEffect(() => {
    if (!dom) return;
    dom.addEventListener('wheel', wheelHandler);
    return () => {
      dom.removeEventListener('wheel', wheelHandler);
    };
  }, [dom, wheelHandler]);

  // Listen to "up" and "down" updates:
  useEffect(() => {
    const { onPan } = handlersRef.current;

    if (down) {
      // Start panning: a fresh press is a potential click until it moves far
      // enough to be a pan.
      didPanRef.current = false;
      setPanningState({
        type: 'panning',
        initialPosition: position,
        initialData: contextRef.current.getData(position),
      });
    } else {
      // Stop panning:
      if (panningState.type === 'panning' && onPan)
        onPan({
          isPanning: false,
          position,
          initialPosition: panningState.initialPosition,
          data: contextRef.current.getData(position),
          initialData: panningState.initialData,
          context: contextRef.current,
        });

      if (panningState.type !== 'idle') setPanningState({ type: 'idle' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [down]);

  // Listen to "move" updates:
  useEffect(() => {
    const { onPan, onMouseMove } = handlersRef.current;

    if (onMouseMove) {
      onMouseMove({
        position,
        isHover,
        data: contextRef.current.getData(position),
        hoveredItem,
        context: contextRef.current,
      });
    }

    if (panningState.type === 'panning') {
      // The browser fires a `click` even when the pointer drifts a few pixels
      // between mousedown and mouseup. We only treat the gesture as a pan once
      // it travels past a small threshold, so that tiny jitter during a real
      // click doesn't end up swallowing it.
      // 3px matches the usual native drag tolerance: small enough that a
      // deliberate pan is detected almost immediately, but large enough to
      // absorb the hand tremor / sub-pixel noise of a steady click.
      const dx = position.x - panningState.initialPosition.x;
      const dy = position.y - panningState.initialPosition.y;
      if (Math.hypot(dx, dy) > 3) {
        didPanRef.current = true;
      }
      onPan?.({
        isPanning: true,
        position,
        initialPosition: panningState.initialPosition,
        data: contextRef.current.getData(position),
        initialData: panningState.initialData,
        context: contextRef.current,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.y]);
}
