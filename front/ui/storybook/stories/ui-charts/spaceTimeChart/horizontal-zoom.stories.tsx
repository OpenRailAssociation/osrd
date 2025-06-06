import React, { useEffect, useState } from 'react';

import {
  PathLayer,
  SpaceTimeChart,
  type Point,
  type PathData,
  type OperationalPoint,
} from '@osrd-project/ui-charts';
import { Button, Slider } from '@osrd-project/ui-core';
import type { Meta } from '@storybook/react-vite';
import { clamp } from 'lodash';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { getDiff } from './helpers/utils';

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 550;

const MIN_ZOOM = 0;
const MAX_ZOOM = 100;
const MIN_ZOOM_MS_PER_PX = 600000;
const MAX_ZOOM_MS_PER_PX = 625;
const DEFAULT_ZOOM_MS_PER_PX = 7500;
type SpaceTimeHorizontalZoomWrapperProps = {
  offset: number;
  operationalPoints: OperationalPoint[];
  paths: (PathData & { color: string })[];
};

const zoomValueToTimeScale = (slider: number) =>
  MIN_ZOOM_MS_PER_PX * Math.pow(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX, slider / 100);

const timeScaleToZoomValue = (timeScale: number) =>
  (100 * Math.log(timeScale / MIN_ZOOM_MS_PER_PX)) /
  Math.log(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX);

const SpaceTimeHorizontalZoomWrapper = ({
  offset,
  operationalPoints = [],
  paths = [],
}: SpaceTimeHorizontalZoomWrapperProps) => {
  const [state, setState] = useState<{
    zoomValue: number;
    xOffset: number;
    yOffset: number;
    panning: null | { initialOffset: Point };
  }>({
    zoomValue: timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX),
    xOffset: offset,
    yOffset: 0,
    panning: null,
  });
  useEffect(() => {
    setState((prev) => ({ ...prev, xOffset: offset }));
  }, [offset]);
  const handleZoom = (zoomValue: number, position = DEFAULT_WIDTH / 2) => {
    const boundedXZoom = clamp(zoomValue, MIN_ZOOM, MAX_ZOOM);
    const oldTimeScale = zoomValueToTimeScale(state.zoomValue);
    const newTimeScale = zoomValueToTimeScale(boundedXZoom);
    const newOffset = position - ((position - state.xOffset) * oldTimeScale) / newTimeScale;
    setState((prev) => ({ ...prev, zoomValue: boundedXZoom, xOffset: newOffset }));
  };
  const simpleOperationalPoints = operationalPoints.map(({ id, position }) => ({
    id,
    label: id,
    position,
  }));
  const spaceScale = [
    {
      to: 75000000,
      coefficient: 300000,
    },
  ];

  return (
    <div
      className="space-time-horizontal-zoom-wrapper"
      style={{
        height: `${DEFAULT_HEIGHT}px`,
        width: `${DEFAULT_WIDTH}px`,
      }}
    >
      <SpaceTimeChart
        className="h-full"
        spaceOrigin={0}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        timeOrigin={+new Date('2024/04/02')}
        operationalPoints={simpleOperationalPoints}
        timeScale={zoomValueToTimeScale(state.zoomValue)}
        spaceScales={spaceScale}
        onZoom={({ delta, position: { x } }) => {
          handleZoom(state.zoomValue + delta, x);
        }}
        onPan={({ initialPosition, position, isPanning }) => {
          const diff = getDiff(initialPosition, position);
          setState((s) => {
            // Stop panning:
            if (!isPanning) {
              return { ...s, panning: null };
            }
            // Start panning:
            else if (!s.panning) {
              return {
                ...s,
                panning: {
                  initialOffset: {
                    x: s.xOffset,
                    y: s.yOffset,
                  },
                },
              };
            }
            // Keep panning:
            else {
              const { initialOffset } = s.panning;
              return {
                ...s,
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
      </SpaceTimeChart>
      <div className="flex flex-col gap-1">
        <div className="flex flex-row items-center gap-5">
          <Slider
            min={0}
            max={100}
            value={state.zoomValue}
            onChange={(e) => {
              handleZoom(Number(e.target.value));
            }}
          />
          <Button
            label="reset"
            onClick={() => {
              handleZoom(timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX));
            }}
          />
        </div>
        <div>offset: {state.xOffset}</div>
        <div>timescale: {zoomValueToTimeScale(state.zoomValue)} ms/px</div>
      </div>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Horizontal Zoom',
  component: SpaceTimeHorizontalZoomWrapper,
} as Meta<typeof SpaceTimeHorizontalZoomWrapper>;

export const Default = {
  args: {
    offset: 0,
    operationalPoints: OPERATIONAL_POINTS,
    paths: PATHS.slice(2, 4),
  },
};
