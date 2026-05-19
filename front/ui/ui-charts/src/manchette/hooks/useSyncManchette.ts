import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SpaceTimeChartProps } from '../../spaceTimeChart';
import { DEFAULT_ZOOM_MS_PER_PX, MAX_ZOOM_Y, MIN_ZOOM_Y, ZOOM_Y_DELTA } from '../consts';
import { getDistance } from '../utils';
import { timeScaleToZoomValue, zoomX } from '../utils/helpers';

const INITIAL_STATE = {
  xZoom: timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX),
  yZoom: 1,
  timeOrigin: 0,
  spaceOrigin: 0,
  xOffset: 0,
  yOffset: 0,
  scrollTo: null,
  panning: null,
  zoomMode: false,
  rect: null,
  pixelRect: null,
};

export type SyncManchetteState = {
  xZoom: number;
  yZoom: number;
  timeOrigin: number;
  spaceOrigin: number;
  /** current x PIXEL offset from x origin */
  xOffset: number;
  /** current y PIXEL offset from y origin (the current y-scroll of the view. always updates) */
  yOffset: number;
  /** only update after a zoom. used to update back the view scroll value */
  scrollTo: number | null;
  panning: { initialOffset: { x: number; y: number } } | null;
  zoomMode: boolean;
  rect: {
    timeStart: Date;
    timeEnd: Date;
    spaceStart: number; // mm
    spaceEnd: number; // mm
  } | null;
  pixelRect: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  } | null;
};

/**
 * This hook can be used to synchronize a manchette and a diagram which has a
 * time scale for X.
 *
 * It provides offsets on both axis and functions to handle some
 * classic behaviors such as zoom, pan and scroll.
 */
const useSyncManchette = ({
  manchetteWithSpaceTimeChartRef,
  diagramRef,
  initialState = {
    timeOrigin: 0,
    spaceOrigin: 0,
    xOffset: 0,
  },
  maxYZoom = MAX_ZOOM_Y,
  enableTimeZoom = true,
}: {
  manchetteWithSpaceTimeChartRef: React.RefObject<HTMLDivElement | null>;
  maxYZoom: number;
  diagramRef?: React.RefObject<HTMLDivElement | null>;
  height?: number;
  initialState?: {
    timeOrigin?: number;
    spaceOrigin?: number;
    xOffset?: number;
  };
  enableTimeZoom?: boolean;
}) => {
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [state, setState] = useState<SyncManchetteState>({
    ...INITIAL_STATE,
    timeOrigin: initialState.timeOrigin || 0,
    spaceOrigin: initialState.spaceOrigin || 0,
    xOffset: initialState.xOffset || 0,
  });

  const { yZoom, yOffset, scrollTo, rect } = state;

  // =========== Shift pressed ===========
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

  // =========== Y Zoom ===========
  const zoomYIn = useCallback(() => {
    const newYZoom = Math.min(yZoom + ZOOM_Y_DELTA, maxYZoom);
    if (newYZoom !== yZoom) {
      const newYOffset = yOffset * (newYZoom / yZoom);

      setState((prev) => ({
        ...prev,
        yZoom: newYZoom,
        yOffset: newYOffset,
        scrollTo: newYOffset,
      }));
    }
  }, [yZoom, maxYZoom, yOffset]);

  const zoomYOut = useCallback(() => {
    const newYZoom = Math.max(MIN_ZOOM_Y, yZoom - ZOOM_Y_DELTA);
    if (newYZoom !== yZoom) {
      const newYOffset = yOffset * (newYZoom / yZoom);
      setState((prev) => ({
        ...prev,
        yZoom: newYZoom,
        yOffset: newYOffset,
        scrollTo: newYOffset,
      }));
    }
  }, [yZoom, yOffset]);

  const resetYZoom = useCallback(() => {
    setState((prev) => ({ ...prev, yZoom: 1 }));
  }, []);

  // =========== X Zoom ===========
  const handleXZoom = useCallback(
    (newXZoom: number, xPosition = (diagramRef?.current?.offsetWidth || 0) / 2) => {
      if (enableTimeZoom)
        setState((prev) => ({
          ...prev,
          ...zoomX(prev.xZoom, prev.xOffset, newXZoom, xPosition),
        }));
    },
    [enableTimeZoom, diagramRef]
  );

  const handleXZoomOnWheelEvent = useCallback(
    (wheelEvent: WheelEvent, newXZoom: number, xPosition: number) => {
      if (isShiftPressed && !rect) {
        wheelEvent.preventDefault();
        handleXZoom(newXZoom, xPosition);
      }
    },
    [handleXZoom, isShiftPressed, rect]
  );

  // =========== Y Scroll ===========
  const handleScrollInManchette = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (rect) {
        e.preventDefault();
        return;
      }
      if (!isShiftPressed && manchetteWithSpaceTimeChartRef.current) {
        const { scrollTop } = manchetteWithSpaceTimeChartRef.current;
        if (scrollTop || scrollTop === 0) {
          setState((prev) => ({ ...prev, yOffset: scrollTop }));
        }
      }
    },
    [isShiftPressed, manchetteWithSpaceTimeChartRef, rect]
  );

  useEffect(() => {
    if (scrollTo !== null && manchetteWithSpaceTimeChartRef.current) {
      manchetteWithSpaceTimeChartRef.current.scrollTo({
        top: scrollTo,
        behavior: 'instant',
      });
    }
  }, [scrollTo, manchetteWithSpaceTimeChartRef]);

  const panTo = useCallback(
    ({ x, y }: { y?: number; x?: number }, prev: SyncManchetteState): SyncManchetteState => {
      const manchette = manchetteWithSpaceTimeChartRef.current;

      let newYOffset = prev.yOffset;
      if (y !== undefined && y !== newYOffset) {
        newYOffset = Math.max(y, 0);
        if (manchette) {
          newYOffset = Math.min(newYOffset, manchette.scrollHeight - manchette.offsetHeight);
          manchette.scrollTop = newYOffset;
        }
      }

      return {
        ...prev,
        xOffset: x ?? prev.xOffset,
        yOffset: newYOffset,
      };
    },
    [manchetteWithSpaceTimeChartRef]
  );

  // =========== On Pan ===========
  const basicOnPan = useCallback(
    (
      payload: Parameters<NonNullable<SpaceTimeChartProps['onPan']>>[0],
      prev: SyncManchetteState
    ): SyncManchetteState => {
      if (!payload.isPanning) {
        return {
          ...prev,
          panning: null,
          zoomMode: false,
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
      return panTo({ x: initialOffset.x + diff.x, y: initialOffset.y - diff.y }, prev);
    },
    [panTo]
  );

  return useMemo(
    () => ({
      state,
      setState,
      handleScrollInManchette,
      handleXZoom,
      handleXZoomOnWheelEvent,
      yZoomHelpers: { zoomYIn, zoomYOut, resetZoom: resetYZoom },
      basicOnPan,
      panTo,
    }),
    [
      state,
      handleScrollInManchette,
      handleXZoom,
      handleXZoomOnWheelEvent,
      zoomYIn,
      zoomYOut,
      resetYZoom,
      basicOnPan,
      panTo,
    ]
  );
};

export default useSyncManchette;
