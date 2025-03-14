import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type DataPoint,
  type MouseContextType,
  type Point,
  type SpaceTimeChartContextType,
  type SpaceTimeChartProps,
} from '../lib/types';
import { getEventPosition, getEventWheelDelta } from '../utils/events';

type Handlers = Pick<SpaceTimeChartProps, 'onPan' | 'onMouseMove' | 'onClick' | 'onZoom'>;

/**
 * This hook handles SpaceTimeChart mouse interactions.
 * It is an internal hook, and should only be used inside SpaceTimeChart.
 */
export function useMouseInteractions(
  dom: HTMLElement | null,
  { position, hoveredItem, down, isHover }: MouseContextType,
  handlers: Handlers,
  context: SpaceTimeChartContextType
) {
  const contextRef = useRef(context);
  const handlersRef = useRef<Handlers>(handlers);
  const [panningState, setPanningState] = useState<
    { type: 'idle' } | { type: 'panning'; initialPosition: Point; initialData: DataPoint }
  >({ type: 'idle' });

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
      // Start panning:
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

    if (panningState.type === 'panning' && onPan)
      onPan({
        isPanning: true,
        position,
        initialPosition: panningState.initialPosition,
        data: contextRef.current.getData(position),
        initialData: panningState.initialData,
        context: contextRef.current,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.y]);
}
