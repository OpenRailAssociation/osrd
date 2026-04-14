import React, { useEffect, useMemo, useState } from 'react';

import cx from 'classnames';

import { TimeChartCanvasContext } from '../../common/context';
import { getTimeToPixel, getPixelToTime } from '../../common/helpers/time';
import { useCanvas } from '../../common/hooks/useCanvas';
import { useMouseInteractions } from '../../common/hooks/useMouseInteractions';
import { useMouseTracking } from '../../common/hooks/useMouseTracking';
import { useSize } from '../../common/hooks/useSize';
import { TimeCaptions } from '../../common/layers/TimeCaptions';
import TimeGraduations from '../../common/layers/TimeGraduations';
import type { PickingElement, Point } from '../../common/types';
import { DEFAULT_THEME } from '../../spaceTimeChart/lib/consts';
import { MouseContext } from '../../spaceTimeChart/lib/context';
import { validateTheme } from '../../spaceTimeChart/lib/theme';
import type { DataPoint, MouseContextType } from '../../spaceTimeChart/lib/types';
import { ChronogramContext } from '../lib/context';
import type { ChronogramContextType, ChronogramCanvasProps } from '../lib/types';
import { OccupancyBlocksLayer } from './OccupancyBlocksLayer';

export const ChronogramCanvas = (props: ChronogramCanvasProps) => {
  const {
    levelCrossingsOccupancies,
    timeOrigin,
    timeScale,
    xOffset = 0,
    yOffset = 0,
    theme,
    onPan,
    onZoom,
    onClick, // TODO: the 3 last handlers are custom and need to be extracted but are not used for now
    onHoveredChildUpdate,
    onMouseMove,
    ...attr
  } = props;

  // TODO: remove this console.info once interactions are implemented and handlers are used
  console.info(onClick, onMouseMove, onHoveredChildUpdate);

  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [canvasesRoot, setCanvasesRoot] = useState<HTMLDivElement | null>(null);
  const fullTheme = useMemo(() => ({ ...DEFAULT_THEME, ...theme }), [theme]);
  const { width, height } = useSize(root);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        levelCrossingsOccupancies,
        width,
        height,
        timeOrigin,
        timeScale,
        xOffset,
        yOffset,
      }),
    [levelCrossingsOccupancies, width, height, timeOrigin, timeScale, xOffset, yOffset]
  );

  const pickingState = useMemo(() => {
    const pickingElements: PickingElement[] = [];
    const resetPickingElements = () => {
      pickingElements.length = 0;
    };
    const registerPickingElement = (element: PickingElement) => {
      pickingElements.push(element);
      return pickingElements.length - 1;
    };
    return {
      pickingElements,
      resetPickingElements,
      registerPickingElement,
    };
  }, []);

  const contextState: ChronogramContextType = useMemo(() => {
    const getTimePixel = getTimeToPixel(timeOrigin, xOffset, timeScale);
    const getTime = getPixelToTime(timeOrigin, xOffset, timeScale);

    // TODO: Check and fix those functions once we introduce mouse interactions
    const getData = (point: Point) => ({ time: point.x, position: point.y });
    const getPoint = ({ time, position }: DataPoint) =>
      ({
        x: getTimePixel(time),
        y: position,
      }) as Point;

    return {
      ...pickingState,
      fingerprint,
      width,
      height,
      getTimePixel,
      getTime,
      getData,
      getPoint,
      levelCrossingsOccupancies,
      timeOrigin,
      timeScale,
      timePixelOffset: xOffset,
      yPixelOffset: yOffset,
      theme: fullTheme,
      captionSize: fullTheme.dateCaptionsSize + fullTheme.timeCaptionsSize,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, pickingState, fullTheme]);

  const mouseState = useMouseTracking(root);
  const { position, down, isHover } = mouseState;
  const { canvasContext } = useCanvas(canvasesRoot, contextState, position);

  const mouseContext = useMemo<MouseContextType>(
    () => ({
      down,
      isHover,
      position: mouseState.position,
      hoveredItem: null,
      data: contextState.getData(mouseState.position),
    }),
    [mouseState.position, down, isHover, contextState]
  );

  // Handle interactions:
  useMouseInteractions(root, mouseContext, { onPan, onZoom }, contextState);

  // Check theme validity:
  useEffect(() => {
    validateTheme(fullTheme);
  }, [fullTheme]);

  return (
    <div
      {...attr}
      ref={setRoot}
      className={cx('relative h-full', attr.className)}
      style={{ background: fullTheme.background }}
    >
      <div ref={setCanvasesRoot} className="absolute inset-0">
        <ChronogramContext.Provider value={contextState}>
          <TimeChartCanvasContext.Provider value={canvasContext}>
            <MouseContext.Provider value={mouseContext}>
              <TimeGraduations />
              <TimeCaptions />
              <OccupancyBlocksLayer />
            </MouseContext.Provider>
          </TimeChartCanvasContext.Provider>
        </ChronogramContext.Provider>
      </div>
    </div>
  );
};
