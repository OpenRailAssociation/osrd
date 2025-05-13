import React, { useCallback, useEffect, useState } from 'react';

import {
  PathLayer,
  SpaceTimeChart,
  ZoomRect,
  type Point,
  type PathData,
  type OperationalPoint,
  DEFAULT_THEME,
  type SpaceScale,
  computeRectZoomOffsets,
} from '@osrd-project/ui-charts';
import { Button, Slider } from '@osrd-project/ui-core';
import type { Meta } from '@storybook/react-vite';
import { clamp } from 'lodash';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';
import './styles/rectangle-zoom.css';

import { MouseTracker } from './helpers/components';
import { KILOMETER } from './helpers/consts';
import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { getDiff } from './helpers/utils';

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 500;

const MIN_ZOOM = 0;
const MAX_ZOOM = 100;
// The time zoom boundaries are expressed in milliseconds / pixel:
const MIN_ZOOM_MS_PER_PX = 600000;
const MAX_ZOOM_MS_PER_PX = 625;
const DEFAULT_ZOOM_MS_PER_PX = 10000;
// The space zoom boundaries are expressed in millimeters / pixel:
const MIN_SPACE_ZOOM = 10 * KILOMETER;
const MAX_SPACE_ZOOM = 0.01 * KILOMETER;
const DEFAULT_SPACE_ZOOM = 0.3 * KILOMETER;
type SpaceTimeHorizontalZoomWrapperProps = {
  swapAxes: boolean;
  spaceOrigin: number;
  xOffset: number;
  yOffset: number;
  operationalPoints: OperationalPoint[];
  paths: (PathData & { color: string })[];
};

const zoomValueToTimeScale = (slider: number) =>
  MIN_ZOOM_MS_PER_PX * Math.pow(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX, slider / 100);

const timeScaleToZoomValue = (timeScale: number) =>
  (100 * Math.log(timeScale / MIN_ZOOM_MS_PER_PX)) /
  Math.log(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX);

const zoomValueToSpaceScale = (slider: number) =>
  MIN_SPACE_ZOOM * Math.pow(MAX_SPACE_ZOOM / MIN_SPACE_ZOOM, slider / 100);

const spaceScaleToZoomValue = (spaceScale: number) =>
  (100 * Math.log(spaceScale / MIN_SPACE_ZOOM)) / Math.log(MAX_SPACE_ZOOM / MIN_SPACE_ZOOM);

type StoryState = {
  timeZoomValue: number;
  spaceZoomValue: number;
  xOffset: number;
  yOffset: number;
  panning: null | { initialOffset: Point };
  zoomMode: boolean;
  rect: {
    timeStart: Date;
    timeEnd: Date;
    spaceStart: number; // mm
    spaceEnd: number; // mm
  } | null;
};

/**
 * This story demonstrates the behavior of drawing a rectangle with the mouse, and how it should behave in regards to the default zoom and pan.
 */
