import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Point } from '../../common/types';
import { timeScaleToZoomValue, zoomX } from '../../manchette/utils/helpers';
import {
  CHRONOGRAM_HEADER_HEIGHT,
  CHRONOGRAM_BOTTOM_PADDING,
  LEVEL_CROSSING_ITEM_HEIGHT,
} from '../lib/const';

// TODO: manchette's existant utils => common ?
function getDistance(a: Point, b: Point): Point {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
  };
}

export type UseChronogramProps = {
  itemCount: number;
  chronogramManchetteRef: React.RefObject<HTMLDivElement | null>;
  chronogramChartRef: React.RefObject<HTMLDivElement | null>;
  chronogramHeight: number;
};

export type ChronogramState = {
  height: number;
  xOffset: number;
  yOffset: number;
  panning: { initialOffset: { x: number; y: number } } | null;
  xZoom: number;
};

const INITIAL_STATE = {
  height: 0,
  xOffset: 0,
  yOffset: 0,
  panning: null,
  xZoom: timeScaleToZoomValue(3000),
};

const useChronogram = ({
  itemCount,
  chronogramManchetteRef,
  chronogramChartRef,
  chronogramHeight,
}: UseChronogramProps) => {
  const calculatedInitialHeight = useMemo(
    () =>
      CHRONOGRAM_HEADER_HEIGHT + itemCount * LEVEL_CROSSING_ITEM_HEIGHT + CHRONOGRAM_BOTTOM_PADDING,
    [itemCount]
  );

  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const [state, setState] = useState<ChronogramState>({
    ...INITIAL_STATE,
    height: calculatedInitialHeight,
  });

  const { height, xOffset, yOffset, xZoom } = state;

  const setHeight = useCallback(
    (newHeight: number) => {
      setState((prev) => ({
        ...prev,
        height: Math.max(newHeight, calculatedInitialHeight),
      }));
    },
    [calculatedInitialHeight]
  );

  useEffect(() => {
    // TODO: fix this lint
    /* eslint-disable-next-line react-hooks-js/set-state-in-effect */
    setHeight(chronogramHeight);
  }, [chronogramHeight, setHeight]);

  // =========== Pan (horizontal time navigation) ===========
  const onTimePan = useCallback(
    (payload: { initialPosition: Point; position: Point; isPanning: boolean }) => {
      setState((prev) => {
        if (!payload.isPanning) {
          return {
            ...prev,
            panning: null,
          };
        }

        if (!prev.panning) {
          return {
            ...prev,
            panning: { initialOffset: { x: prev.xOffset, y: prev.yOffset } },
          };
        }

        const { initialOffset } = prev.panning;
        const diff = getDistance(payload.initialPosition, payload.position);

        const newXOffset = initialOffset.x + diff.x;

        return {
          ...prev,
          xOffset: newXOffset,
        };
      });
    },
    []
  );

  // =========== Y Scroll ===========
  const handleVerticalScroll = useCallback(() => {
    if (chronogramManchetteRef.current) {
      const { scrollTop } = chronogramManchetteRef.current;
      if (scrollTop >= 0) {
        setState((prev) => ({ ...prev, yOffset: scrollTop }));
      }
    }
  }, [chronogramManchetteRef]);

  // ======== Shift key events ==========
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      setIsShiftPressed(true);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      setIsShiftPressed(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // =========== X Zoom ===========
  const handleXZoom = useCallback(
    (newXZoom: number, xPosition = (chronogramChartRef.current?.offsetWidth || 0) / 2) => {
      setState((prev) => ({
        ...prev,
        ...zoomX(prev.xZoom, prev.xOffset, newXZoom, xPosition),
      }));
    },
    [chronogramChartRef]
  );

  const handleXZoomOnWheelEvent = useCallback(
    (wheelEvent: WheelEvent, newXZoom: number, xPosition: number) => {
      if (isShiftPressed) {
        wheelEvent.preventDefault();
        handleXZoom(newXZoom, xPosition);
      }
    },
    [handleXZoom, isShiftPressed]
  );

  return useMemo(
    () => ({
      handleVerticalScroll,
      handleXZoom,
      handleXZoomOnWheelEvent,
      height,
      onPan: onTimePan,
      setHeight,
      xOffset,
      xZoom,
      yOffset,
    }),
    [
      height,
      setHeight,
      xOffset,
      xZoom,
      yOffset,
      handleVerticalScroll,
      handleXZoom,
      handleXZoomOnWheelEvent,
      onTimePan,
    ]
  );
};

export default useChronogram;
