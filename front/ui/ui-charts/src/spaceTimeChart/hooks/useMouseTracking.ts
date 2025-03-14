import { useCallback, useEffect, useState } from 'react';

import { type MouseState } from '../lib/types';
import { getEventPosition } from '../utils/events';

/**
 * This hook handles SpaceTimeChart mouse tracking.
 * It is an internal hook, and should only be used inside SpaceTimeChart.
 */
export function useMouseTracking(dom: HTMLElement | null) {
  const [mouseState, setMouseState] = useState<MouseState>({
    isHover: false,
    position: { x: NaN, y: NaN },
  });

  // Generate event handlers:
  const downHandler = useCallback(
    (e: MouseEvent) => {
      if (!dom) return;

      setMouseState((state) => ({
        ...state,
        down: { ctrl: e.ctrlKey, shift: e.shiftKey },
      }));
    },
    [dom]
  );
  const upHandler = useCallback(() => {
    if (!dom) return;

    setMouseState((state) => ({ ...state, down: undefined }));
  }, [dom]);
  const moveHandler = useCallback(
    (event: MouseEvent) => {
      if (!dom) return;

      const position = getEventPosition(event, dom);
      const { x, y } = position;
      const width = dom.offsetWidth;
      const height = dom.offsetHeight;
      const isHover = x >= 0 && x <= width && y >= 0 && y <= height;
      setMouseState((state) => ({
        ...state,
        position,
        isHover,
      }));
    },
    [dom]
  );

  // Bind event handlers:
  useEffect(() => {
    if (!dom) return;
    dom.addEventListener('mousedown', downHandler);
    return () => {
      dom.removeEventListener('mousedown', downHandler);
    };
  }, [dom, downHandler]);
  useEffect(() => {
    document.addEventListener('mouseup', upHandler);
    return () => {
      document.removeEventListener('mouseup', upHandler);
    };
  }, [upHandler]);
  useEffect(() => {
    document.addEventListener('mousemove', moveHandler);
    return () => {
      document.removeEventListener('mousemove', moveHandler);
    };
  }, [moveHandler]);

  return mouseState;
}
