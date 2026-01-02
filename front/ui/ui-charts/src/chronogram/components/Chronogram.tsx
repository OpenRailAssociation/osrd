import React, { useEffect, useMemo, useRef, useState } from 'react';

import cx from 'classnames';

import ChronogramManchette from './ChronogramManchette';
import { BaseChartCanvasContext } from '../../common/context';
import { getTimeToPixel, getPixelToTime } from '../../common/helpers/utils';
import { useCanvas } from '../../common/hooks/useCanvas';
import { useSize } from '../../common/hooks/useSize';
import { TimeCaptions } from '../../common/layers/TimeCaptions';
import { TimeGraduations } from '../../common/layers/TimeGraduations';
import type { PickingElement, Point } from '../../common/types';
import { useMouseInteractions } from '../../spaceTimeChart/hooks/useMouseInteractions';
import { useMouseTracking } from '../../spaceTimeChart/hooks/useMouseTracking';
import { DEFAULT_THEME } from '../../spaceTimeChart/lib/consts';
import { MouseContext } from '../../spaceTimeChart/lib/context';
import { validateTheme } from '../../spaceTimeChart/lib/theme';
import { type DataPoint, type MouseContextType } from '../../spaceTimeChart/lib/types';
import { ChronogramContext } from '../lib/context';
import { type ChronogramContextType, type ChronogramProps } from '../lib/types';

export const Chronogram = (props: ChronogramProps) => {
  const {
    levelCrossingsNames,
    levelCrossingsOccupancies,
    timeOrigin,
    timeScale,
    xOffset = 0,
    yOffset = 0,
    theme,
    onPan,
    onZoom,
    onClick,
    onMouseMove,
    ...attr
  } = props;

  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [canvasesRoot, setCanvasesRoot] = useState<HTMLDivElement | null>(null);
  const fullTheme = useMemo(() => ({ ...DEFAULT_THEME, ...theme }), [theme]);
  const { width, height } = useSize(root);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        levelCrossingsNames,
        levelCrossingsOccupancies,
        width,
        height,
        timeOrigin,
        timeScale,
        xOffset,
        yOffset,
      }),
    [
      levelCrossingsNames,
      levelCrossingsOccupancies,
      width,
      height,
      timeOrigin,
      timeScale,
      xOffset,
      yOffset,
    ]
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
        ['x']: getTimePixel(time),
        ['y']: position,
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
      levelCrossingsNames,
      levelCrossingsOccupancies,
      timeOrigin,
      timeScale,
      timePixelOffset: xOffset,
      spacePixelOffset: yOffset,
      theme: fullTheme,
      captionSize: fullTheme.dateCaptionsSize + fullTheme.timeCaptionsSize,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, pickingState]);

  const mouseState = useMouseTracking(root);
  const { position, down, isHover } = mouseState;
  const { canvasContext, hoveredItem } = useCanvas(canvasesRoot, contextState, position);

  const mouseContext = useMemo<MouseContextType>(
    () => ({
      down,
      isHover,
      position: mouseState.position,
      hoveredItem: hoveredItem,
      data: contextState.getData(mouseState.position),
    }),
    [mouseState.position, hoveredItem, down, isHover, contextState]
  );

  // Handle interactions:
  useMouseInteractions(root, mouseContext, { onPan, onZoom, onClick, onMouseMove }, contextState);

  // Check theme validity:
  useEffect(() => {
    validateTheme(fullTheme);
  }, [fullTheme]);
  const chronogramChartRef = useRef<HTMLDivElement>(null);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const content = [
    'Level Crossing A',
    'Level Crossing B',
    'Level Crossing C',
    'Level Crossing D',
    'Level Crossing E',
    'Level Crossing F',
    'Level Crossing G',
    'Level Crossing H',
    'Level Crossing I',
    'Level Crossing J',
    'Level Crossing K',
    'Level Crossing L',
  ];

  return (
    <div className="ui-chronogram">
      <div ref={manchetteWithSpaceTimeChartRef} className="chronogram-container flex">
        <ChronogramManchette contents={content} />
        <div ref={chronogramChartRef} className="chronogram-manchette-container">
          <div
            {...attr}
            ref={setRoot}
            className={cx('relative', attr.className)}
            style={{ background: fullTheme.background }}
          >
            <div ref={setCanvasesRoot} className="absolute inset-0">
              <ChronogramContext.Provider value={contextState}>
                <BaseChartCanvasContext.Provider value={canvasContext}>
                  <MouseContext.Provider value={mouseContext}>
                    <TimeGraduations />
                    <TimeCaptions />
                  </MouseContext.Provider>
                </BaseChartCanvasContext.Provider>
              </ChronogramContext.Provider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
