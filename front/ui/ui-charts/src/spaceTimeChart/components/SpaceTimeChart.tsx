import React, { useEffect, useMemo, useState } from 'react';

import cx from 'classnames';

import { MouseContext, TimeChartCanvasContext } from '../../common/context';
import { getTimeToPixel, getPixelToTime } from '../../common/helpers/time';
import { useCanvas } from '../../common/hooks/useCanvas';
import { useMouseInteractions } from '../../common/hooks/useMouseInteractions';
import { useMouseTracking } from '../../common/hooks/useMouseTracking';
import { useSize } from '../../common/hooks/useSize';
import { TimeCaptions } from '../../common/layers/TimeCaptions';
import TimeGraduations from '../../common/layers/TimeGraduations';
import type { MouseContextType } from '../../common/types';
import { DEFAULT_THEME } from '../lib/consts';
import { SpaceTimeChartCanvasContext, SpaceTimeChartContext } from '../lib/context';
import { validateTheme } from '../lib/theme';
import type { SpaceTimeChartContextType, SpaceTimeChartProps } from '../lib/types';
import {
  getDataToPoint,
  getFlatSteps,
  getPixelToSpace,
  getPointToData,
  getSpaceToPixel,
  spaceScalesToBinaryTree,
} from '../utils/scales';
import { snapPosition } from '../utils/snapping';
import SpaceGraduations from './SpaceGraduations';

export const SpaceTimeChart = (props: SpaceTimeChartProps) => {
  const {
    operationalPoints,
    spaceOrigin,
    spaceScales,
    timeOrigin,
    timeScale,
    xOffset = 0,
    yOffset = 0,
    swapAxis,
    onHoveredChildUpdate,
    children,
    additionalChildren,
    enableSnapping,
    hideTimeCaptions,
    hideGrid,
    hidePathsLabels,
    showTicks,
    hideDates,
    hourlyMode,
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
        operationalPoints,
        width,
        height,
        spaceOrigin,
        spaceScales,
        timeOrigin,
        timeScale,
        xOffset,
        yOffset,
        swapAxis,
        hideTimeCaptions,
        hideGrid,
        hidePathsLabels,
        showTicks,
        hideDates,
        hourlyMode,
      }),
    [
      operationalPoints,
      width,
      height,
      spaceOrigin,
      spaceScales,
      timeOrigin,
      timeScale,
      xOffset,
      yOffset,
      swapAxis,
      hideTimeCaptions,
      hideGrid,
      hidePathsLabels,
      showTicks,
      hideDates,
      hourlyMode,
    ]
  );

  const contextState: SpaceTimeChartContextType = useMemo(() => {
    const spaceScaleTree = spaceScalesToBinaryTree(spaceOrigin, spaceScales);
    const flatSteps = getFlatSteps(spaceScales);
    const timeAxis = !swapAxis ? 'x' : 'y';
    const spaceAxis = !swapAxis ? 'y' : 'x';

    // Data translation helpers:
    let timePixelOffset;
    let spacePixelOffset;

    if (!swapAxis) {
      timePixelOffset = xOffset;
      spacePixelOffset = yOffset;
    } else {
      timePixelOffset = yOffset;
      spacePixelOffset = xOffset;
    }

    const getTimePixel = getTimeToPixel(timeOrigin, timePixelOffset, timeScale);
    const getSpacePixel = getSpaceToPixel(spacePixelOffset, spaceScaleTree);
    const getPoint = getDataToPoint(getTimePixel, getSpacePixel, timeAxis, spaceAxis);
    const getTime = getPixelToTime(timeOrigin, timePixelOffset, timeScale);
    const getSpace = getPixelToSpace(spacePixelOffset, spaceScaleTree);
    const getData = getPointToData(getTime, getSpace, timeAxis, spaceAxis);

    return {
      fingerprint,
      width,
      height,
      getTimePixel,
      getSpacePixel,
      getPoint,
      getTime,
      getSpace,
      getData,
      operationalPoints,
      spaceOrigin,
      spaceScaleTree,
      flatSteps,
      timeOrigin,
      timeScale,
      timePixelOffset,
      yPixelOffset: spacePixelOffset,
      timeAxis,
      spaceAxis,
      swapAxis: !!swapAxis,
      enableSnapping: !!enableSnapping,
      hideTimeCaptions: !!hideTimeCaptions,
      hideGrid: !!hideGrid,
      hidePathsLabels: !!hidePathsLabels,
      showTicks: !!showTicks,
      hideDates: !!hideDates || !!hourlyMode,
      hourlyMode: !!hourlyMode,
      theme: fullTheme,
      captionSize:
        hideDates || hourlyMode
          ? fullTheme.timeCaptionsSize
          : fullTheme.dateCaptionsSize + fullTheme.timeCaptionsSize,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const mouseState = useMouseTracking(root);
  const { position, down, isHover } = mouseState;
  const { canvasContext, hoveredItem } = useCanvas(canvasesRoot, contextState, position);

  const mouseContext = useMemo<MouseContextType>(() => {
    const snappedPosition = enableSnapping
      ? snapPosition(mouseState.position, hoveredItem)
      : mouseState.position;

    return {
      down,
      isHover,
      position: snappedPosition,
      hoveredItem: hoveredItem,
      data: contextState.getData(snappedPosition),
    };
  }, [enableSnapping, mouseState.position, hoveredItem, down, isHover, contextState]);

  // Handle interactions:
  useMouseInteractions(root, mouseContext, { onPan, onZoom, onClick, onMouseMove }, contextState);

  // Handle onHoveredChildUpdate:
  useEffect(() => {
    if (onHoveredChildUpdate) {
      onHoveredChildUpdate({ item: hoveredItem, context: contextState });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredItem]);

  // Check theme validity:
  useEffect(() => {
    validateTheme(fullTheme);
  }, [fullTheme]);

  return (
    <div
      {...attr}
      ref={setRoot}
      className={cx('relative space-time-chart', attr.className)}
      style={{ background: fullTheme.background }}
    >
      <div ref={setCanvasesRoot} className="absolute inset-0" />
      <SpaceTimeChartContext.Provider value={contextState}>
        {/* TODO: Finish refactorization to use only 1 canvas context */}
        <SpaceTimeChartCanvasContext.Provider value={canvasContext}>
          <TimeChartCanvasContext.Provider value={canvasContext}>
            <MouseContext.Provider value={mouseContext}>
              {!hideGrid && (
                <>
                  <SpaceGraduations />
                  <TimeGraduations />
                  <TimeCaptions />
                </>
              )}
              {children}
              {additionalChildren}
            </MouseContext.Provider>
          </TimeChartCanvasContext.Provider>
        </SpaceTimeChartCanvasContext.Provider>
      </SpaceTimeChartContext.Provider>
    </div>
  );
};
