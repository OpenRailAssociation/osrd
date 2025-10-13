import React, { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { sortBy, clamp } from 'lodash';

import {
  getCrispLineCoordinate,
  type SpaceScale,
  type SpaceTimeChartProps,
} from '../../spaceTimeChart';
import {
  getSpaceToPixel,
  sideOffset,
  spaceScalesToBinaryTree,
} from '../../spaceTimeChart/utils/scales';
import type { ManchetteProps } from '../components/Manchette';
import {
  MAX_ZOOM_Y,
  MIN_ZOOM_Y,
  ZOOM_Y_DELTA,
  DEFAULT_ZOOM_MS_PER_PX,
  MAX_ZOOM_MS_PER_PX,
  MIN_ZOOM_MS_PER_PX,
  BASE_WAYPOINT_HEIGHT,
  FOOTER_HEIGHT,
  WAYPOINT_LINE_HEIGHT,
  INITIAL_SPACE_TIME_CHART_HEIGHT,
} from '../consts';
import type { InteractiveWaypoint, Waypoint } from '../types';
import { getDistance, calcTotalDistance } from '../utils';
import {
  selectWaypointsToDisplay,
  getScales,
  timeScaleToZoomValue,
  spaceScaleToZoomValue,
  getExtremaScales,
  zoomValueToSpaceScale,
  zoomValueToTimeScale,
  zoomX,
} from '../utils/helpers';

type State = {
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
  isProportional: boolean;
  waypointsChart: Waypoint[];
  scales: SpaceScale[];
};

export type SplitPoint = {
  /** helper identify nodes for this split point in the React tree */
  id: string;
  /** position of this split point, in mm from start */
  position: number;
  /** size of this split point, in pixels on screen */
  size: number;
  /** a React node to render the split point, space/time chart side */
  spaceTimeChartNode?: ReactNode;
  /** a React node to render the split point, manchette side */
  manchetteNode?: ReactNode;
};

export type ManchetteWithSpaceTimeChartOptions = {
  displayTimeCaptions: boolean;
  enableTimePan: boolean;
  enableSpacePan: boolean;
  enableTimeZoom: boolean;
};

export const DEFAULT_MANCHETTE_WITH_SPACE_TIME_CHART_OPTIONS: ManchetteWithSpaceTimeChartOptions = {
  displayTimeCaptions: true,
  enableTimePan: true,
  enableSpacePan: true,
  enableTimeZoom: true,
};

const useManchetteWithSpaceTimeChart = ({
  waypoints,
  manchetteWithSpaceTimeChartRef,
  height = INITIAL_SPACE_TIME_CHART_HEIGHT,
  spaceTimeChartRef,
  defaultTimeOrigin = 0,
  defaultSpaceOrigin = 0,
  defaultXOffset = 0,
  verticalPadding = BASE_WAYPOINT_HEIGHT / 2,
  splitPoints = [],
  options = {},
}: {
  waypoints: Waypoint[];
  manchetteWithSpaceTimeChartRef: React.RefObject<HTMLDivElement | null>;
  height?: number;
  spaceTimeChartRef?: React.RefObject<HTMLDivElement | null>;
  defaultTimeOrigin?: number;
  defaultSpaceOrigin?: number;
  defaultXOffset?: number;
  verticalPadding?: number;
  splitPoints?: SplitPoint[];
  options?: Partial<ManchetteWithSpaceTimeChartOptions>;
}) => {
  const { displayTimeCaptions, enableTimePan, enableSpacePan, enableTimeZoom } = useMemo(
    () => ({
      ...DEFAULT_MANCHETTE_WITH_SPACE_TIME_CHART_OPTIONS,
      ...options,
    }),
    [options]
  );
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [state, setState] = useState<State>({
    xZoom: timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX),
    yZoom: 1,
    timeOrigin: defaultTimeOrigin,
    spaceOrigin: defaultSpaceOrigin,
    xOffset: defaultXOffset,
    yOffset: 0,
    scrollTo: null,
    panning: null,
    zoomMode: false,
    rect: null,
    pixelRect: null,
    isProportional: true,
    waypointsChart: [],
    scales: [],
  });

  const {
    xZoom,
    yZoom,
    timeOrigin,
    spaceOrigin,
    xOffset,
    yOffset,
    scrollTo,
    panning,
    zoomMode,
    rect,
    isProportional,
  } = state;

  /** used when we change the train dataset for example to center the chart on the new data */
  const setTimeOrigin = useCallback((newTimeOrigin: number) => {
    setState((prev) => ({ ...prev, timeOrigin: newTimeOrigin }));
  }, []);

  const canvasDrawingHeight = Math.max(1 + BASE_WAYPOINT_HEIGHT, height - FOOTER_HEIGHT); // 521
  const drawingHeightWithoutTopPadding = canvasDrawingHeight - BASE_WAYPOINT_HEIGHT / 2; // 505
  const drawingHeightWithoutBothPadding = canvasDrawingHeight - BASE_WAYPOINT_HEIGHT; // 489
  const totalDistance = calcTotalDistance(waypoints);

  const { minZoomMillimeterPerPx, maxZoomMillimeterPerPx } = getExtremaScales(
    drawingHeightWithoutTopPadding,
    drawingHeightWithoutBothPadding,
    totalDistance
  );

  const handleRectZoomEnd = useCallback(
    (prev: State) => {
      if (!prev.rect || !spaceTimeChartRef?.current) {
        return {};
      }

      const { timeStart, timeEnd, spaceStart, spaceEnd } = prev.rect;
      const timeRange = Math.abs(Number(timeEnd) - Number(timeStart)); // width of rect in ms
      const spaceRange = Math.abs(spaceEnd - spaceStart); // height of rect in mm

      const chosenTimeScale = timeRange / spaceTimeChartRef.current.clientWidth;
      const newTimeScale = clamp(chosenTimeScale, MAX_ZOOM_MS_PER_PX, MIN_ZOOM_MS_PER_PX);
      const newXZoom = timeScaleToZoomValue(newTimeScale);
      const newXOffset = sideOffset(
        prev.timeOrigin,
        newTimeScale,
        prev.rect.timeStart,
        prev.rect.timeEnd,
        spaceTimeChartRef.current.clientWidth
      );

      let newYZoom = prev.yZoom;
      let newYOffset = prev.yOffset;

      if (prev.isProportional) {
        const chosenSpaceScale = spaceRange / drawingHeightWithoutTopPadding;
        const newSpaceScale = clamp(
          chosenSpaceScale,
          maxZoomMillimeterPerPx,
          minZoomMillimeterPerPx
        );
        // we don’t need to handle this case and compute an offset
        // this condition happens when we draw a rectangle
        // larger than the entire chart (minus padding)
        // that would actually zoom OUT if it wasn’t clamped.
        if (newSpaceScale !== minZoomMillimeterPerPx) {
          newYZoom = spaceScaleToZoomValue(
            minZoomMillimeterPerPx,
            maxZoomMillimeterPerPx,
            newSpaceScale
          );
          newYOffset = Math.abs(
            sideOffset(
              prev.spaceOrigin,
              newSpaceScale,
              prev.rect.spaceStart,
              prev.rect.spaceEnd,
              height,
              verticalPadding
            )
          );
        }
      } else if (prev.pixelRect) {
        const currentStopHeight = BASE_WAYPOINT_HEIGHT * prev.yZoom;
        const { yStart, yEnd } = prev.pixelRect;
        const numberOfStopsInRect = Math.abs(yEnd - yStart) / currentStopHeight;
        let newStopHeight = drawingHeightWithoutTopPadding / numberOfStopsInRect;
        // at maximum zoom, we want 3 stops displayed
        const maxStopHeight =
          drawingHeightWithoutTopPadding / (2 + BASE_WAYPOINT_HEIGHT / newStopHeight);
        newStopHeight = Math.min(newStopHeight, maxStopHeight);

        newYZoom = newStopHeight / BASE_WAYPOINT_HEIGHT;
        const rectTop = prev.yOffset + Math.min(yStart, yEnd) - WAYPOINT_LINE_HEIGHT;
        const numberOfStopsBeforeRectTop = rectTop / currentStopHeight;
        newYOffset = numberOfStopsBeforeRectTop * newStopHeight;
      }

      return {
        xZoom: newXZoom,
        yZoom: newYZoom,
        xOffset: newXOffset,
        yOffset: newYOffset,
        scrollTo: newYOffset,
        rect: null,
        pixelRect: null,
      };
    },
    [
      spaceTimeChartRef,
      drawingHeightWithoutTopPadding,
      maxZoomMillimeterPerPx,
      minZoomMillimeterPerPx,
      height,
      verticalPadding,
    ]
  );

  const zoomYIn = useCallback(() => {
    const maxZoom = isProportional
      ? MAX_ZOOM_Y
      : (drawingHeightWithoutTopPadding - BASE_WAYPOINT_HEIGHT) / (2 * BASE_WAYPOINT_HEIGHT);
    const newYZoom = Math.min(yZoom + ZOOM_Y_DELTA, maxZoom);
    if (newYZoom !== yZoom) {
      const newYOffset = yOffset * (newYZoom / yZoom);

      setState((prev) => ({
        ...prev,
        yZoom: newYZoom,
        yOffset: newYOffset,
        scrollTo: newYOffset,
      }));
    }
  }, [yZoom, yOffset, drawingHeightWithoutTopPadding, isProportional]);

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

  useEffect(() => {
    if (scrollTo !== null && manchetteWithSpaceTimeChartRef.current) {
      manchetteWithSpaceTimeChartRef.current.scrollTo({
        top: scrollTo,
        behavior: 'instant',
      });
    }
  }, [scrollTo, manchetteWithSpaceTimeChartRef]);

  const resetZoom = useCallback(() => {
    setState((prev) => ({ ...prev, yZoom: 1 }));
  }, []);

  const handleScroll = useCallback(
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

  const toggleMode = useCallback(() => {
    setState((prev) => ({ ...prev, isProportional: !prev.isProportional }));
  }, []);

  const toggleZoomMode = useCallback(() => {
    setState((prev) => ({ ...prev, zoomMode: !prev.zoomMode }));
  }, []);

  const handleXZoom = useCallback(
    (newXZoom: number, xPosition = (spaceTimeChartRef?.current?.offsetWidth || 0) / 2) => {
      if (enableTimeZoom)
        setState((prev) => ({
          ...prev,
          ...zoomX(prev.xZoom, prev.xOffset, newXZoom, xPosition),
        }));
    },
    [enableTimeZoom, spaceTimeChartRef]
  );

  const spaceScales = useMemo(() => {
    // Here, we first compute the base scales, and then we insert a flat step for each split point:
    const baseScales = getScales(
      waypoints,
      { height, isProportional, yZoom },
      minZoomMillimeterPerPx,
      maxZoomMillimeterPerPx
    );

    if (!splitPoints) return baseScales;

    // Constant scale:
    if (isProportional) {
      if (baseScales.length === 0) return baseScales;
      const baseScale = baseScales[0];
      const coefficient: number =
        'coefficient' in baseScale && typeof baseScale.coefficient === 'number'
          ? baseScale.coefficient
          : (baseScale.to - baseScale.from) / baseScale.size;

      return splitPoints
        .flatMap(({ position, size: splitPointHeight }) =>
          coefficient > 0
            ? [
                {
                  to: position,
                  coefficient,
                },
                {
                  to: position,
                  size: splitPointHeight,
                },
              ]
            : {
                to: position,
                size: splitPointHeight,
              }
        )
        .concat(
          coefficient
            ? {
                to: baseScales.at(-1)!.to,
                coefficient,
              }
            : []
        );
    }

    // Varying scales:
    const allScales: SpaceScale[] = [];
    baseScales.forEach((baseScale) => {
      const coefficient =
        'coefficient' in baseScale && typeof baseScale.coefficient === 'number'
          ? baseScale.coefficient
          : (baseScale.to - baseScale.from) / baseScale.size;

      // Search for split points strictly BETWEEN from and to:
      const relevantPoints = splitPoints.filter(
        (point) => point.position > baseScale.from && point.position < baseScale.to
      );

      relevantPoints.forEach(({ position }) => {
        allScales.push({
          to: position,
          coefficient,
        });
      });

      allScales.push({
        to: baseScale.to,
        coefficient,
      });
    });

    splitPoints.forEach((point) => {
      allScales.push({
        to: point.position,
        size: point.size,
      });
    });

    return sortBy(
      allScales.filter((scale) =>
        'coefficient' in scale ? scale.coefficient > 0 : isFinite(scale.size)
      ),
      (scale) => scale.to + ('size' in scale ? Number.EPSILON : 0)
    );
  }, [
    waypoints,
    height,
    isProportional,
    yZoom,
    minZoomMillimeterPerPx,
    maxZoomMillimeterPerPx,
    splitPoints,
  ]);

  const waypointsToDisplay = useMemo(
    () =>
      selectWaypointsToDisplay(waypoints, {
        height,
        isProportional,
        yZoom,
      }),
    [waypoints, height, isProportional, yZoom]
  );

  const { manchetteContents, manchetteHeight } = useMemo(() => {
    const spaceScaleTree = spaceScalesToBinaryTree(spaceOrigin, spaceScales);
    const getSpacePixel = getSpaceToPixel(0, spaceScaleTree);
    let totalManchetteHeight = height - FOOTER_HEIGHT;
    if (spaceScales.length > 0) {
      totalManchetteHeight = Math.max(
        totalManchetteHeight,
        getSpacePixel(spaceScales.at(-1)!.to, true) + verticalPadding * 2
      );
    }

    // Identify all manchette contents (split sections and waypoints):
    const splitPointPositions = new Set(splitPoints.map((point) => point.position) || []);
    let allContents: (
      | { type: 'waypoint'; position: number; waypoint: Waypoint }
      | { type: 'splitSection'; position: number; split: SplitPoint }
    )[] = waypointsToDisplay
      .filter((wp) => !splitPointPositions.has(wp.position))
      .map((wp) => ({
        type: 'waypoint',
        waypoint: wp,
        position: wp.position,
      }));
    allContents = allContents.concat(
      splitPoints.map((sp) => ({
        type: 'splitSection',
        split: sp,
        position: sp.position,
      }))
    );

    // Sort all contents by position:
    const allSortedContents = sortBy(allContents, 'position');

    // In practice, waypoint lines are 0.5px wide only when devicePixelRatio is at least 2 (as it's
    // implemented at the end of waypoint.css). But to get the proper alignment, we always consider
    // it to be 0.5px wide here, because they always have this thickness SpaceTimeChart side:
    const waypointLinesThickness = 0.5;

    // Iterate over all contents, to set each split section's style, and correct waypoints styles
    // accordingly:
    const finalContents: (InteractiveWaypoint | ReactNode)[] = [];
    allSortedContents.forEach((content) => {
      switch (content.type) {
        case 'waypoint': {
          finalContents.push({
            ...content.waypoint,
            styles: {
              position: 'absolute',
              top: `${getCrispLineCoordinate(getSpacePixel(content.position), waypointLinesThickness)}px`,
              height: `${BASE_WAYPOINT_HEIGHT}px`,
            },
          });
          break;
        }
        case 'splitSection': {
          const {
            split: { position },
          } = content;

          const top = getSpacePixel(position);
          finalContents.push(
            <div
              style={{
                // This verticalPadding correction is there because:
                // - Waypoints are positioned so that their lines (at verticalPadding pixels from
                //   the top) are aligned with SpaceTimeChart's space lines
                // - Split points are positioned so that their top is aligned with SpaceTimeChart's
                //   space lines
                top: `${top + verticalPadding}px`,
                height: `${getSpacePixel(position, true) - top}px`,
                position: 'absolute',
                width: '100%',
              }}
            >
              {content.split.manchetteNode}
            </div>
          );
          break;
        }
      }
    });

    return {
      manchetteHeight: totalManchetteHeight,
      manchetteContents: finalContents,
    };
  }, [spaceOrigin, spaceScales, verticalPadding, height, splitPoints, waypointsToDisplay]);

  return useMemo<{
    manchetteProps: ManchetteProps;
    spaceTimeChartProps: SpaceTimeChartProps;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    handleXZoom: (newXZoom: number, xPosition?: number) => void;
    xZoom: number;
    toggleZoomMode: () => void;
    zoomMode: boolean;
    rect: State['rect'];
    timeScale: number;
    spaceScale: number;
    setTimeOrigin: (v: number) => void;
  }>(
    () => ({
      manchetteProps: {
        contents: manchetteContents,
        height: manchetteHeight,
        zoomYIn,
        zoomYOut,
        resetZoom,
        toggleMode,
        yZoom,
        isProportional,
        yOffset,
      },
      spaceTimeChartProps: {
        operationalPoints: waypointsToDisplay.map((waypoint) => ({
          ...waypoint,
          importanceLevel: 1,
        })),
        additionalChildren: splitPoints.map((sp, i) => (
          <Fragment key={i}>{sp.spaceTimeChartNode}</Fragment>
        )),
        hideTimeCaptions: !displayTimeCaptions,
        timeScale: zoomValueToTimeScale(xZoom),
        xOffset,
        yOffset: -yOffset + verticalPadding,
        timeOrigin,
        spaceOrigin,
        spaceScales,
        onZoom: ({
          delta,
          position,
          event,
        }: Parameters<NonNullable<SpaceTimeChartProps['onZoom']>>[0]) => {
          if (isShiftPressed && !rect) {
            event.preventDefault();
            handleXZoom(xZoom + delta, position.x);
          }
        },
        onPan: (payload: Parameters<NonNullable<SpaceTimeChartProps['onPan']>>[0]) => {
          const {
            initialData,
            data,
            initialPosition,
            position,
            isPanning,
            context: { width, getData },
          } = payload;
          const diff = getDistance(initialPosition, position);
          setState((prev) => {
            if (!isPanning) {
              return {
                ...prev,
                ...(prev.zoomMode && prev.rect ? handleRectZoomEnd(prev) : {}),
                panning: null,
                zoomMode: false,
              };
            }

            if (zoomMode) {
              const minPoint = getData({ x: 0, y: 0 });
              const maxPoint = getData({ x: width, y: canvasDrawingHeight });
              const timeStart = clamp(initialData.time, minPoint.time, maxPoint.time);
              const timeEnd = clamp(data.time, minPoint.time, maxPoint.time);
              const spaceStart = clamp(initialData.position, minPoint.position, maxPoint.position);
              const spaceEnd = clamp(data.position, minPoint.position, maxPoint.position);
              const newRect: State['rect'] = {
                timeStart: new Date(timeStart),
                timeEnd: new Date(timeEnd),
                spaceStart,
                spaceEnd,
              };

              let newPixelRect: State['pixelRect'] = null;
              if (!isProportional) {
                const xStart = clamp(initialPosition.x, 0, width);
                const xEnd = clamp(position.x, 0, width);
                const yStart = clamp(initialPosition.y, 0, canvasDrawingHeight);
                const yEnd = clamp(position.y, 0, canvasDrawingHeight);
                newPixelRect = { xStart, xEnd, yStart, yEnd };
              }

              return {
                ...prev,
                rect: newRect,
                pixelRect: newPixelRect,
              };
            }

            if (!panning) {
              return {
                ...prev,
                panning: { initialOffset: { x: xOffset, y: yOffset } },
              };
            }

            const newState = { ...prev };
            const { initialOffset } = panning;
            const manchette = manchetteWithSpaceTimeChartRef.current;

            if (enableTimePan) {
              newState.xOffset = initialOffset.x + diff.x;
            }
            if (enableSpacePan) {
              let newYOffset = initialOffset.y - diff.y;
              newYOffset = Math.max(newYOffset, 0);
              if (manchette) {
                newYOffset = Math.min(newYOffset, manchette.scrollHeight - manchette.offsetHeight);
                manchette.scrollTop = newYOffset;
              }
              newState.yOffset = newYOffset;
            }

            return newState;
          });
        },
      },
      handleScroll,
      handleXZoom,
      xZoom,
      toggleZoomMode,
      zoomMode,
      rect,
      timeScale: zoomValueToTimeScale(xZoom),
      spaceScale: zoomValueToSpaceScale(minZoomMillimeterPerPx, maxZoomMillimeterPerPx, yZoom),
      setTimeOrigin,
    }),
    [
      manchetteContents,
      manchetteHeight,
      zoomYIn,
      zoomYOut,
      resetZoom,
      toggleMode,
      yZoom,
      isProportional,
      yOffset,
      waypointsToDisplay,
      splitPoints,
      displayTimeCaptions,
      xZoom,
      xOffset,
      verticalPadding,
      timeOrigin,
      spaceOrigin,
      spaceScales,
      handleScroll,
      handleXZoom,
      toggleZoomMode,
      zoomMode,
      rect,
      minZoomMillimeterPerPx,
      maxZoomMillimeterPerPx,
      setTimeOrigin,
      isShiftPressed,
      panning,
      manchetteWithSpaceTimeChartRef,
      enableTimePan,
      enableSpacePan,
      handleRectZoomEnd,
      canvasDrawingHeight,
    ]
  );
};

export default useManchetteWithSpaceTimeChart;