const RectangleZoomWrapper = ({
  swapAxes,
  spaceOrigin,
  xOffset,
  yOffset,
  operationalPoints = [],
  paths = [],
}: SpaceTimeHorizontalZoomWrapperProps) => {
  const [state, setState] = useState<StoryState>({
    timeZoomValue: timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX),
    spaceZoomValue: spaceScaleToZoomValue(DEFAULT_SPACE_ZOOM),
    xOffset,
    yOffset,
    panning: null,
    zoomMode: false,
    rect: null,
  });

  const timeOrigin = +new Date('2024-04-02T00:00:00');
  const timeScale = zoomValueToTimeScale(state.timeZoomValue);
  const spaceScale: SpaceScale[] = [
    {
      to: 100 * KILOMETER,
      coefficient: zoomValueToSpaceScale(state.spaceZoomValue), // meter/px
    },
  ];

  useEffect(() => {
    setState((prev) => ({ ...prev, xOffset }));
  }, [xOffset]);
  useEffect(() => {
    setState((prev) => ({ ...prev, yOffset }));
  }, [yOffset]);

  const handleRectangleZoom = useCallback(
    ({
      scales: { chosenTimeScale, chosenSpaceScale },
      overrideState,
    }: {
      scales: { chosenTimeScale: number; chosenSpaceScale: number };
      overrideState?: Partial<StoryState>;
    }) => {
      setState((prev) => {
        if (prev.zoomMode || !prev.rect) {
          return prev;
        }

        const newTimeScale = clamp(chosenTimeScale, MAX_ZOOM_MS_PER_PX, MIN_ZOOM_MS_PER_PX);
        const newSpaceScale = clamp(chosenSpaceScale, MAX_SPACE_ZOOM, MIN_SPACE_ZOOM);
        const timeZoomValue = timeScaleToZoomValue(newTimeScale);
        const spaceZoomValue = spaceScaleToZoomValue(newSpaceScale);

        if (!swapAxes) {
          const { xOffset: newXOffset, yOffset: newYOffset } = computeRectZoomOffsets({
            rect: prev.rect,
            timeOrigin,
            spaceOrigin,
            newTimeScale,
            newSpaceScale,
            swapAxes,
            chartWidth: DEFAULT_WIDTH,
            chartHeight: DEFAULT_HEIGHT,
          });

          return {
            ...prev,
            timeZoomValue: timeZoomValue,
            spaceZoomValue: spaceZoomValue,
            xOffset: newXOffset,
            yOffset: newYOffset,
            ...overrideState,
          };
        } else {
          const { xOffset: newXOffset, yOffset: newYOffset } = computeRectZoomOffsets({
            rect: prev.rect,
            timeOrigin,
            spaceOrigin,
            newTimeScale,
            newSpaceScale,
            swapAxes,
            chartWidth: DEFAULT_WIDTH,
            chartHeight: DEFAULT_HEIGHT,
          });

          return {
            ...prev,
            timeZoomValue: timeZoomValue,
            spaceZoomValue: spaceZoomValue,
            xOffset: newXOffset,
            yOffset: newYOffset,
            ...overrideState,
          };
        }
      });
    },
    [swapAxes, timeOrigin, spaceOrigin]
  );

  const handleZoom = useCallback(
    ({
      timeZoom = state.timeZoomValue,
      spaceZoom = state.spaceZoomValue,
      centerPosition: { centerX, centerY } = {
        centerX: DEFAULT_WIDTH / 2,
        centerY: DEFAULT_HEIGHT / 2,
      },
    }: {
      timeZoom?: number;
      spaceZoom?: number;
      centerPosition?: { centerX: number; centerY: number };
    }) => {
      setState((prev) => {
        if (!(timeZoom && spaceZoom)) {
          return prev;
        }

        const oldTimeScale = zoomValueToTimeScale(prev.timeZoomValue);
        const oldSpaceScale = zoomValueToSpaceScale(prev.spaceZoomValue);

        const boundedTimeZoom = clamp(timeZoom, MIN_ZOOM, MAX_ZOOM); // clamp to [0; 100]
        const boundedSpaceZoom = clamp(spaceZoom, MIN_ZOOM, MAX_ZOOM); // clamp to [0; 100]
        const newTimeScale = zoomValueToTimeScale(boundedTimeZoom);
        const newSpaceScale = zoomValueToSpaceScale(boundedSpaceZoom);
        const newXOffset = !swapAxes
          ? centerX - ((centerX - prev.xOffset) * oldTimeScale) / newTimeScale
          : centerX - ((centerX - prev.xOffset) * oldSpaceScale) / newSpaceScale;
        const newYOffset = !swapAxes
          ? centerY - ((centerY - prev.yOffset) * oldSpaceScale) / newSpaceScale
          : centerY - ((centerY - prev.yOffset) * oldTimeScale) / newTimeScale;

        return {
          ...prev,
          timeZoomValue: boundedTimeZoom,
          spaceZoomValue: boundedSpaceZoom,
          xOffset: newXOffset,
          yOffset: newYOffset,
        };
      });
    },
    [swapAxes, state.timeZoomValue, state.spaceZoomValue]
  );

  useEffect(() => {
    if (state.rect && !state.zoomMode) {
      const { timeStart, timeEnd, spaceStart, spaceEnd } = state.rect;
      const timeRange = Math.abs(Number(timeEnd) - Number(timeStart)); // width of rect in ms
      const spaceRange = Math.abs(spaceEnd - spaceStart); // height of rect in meter
      const chosenTimeScale = !swapAxes ? timeRange / DEFAULT_WIDTH : timeRange / DEFAULT_HEIGHT;
      const captionSize = DEFAULT_THEME.dateCaptionsSize + DEFAULT_THEME.timeCaptionsSize;
      const chosenSpaceScale = !swapAxes
        ? spaceRange / (DEFAULT_HEIGHT - captionSize)
        : spaceRange / (DEFAULT_WIDTH - captionSize);
      handleRectangleZoom({
        scales: { chosenTimeScale, chosenSpaceScale },
        overrideState: { rect: null },
      });
    }
  }, [state.rect, state.zoomMode, swapAxes, handleRectangleZoom]);

  function handleReset(axis: 'x' | 'y') {
    if (axis === 'x') {
      setState((prev) => ({
        ...prev,
        ...(!swapAxes
          ? { timeZoomValue: timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX) }
          : { spaceZoomValue: spaceScaleToZoomValue(DEFAULT_SPACE_ZOOM) }),
        xOffset: 0,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        ...(!swapAxes
          ? { spaceZoomValue: spaceScaleToZoomValue(DEFAULT_SPACE_ZOOM) }
          : { timeZoomValue: timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX) }),
        yOffset: 0,
      }));
    }
  }
  const simpleOperationalPoints = operationalPoints.map(({ id, position }) => ({
    id,
    label: id,
    position,
  }));

  return (
    <div
      className="rectangle-zoom-story-wrapper absolute m-4"
      style={{
        height: `${DEFAULT_HEIGHT}px`,
        width: `${DEFAULT_WIDTH}px`,
      }}
    >
      <SpaceTimeChart
        className="inset-0 h-full"
        spaceOrigin={spaceOrigin}
        swapAxis={swapAxes}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        timeOrigin={timeOrigin}
        operationalPoints={simpleOperationalPoints}
        timeScale={timeScale}
        spaceScales={spaceScale}
        onZoom={({ delta, position: { x, y } }) => {
          handleZoom({
            timeZoom: state.timeZoomValue + delta,
            spaceZoom: state.spaceZoomValue + delta,
            centerPosition: { centerX: x, centerY: y },
          });
        }}
        onPan={({ initialPosition, position, isPanning, data, initialData }) => {
          const diff = getDiff(initialPosition, position);
          setState((prev) => {
            // when releasing the mouse, onPan is called one last time with isPanning false
            if (!isPanning) {
              return { ...prev, panning: null, zoomMode: false };
            }
            if (state.zoomMode) {
              const rect = {
                timeStart: new Date(initialData.time),
                timeEnd: new Date(data.time),
                spaceStart: initialData.position,
                spaceEnd: data.position,
              };

              return {
                ...prev,
                rect,
              };
            }
            // Start panning:
            else if (!prev.panning) {
              return {
                ...prev,
                panning: {
                  initialOffset: {
                    x: prev.xOffset,
                    y: prev.yOffset,
                  },
                },
              };
            }
            // Keep panning:
            else {
              const { initialOffset } = prev.panning;
              return {
                ...prev,
                xOffset: initialOffset.x + diff.x,
                yOffset: initialOffset.y + diff.y,
              };
            }
          });
        }}
      >
        {paths.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
        {state.rect && (
          <ZoomRect
            timeStart={state.rect.timeStart}
            timeEnd={state.rect.timeEnd}
            spaceStart={state.rect.spaceStart}
            spaceEnd={state.rect.spaceEnd}
          />
        )}
        <MouseTracker
          reference={
            state.rect
              ? { time: Number(state.rect?.timeStart), position: state.rect?.spaceStart }
              : undefined
          }
        />
      </SpaceTimeChart>
      <Button
        label={state.zoomMode ? 'cancel' : 'zoom'}
        onClick={() => {
          setState((prev) => ({ ...prev, zoomMode: !prev.zoomMode }));
        }}
      />
      <div className="bottom-control-buttons">
        <div className="control-side">
          <h3>Vertical</h3>
          <div className="flex flex-row items-center gap-5">
            <Slider
              min={0}
              max={100}
              value={!swapAxes ? state.spaceZoomValue : state.timeZoomValue}
              onChange={(e) => {
                handleZoom({ spaceZoom: Number(e.target.value) });
              }}
            />
            <Button
              label="reset"
              onClick={() => {
                handleReset('y');
              }}
            />
          </div>
          <div>offset: {state.yOffset.toFixed(0)}</div>
          <div>
            {!swapAxes
              ? `spaceScale: ${zoomValueToSpaceScale(state.spaceZoomValue).toFixed(2)} m/px`
              : `timeScale: ${zoomValueToTimeScale(state.timeZoomValue).toFixed(2)} ms/px`}
          </div>
        </div>

        <div className="control-side">
          <h3>Horizontal</h3>
          <div className="flex flex-row items-center gap-5">
            <Slider
              min={0}
              max={100}
              value={!swapAxes ? state.timeZoomValue : state.spaceZoomValue}
              onChange={(e) => {
                handleZoom({ timeZoom: Number(e.target.value) });
              }}
            />
            <Button
              label="reset"
              onClick={() => {
                handleReset('x');
              }}
            />
          </div>
          <div>offset: {state.xOffset.toFixed(0)}</div>
          <div>
            {!swapAxes
              ? `timeScale: ${zoomValueToTimeScale(state.timeZoomValue).toFixed(2)} ms/px`
              : `spaceScale: ${zoomValueToSpaceScale(state.spaceZoomValue).toFixed(2)} m/px`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Zoom rectangle',
  component: RectangleZoomWrapper,
  // tags: ['autodocs'],
} as Meta<typeof RectangleZoomWrapper>;

export const Default = {
  args: {
    swapAxes: false,
    spaceOrigin: 0,
    xOffset: 0,
    yOffset: 0,
    operationalPoints: OPERATIONAL_POINTS,
    paths: PATHS.slice(1, 2),
  },
};
